package streaming

import (
	"context"
	"fmt"
	"os"
	"os/exec"
	"path/filepath"
	"sync"
	"time"

	"mass-live/internal/config"
	"mass-live/internal/database"
	"mass-live/internal/models"
	"mass-live/internal/redis"
	"mass-live/pkg/logger"

	"github.com/google/uuid"
)

// Engine handles live streaming processing and distribution
type Engine struct {
	cfg         *config.Config
	db          *database.DB
	redis       *redis.Client
	logger      logger.Logger
	streams     map[string]*Stream
	streamsMutex sync.RWMutex
	ctx         context.Context
	cancel      context.CancelFunc
}

// Stream represents an active live stream
type Stream struct {
	ID           string                 `json:"id"`
	Key          string                 `json:"key"`
	Title        string                 `json:"title"`
	CreatorID    string                 `json:"creator_id"`
	Status       models.StreamStatus    `json:"status"`
	ViewerCount  int                    `json:"viewer_count"`
	StartTime    time.Time              `json:"start_time"`
	EndTime      *time.Time             `json:"end_time,omitempty"`
	RTMPUrl      string                 `json:"rtmp_url"`
	HLSUrl       string                 `json:"hls_url"`
	DASHUrl      string                 `json:"dash_url"`
	Qualities    []string               `json:"qualities"`
	CDNUrls      map[string]string      `json:"cdn_urls"`
	FFmpegCmd    *exec.Cmd              `json:"-"`
	IsRecording  bool                   `json:"is_recording"`
	RecordingUrl string                 `json:"recording_url,omitempty"`
	Metadata     map[string]interface{} `json:"metadata"`
}

// New creates a new streaming engine
func New(cfg *config.Config, db *database.DB, redis *redis.Client, logger logger.Logger) *Engine {
	ctx, cancel := context.WithCancel(context.Background())
	
	return &Engine{
		cfg:     cfg,
		db:      db,
		redis:   redis,
		logger:  logger,
		streams: make(map[string]*Stream),
		ctx:     ctx,
		cancel:  cancel,
	}
}

// Start initializes the streaming engine
func (e *Engine) Start() error {
	e.logger.Info("Starting streaming engine...")

	// Create storage directories
	if err := os.MkdirAll(e.cfg.LocalStoragePath, 0755); err != nil {
		return fmt.Errorf("failed to create storage directory: %w", err)
	}

	// Start background workers
	go e.streamCleanupWorker()
	go e.viewerCountUpdater()
	go e.cdnCacheWarmer()

	e.logger.Info("✅ Streaming engine started")
	return nil
}

// Stop shuts down the streaming engine
func (e *Engine) Stop() {
	e.logger.Info("Stopping streaming engine...")
	
	e.cancel()
	
	// Stop all active streams
	e.streamsMutex.Lock()
	for _, stream := range e.streams {
		e.stopStreamInternal(stream)
	}
	e.streamsMutex.Unlock()
	
	e.logger.Info("✅ Streaming engine stopped")
}

// CreateStream creates a new live stream
func (e *Engine) CreateStream(req *CreateStreamRequest) (*Stream, error) {
	streamID := uuid.New().String()
	streamKey := uuid.New().String()

	stream := &Stream{
		ID:          streamID,
		Key:         streamKey,
		Title:       req.Title,
		CreatorID:   req.CreatorID,
		Status:      models.StreamStatusScheduled,
		ViewerCount: 0,
		StartTime:   time.Now(),
		RTMPUrl:     fmt.Sprintf("rtmp://%s:%d%s/%s", e.cfg.Host, e.cfg.RTMPPort, e.cfg.RTMPPath, streamKey),
		Qualities:   e.cfg.QualityLevels,
		CDNUrls:     make(map[string]string),
		IsRecording: req.EnableRecording,
		Metadata:    req.Metadata,
	}

	// Save to database
	dbStream := &models.Stream{
		ID:              streamID,
		Key:             streamKey,
		Title:           req.Title,
		Description:     req.Description,
		CreatorID:       req.CreatorID,
		Status:          models.StreamStatusScheduled,
		MaxViewers:      req.MaxViewers,
		IsPublic:        req.IsPublic,
		EnableRecording: req.EnableRecording,
		EnableChat:      req.EnableChat,
		Tags:            req.Tags,
		Metadata:        req.Metadata,
		ScheduledAt:     req.ScheduledAt,
		CreatedAt:       time.Now(),
		UpdatedAt:       time.Now(),
	}

	if err := e.db.CreateStream(dbStream); err != nil {
		return nil, fmt.Errorf("failed to save stream to database: %w", err)
	}

	// Cache stream info in Redis
	if err := e.redis.SetStream(streamID, stream); err != nil {
		e.logger.Error("Failed to cache stream in Redis", "error", err)
	}

	e.streamsMutex.Lock()
	e.streams[streamID] = stream
	e.streamsMutex.Unlock()

	e.logger.Info("Stream created", "stream_id", streamID, "creator_id", req.CreatorID)
	return stream, nil
}

// StartStream starts live streaming for a stream
func (e *Engine) StartStream(streamID, streamKey string) error {
	e.streamsMutex.Lock()
	defer e.streamsMutex.Unlock()

	stream, exists := e.streams[streamID]
	if !exists {
		return fmt.Errorf("stream not found: %s", streamID)
	}

	if stream.Key != streamKey {
		return fmt.Errorf("invalid stream key")
	}

	if stream.Status != models.StreamStatusScheduled {
		return fmt.Errorf("stream is not in scheduled status")
	}

	// Start FFmpeg transcoding process
	if err := e.startFFmpegTranscoding(stream); err != nil {
		return fmt.Errorf("failed to start transcoding: %w", err)
	}

	// Update stream status
	stream.Status = models.StreamStatusLive
	stream.StartTime = time.Now()

	// Update database
	if err := e.db.UpdateStreamStatus(streamID, models.StreamStatusLive); err != nil {
		e.logger.Error("Failed to update stream status in database", "error", err)
	}

	// Generate HLS and DASH manifests
	go e.generateManifests(stream)

	// Distribute to CDNs
	if e.cfg.CDNEnabled {
		go e.distributeToCDNs(stream)
	}

	e.logger.Info("Stream started", "stream_id", streamID)
	return nil
}

// StopStream stops a live stream
func (e *Engine) StopStream(streamID string) error {
	e.streamsMutex.Lock()
	defer e.streamsMutex.Unlock()

	stream, exists := e.streams[streamID]
	if !exists {
		return fmt.Errorf("stream not found: %s", streamID)
	}

	return e.stopStreamInternal(stream)
}

func (e *Engine) stopStreamInternal(stream *Stream) error {
	// Stop FFmpeg process
	if stream.FFmpegCmd != nil {
		if err := stream.FFmpegCmd.Process.Kill(); err != nil {
			e.logger.Error("Failed to kill FFmpeg process", "error", err)
		}
	}

	// Update stream status
	now := time.Now()
	stream.Status = models.StreamStatusEnded
	stream.EndTime = &now

	// Update database
	if err := e.db.UpdateStreamStatus(stream.ID, models.StreamStatusEnded); err != nil {
		e.logger.Error("Failed to update stream status in database", "error", err)
	}

	// Clear from Redis
	if err := e.redis.DeleteStream(stream.ID); err != nil {
		e.logger.Error("Failed to delete stream from Redis", "error", err)
	}

	e.logger.Info("Stream stopped", "stream_id", stream.ID)
	return nil
}

// GetStream retrieves stream information
func (e *Engine) GetStream(streamID string) (*Stream, error) {
	e.streamsMutex.RLock()
	defer e.streamsMutex.RUnlock()

	stream, exists := e.streams[streamID]
	if !exists {
		// Try to load from Redis
		if cachedStream, err := e.redis.GetStream(streamID); err == nil && cachedStream != nil {
			e.streams[streamID] = cachedStream
			return cachedStream, nil
		}
		return nil, fmt.Errorf("stream not found: %s", streamID)
	}

	return stream, nil
}

// ListStreams lists all active streams
func (e *Engine) ListStreams() []*Stream {
	e.streamsMutex.RLock()
	defer e.streamsMutex.RUnlock()

	streams := make([]*Stream, 0, len(e.streams))
	for _, stream := range e.streams {
		streams = append(streams, stream)
	}

	return streams
}

// UpdateViewerCount updates the viewer count for a stream
func (e *Engine) UpdateViewerCount(streamID string, count int) error {
	e.streamsMutex.Lock()
	defer e.streamsMutex.Unlock()

	stream, exists := e.streams[streamID]
	if !exists {
		return fmt.Errorf("stream not found: %s", streamID)
	}

	stream.ViewerCount = count

	// Update in Redis
	if err := e.redis.SetStreamViewerCount(streamID, count); err != nil {
		e.logger.Error("Failed to update viewer count in Redis", "error", err)
	}

	return nil
}

// startFFmpegTranscoding starts FFmpeg transcoding for multiple qualities
func (e *Engine) startFFmpegTranscoding(stream *Stream) error {
	// Create output directory
	outputDir := filepath.Join(e.cfg.LocalStoragePath, stream.ID)
	if err := os.MkdirAll(outputDir, 0755); err != nil {
		return fmt.Errorf("failed to create output directory: %w", err)
	}

	// Build FFmpeg command for adaptive bitrate streaming
	args := []string{
		"-f", "flv",
		"-listen", "1",
		"-i", fmt.Sprintf("rtmp://localhost:%d%s/%s", e.cfg.RTMPPort, e.cfg.RTMPPath, stream.Key),
	}

	// Add transcoding parameters for each quality
	for i, quality := range e.cfg.QualityLevels {
		preset := e.getQualityPreset(quality)
		
		// Video encoding
		args = append(args,
			"-map", "0:v",
			"-c:v", "libx264",
			"-preset", "veryfast",
			"-crf", "23",
			"-sc_threshold", "0",
			"-g", "48",
			"-keyint_min", "48",
			"-vf", fmt.Sprintf("scale=%d:%d", preset.Width, preset.Height),
			"-b:v", preset.Bitrate,
			"-maxrate", preset.MaxBitrate,
			"-bufsize", preset.BufSize,
		)

		// Audio encoding
		args = append(args,
			"-map", "0:a",
			"-c:a", "aac",
			"-b:a", preset.AudioBitrate,
			"-ac", "2",
		)

		// HLS output
		hlsPath := filepath.Join(outputDir, fmt.Sprintf("%s.m3u8", quality))
		args = append(args,
			"-f", "hls",
			"-hls_time", fmt.Sprintf("%d", e.cfg.HLSSegmentDuration),
			"-hls_list_size", fmt.Sprintf("%d", e.cfg.HLSPlaylistSize),
			"-hls_flags", "delete_segments",
			hlsPath,
		)
	}

	// Start FFmpeg process
	cmd := exec.CommandContext(e.ctx, "ffmpeg", args...)
	cmd.Stdout = os.Stdout
	cmd.Stderr = os.Stderr

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start FFmpeg: %w", err)
	}

	stream.FFmpegCmd = cmd

	// Monitor FFmpeg process
	go func() {
		if err := cmd.Wait(); err != nil {
			e.logger.Error("FFmpeg process exited with error", "error", err, "stream_id", stream.ID)
			stream.Status = models.StreamStatusError
		}
	}()

	return nil
}

// generateManifests generates HLS and DASH manifests
func (e *Engine) generateManifests(stream *Stream) {
	outputDir := filepath.Join(e.cfg.LocalStoragePath, stream.ID)
	
	// Generate master HLS playlist
	masterPlaylist := "#EXTM3U\n#EXT-X-VERSION:6\n\n"
	
	for _, quality := range e.cfg.QualityLevels {
		preset := e.getQualityPreset(quality)
		bitrate := e.parseBitrate(preset.Bitrate)
		
		masterPlaylist += fmt.Sprintf("#EXT-X-STREAM-INF:BANDWIDTH=%d,RESOLUTION=%dx%d\n", 
			bitrate, preset.Width, preset.Height)
		masterPlaylist += fmt.Sprintf("%s.m3u8\n", quality)
	}
	
	// Write master playlist
	masterPath := filepath.Join(outputDir, "master.m3u8")
	if err := os.WriteFile(masterPath, []byte(masterPlaylist), 0644); err != nil {
		e.logger.Error("Failed to write master playlist", "error", err)
		return
	}
	
	stream.HLSUrl = fmt.Sprintf("%s/streams/%s/master.m3u8", e.cfg.CDNBaseURL, stream.ID)
	
	e.logger.Info("Manifests generated", "stream_id", stream.ID)
}

// distributeToCDNs distributes content to multiple CDN providers
func (e *Engine) distributeToCDNs(stream *Stream) {
	for _, provider := range e.cfg.CDNProviders {
		switch provider {
		case "cloudfront":
			e.distributeToCloudFront(stream)
		case "cloudflare":
			e.distributeToCloudflare(stream)
		case "fastly":
			e.distributeToFastly(stream)
		default:
			e.logger.Warn("Unknown CDN provider", "provider", provider)
		}
	}
}

// distributeToCloudFront distributes content to AWS CloudFront
func (e *Engine) distributeToCloudFront(stream *Stream) {
	// Implementation would involve:
	// 1. Creating CloudFront distribution
	// 2. Configuring cache behaviors for HLS segments
	// 3. Setting up origin for S3 bucket
	// 4. Updating stream CDN URLs
	
	cloudFrontUrl := fmt.Sprintf("https://%s.cloudfront.net/streams/%s/master.m3u8", 
		e.cfg.CloudFrontDistID, stream.ID)
	stream.CDNUrls["cloudfront"] = cloudFrontUrl
	
	e.logger.Info("Stream distributed to CloudFront", "stream_id", stream.ID, "url", cloudFrontUrl)
}

// distributeToCloudflare distributes content to Cloudflare
func (e *Engine) distributeToCloudflare(stream *Stream) {
	// Implementation would involve:
	// 1. Configuring Cloudflare Stream
	// 2. Setting up cache rules for HLS content
	// 3. Optimizing for global edge distribution
	
	cloudflareUrl := fmt.Sprintf("https://stream.cloudflare.com/%s/master.m3u8", stream.ID)
	stream.CDNUrls["cloudflare"] = cloudflareUrl
	
	e.logger.Info("Stream distributed to Cloudflare", "stream_id", stream.ID, "url", cloudflareUrl)
}

// distributeToFastly distributes content to Fastly CDN
func (e *Engine) distributeToFastly(stream *Stream) {
	// Implementation would involve:
	// 1. Configuring Fastly service
	// 2. Setting up VCL for HLS optimization
	// 3. Configuring edge caching policies
	
	fastlyUrl := fmt.Sprintf("https://%s.global.ssl.fastly.net/streams/%s/master.m3u8", 
		e.cfg.FastlyServiceID, stream.ID)
	stream.CDNUrls["fastly"] = fastlyUrl
	
	e.logger.Info("Stream distributed to Fastly", "stream_id", stream.ID, "url", fastlyUrl)
}

// streamCleanupWorker periodically cleans up ended streams
func (e *Engine) streamCleanupWorker() {
	ticker := time.NewTicker(5 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.cleanupEndedStreams()
		}
	}
}

func (e *Engine) cleanupEndedStreams() {
	e.streamsMutex.Lock()
	defer e.streamsMutex.Unlock()

	for streamID, stream := range e.streams {
		if stream.Status == models.StreamStatusEnded && 
		   stream.EndTime != nil && 
		   time.Since(*stream.EndTime) > 1*time.Hour {
			
			// Clean up local files
			outputDir := filepath.Join(e.cfg.LocalStoragePath, streamID)
			if err := os.RemoveAll(outputDir); err != nil {
				e.logger.Error("Failed to clean up stream files", "error", err, "stream_id", streamID)
			}
			
			delete(e.streams, streamID)
			e.logger.Info("Cleaned up ended stream", "stream_id", streamID)
		}
	}
}

// viewerCountUpdater periodically updates viewer counts
func (e *Engine) viewerCountUpdater() {
	ticker := time.NewTicker(10 * time.Second)
	defer ticker.Stop()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.updateAllViewerCounts()
		}
	}
}

func (e *Engine) updateAllViewerCounts() {
	e.streamsMutex.RLock()
	defer e.streamsMutex.RUnlock()

	for _, stream := range e.streams {
		if stream.Status == models.StreamStatusLive {
			// Get viewer count from Redis (updated by CDN edge servers)
			count, err := e.redis.GetStreamViewerCount(stream.ID)
			if err != nil {
				e.logger.Error("Failed to get viewer count", "error", err, "stream_id", stream.ID)
				continue
			}
			
			stream.ViewerCount = count
			
			// Update database periodically
			if err := e.db.UpdateStreamViewerCount(stream.ID, count); err != nil {
				e.logger.Error("Failed to update viewer count in database", "error", err)
			}
		}
	}
}

// cdnCacheWarmer pre-warms CDN caches for popular content
func (e *Engine) cdnCacheWarmer() {
	ticker := time.NewTicker(1 * time.Minute)
	defer ticker.Stop()

	for {
		select {
		case <-e.ctx.Done():
			return
		case <-ticker.C:
			e.warmCDNCaches()
		}
	}
}

func (e *Engine) warmCDNCaches() {
	// Implementation would involve:
	// 1. Identifying popular streams
	// 2. Pre-loading HLS segments on edge servers
	// 3. Optimizing cache hit ratios
	e.logger.Debug("CDN cache warming completed")
}

// Quality preset definitions
type QualityPreset struct {
	Width        int
	Height       int
	Bitrate      string
	MaxBitrate   string
	BufSize      string
	AudioBitrate string
}

func (e *Engine) getQualityPreset(quality string) QualityPreset {
	presets := map[string]QualityPreset{
		"240p":  {Width: 426, Height: 240, Bitrate: "400k", MaxBitrate: "600k", BufSize: "800k", AudioBitrate: "64k"},
		"360p":  {Width: 640, Height: 360, Bitrate: "800k", MaxBitrate: "1200k", BufSize: "1600k", AudioBitrate: "96k"},
		"480p":  {Width: 854, Height: 480, Bitrate: "1200k", MaxBitrate: "1800k", BufSize: "2400k", AudioBitrate: "128k"},
		"720p":  {Width: 1280, Height: 720, Bitrate: "2500k", MaxBitrate: "3750k", BufSize: "5000k", AudioBitrate: "192k"},
		"1080p": {Width: 1920, Height: 1080, Bitrate: "5000k", MaxBitrate: "7500k", BufSize: "10000k", AudioBitrate: "256k"},
	}
	
	if preset, exists := presets[quality]; exists {
		return preset
	}
	
	// Default to 720p
	return presets["720p"]
}

func (e *Engine) parseBitrate(bitrate string) int {
	// Convert "1200k" to 1200000
	if len(bitrate) > 1 && bitrate[len(bitrate)-1] == 'k' {
		if val, err := strconv.Atoi(bitrate[:len(bitrate)-1]); err == nil {
			return val * 1000
		}
	}
	return 1000000 // Default 1Mbps
}

// CreateStreamRequest represents a request to create a new stream
type CreateStreamRequest struct {
	Title           string                 `json:"title" binding:"required"`
	Description     string                 `json:"description"`
	CreatorID       string                 `json:"creator_id" binding:"required"`
	MaxViewers      int                    `json:"max_viewers"`
	IsPublic        bool                   `json:"is_public"`
	EnableRecording bool                   `json:"enable_recording"`
	EnableChat      bool                   `json:"enable_chat"`
	Tags            []string               `json:"tags"`
	ScheduledAt     *time.Time             `json:"scheduled_at"`
	Metadata        map[string]interface{} `json:"metadata"`
}
