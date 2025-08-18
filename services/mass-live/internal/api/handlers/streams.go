package handlers

import (
	"fmt"
	"net/http"
	"strconv"
	"time"

	"mass-live/internal/models"
	"mass-live/internal/streaming"
	"mass-live/pkg/logger"

	"github.com/gin-gonic/gin"
)

// StreamsHandler handles stream-related HTTP requests
type StreamsHandler struct {
	streamingEngine *streaming.Engine
	logger          logger.Logger
}

// NewStreamsHandler creates a new streams handler
func NewStreamsHandler(engine *streaming.Engine, logger logger.Logger) *StreamsHandler {
	return &StreamsHandler{
		streamingEngine: engine,
		logger:          logger,
	}
}

// CreateStream creates a new live stream
// @Summary Create a new live stream
// @Description Create a new live stream with specified configuration
// @Tags streams
// @Accept json
// @Produce json
// @Param stream body streaming.CreateStreamRequest true "Stream configuration"
// @Success 201 {object} streaming.Stream
// @Failure 400 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security BearerAuth
// @Router /streams [post]
func (h *StreamsHandler) CreateStream(c *gin.Context) {
	var req streaming.CreateStreamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: err.Error(),
		})
		return
	}

	// Get user from context (set by auth middleware)
	userID, exists := c.Get("user_id")
	if !exists {
		c.JSON(http.StatusUnauthorized, ErrorResponse{
			Error:   "Unauthorized",
			Message: "User ID not found in context",
		})
		return
	}

	req.CreatorID = userID.(string)

	stream, err := h.streamingEngine.CreateStream(&req)
	if err != nil {
		h.logger.Error("Failed to create stream", "error", err, "user_id", userID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Internal server error",
			Message: "Failed to create stream",
		})
		return
	}

	h.logger.Info("Stream created", "stream_id", stream.ID, "creator_id", req.CreatorID)
	c.JSON(http.StatusCreated, SuccessResponse{
		Success: true,
		Data:    stream,
		Message: "Stream created successfully",
	})
}

// GetStream retrieves stream information
// @Summary Get stream information
// @Description Get detailed information about a specific stream
// @Tags streams
// @Produce json
// @Param stream_id path string true "Stream ID"
// @Success 200 {object} streaming.Stream
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /streams/{stream_id} [get]
func (h *StreamsHandler) GetStream(c *gin.Context) {
	streamID := c.Param("stream_id")
	if streamID == "" {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: "Stream ID is required",
		})
		return
	}

	stream, err := h.streamingEngine.GetStream(streamID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "Not found",
			Message: "Stream not found",
		})
		return
	}

	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Data:    stream,
	})
}

// ListStreams lists all streams with filtering
// @Summary List streams
// @Description List all streams with optional filtering
// @Tags streams
// @Produce json
// @Param status query string false "Filter by status" Enums(scheduled,live,ended,error)
// @Param creator_id query string false "Filter by creator ID"
// @Param limit query int false "Limit number of results" default(20)
// @Param offset query int false "Offset for pagination" default(0)
// @Success 200 {object} StreamListResponse
// @Failure 500 {object} ErrorResponse
// @Router /streams [get]
func (h *StreamsHandler) ListStreams(c *gin.Context) {
	// Parse query parameters
	status := c.Query("status")
	creatorID := c.Query("creator_id")
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	offset, _ := strconv.Atoi(c.DefaultQuery("offset", "0"))

	// Validate limit
	if limit > 100 {
		limit = 100
	}
	if limit < 1 {
		limit = 20
	}

	streams := h.streamingEngine.ListStreams()

	// Apply filters
	filteredStreams := make([]*streaming.Stream, 0)
	for _, stream := range streams {
		if status != "" && string(stream.Status) != status {
			continue
		}
		if creatorID != "" && stream.CreatorID != creatorID {
			continue
		}
		filteredStreams = append(filteredStreams, stream)
	}

	// Apply pagination
	total := len(filteredStreams)
	start := offset
	end := offset + limit

	if start > total {
		start = total
	}
	if end > total {
		end = total
	}

	paginatedStreams := filteredStreams[start:end]

	c.JSON(http.StatusOK, StreamListResponse{
		Success: true,
		Data: StreamListData{
			Streams: paginatedStreams,
			Total:   total,
			Limit:   limit,
			Offset:  offset,
		},
	})
}

// StartStream starts a live stream
// @Summary Start a live stream
// @Description Start streaming for a scheduled stream
// @Tags streams
// @Produce json
// @Param stream_id path string true "Stream ID"
// @Param request body StartStreamRequest true "Start stream request"
// @Success 200 {object} SuccessResponse
// @Failure 400 {object} ErrorResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security BearerAuth
// @Router /streams/{stream_id}/start [post]
func (h *StreamsHandler) StartStream(c *gin.Context) {
	streamID := c.Param("stream_id")

	var req StartStreamRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Invalid request",
			Message: err.Error(),
		})
		return
	}

	err := h.streamingEngine.StartStream(streamID, req.StreamKey)
	if err != nil {
		h.logger.Error("Failed to start stream", "error", err, "stream_id", streamID)
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Start failed",
			Message: err.Error(),
		})
		return
	}

	h.logger.Info("Stream started", "stream_id", streamID)
	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Stream started successfully",
	})
}

// StopStream stops a live stream
// @Summary Stop a live stream
// @Description Stop an active live stream
// @Tags streams
// @Produce json
// @Param stream_id path string true "Stream ID"
// @Success 200 {object} SuccessResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Security BearerAuth
// @Router /streams/{stream_id}/stop [post]
func (h *StreamsHandler) StopStream(c *gin.Context) {
	streamID := c.Param("stream_id")

	err := h.streamingEngine.StopStream(streamID)
	if err != nil {
		h.logger.Error("Failed to stop stream", "error", err, "stream_id", streamID)
		c.JSON(http.StatusInternalServerError, ErrorResponse{
			Error:   "Stop failed",
			Message: err.Error(),
		})
		return
	}

	h.logger.Info("Stream stopped", "stream_id", streamID)
	c.JSON(http.StatusOK, SuccessResponse{
		Success: true,
		Message: "Stream stopped successfully",
	})
}

// GetStreamStats gets real-time statistics for a stream
// @Summary Get stream statistics
// @Description Get real-time statistics and analytics for a stream
// @Tags streams
// @Produce json
// @Param stream_id path string true "Stream ID"
// @Success 200 {object} StreamStatsResponse
// @Failure 404 {object} ErrorResponse
// @Failure 500 {object} ErrorResponse
// @Router /streams/{stream_id}/stats [get]
func (h *StreamsHandler) GetStreamStats(c *gin.Context) {
	streamID := c.Param("stream_id")

	stream, err := h.streamingEngine.GetStream(streamID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "Not found",
			Message: "Stream not found",
		})
		return
	}

	stats := StreamStats{
		StreamID:    streamID,
		Status:      stream.Status,
		ViewerCount: stream.ViewerCount,
		Duration:    int(time.Since(stream.StartTime).Seconds()),
		IsRecording: stream.IsRecording,
		Qualities:   stream.Qualities,
		CDNUrls:     stream.CDNUrls,
		LastUpdated: time.Now(),
	}

	c.JSON(http.StatusOK, StreamStatsResponse{
		Success: true,
		Data:    stats,
	})
}

// GetStreamPlaylist gets the HLS playlist for a stream
// @Summary Get HLS playlist
// @Description Get the HLS master playlist for adaptive bitrate streaming
// @Tags streams
// @Produce application/x-mpegURL
// @Param stream_id path string true "Stream ID"
// @Param quality query string false "Specific quality level"
// @Success 200 {string} string "HLS playlist content"
// @Failure 404 {object} ErrorResponse
// @Router /streams/{stream_id}/playlist.m3u8 [get]
func (h *StreamsHandler) GetStreamPlaylist(c *gin.Context) {
	streamID := c.Param("stream_id")
	quality := c.Query("quality")

	stream, err := h.streamingEngine.GetStream(streamID)
	if err != nil {
		c.JSON(http.StatusNotFound, ErrorResponse{
			Error:   "Not found",
			Message: "Stream not found",
		})
		return
	}

	if stream.Status != models.StreamStatusLive {
		c.JSON(http.StatusBadRequest, ErrorResponse{
			Error:   "Stream not live",
			Message: "Stream is not currently live",
		})
		return
	}

	// Return HLS playlist
	c.Header("Content-Type", "application/x-mpegURL")
	c.Header("Cache-Control", "no-cache")

	if quality != "" {
		// Return specific quality playlist
		c.String(http.StatusOK, h.generateQualityPlaylist(stream, quality))
	} else {
		// Return master playlist
		c.String(http.StatusOK, h.generateMasterPlaylist(stream))
	}
}

// Response types
type ErrorResponse struct {
	Error     string `json:"error"`
	Message   string `json:"message"`
	Timestamp string `json:"timestamp"`
}

type SuccessResponse struct {
	Success bool        `json:"success"`
	Data    interface{} `json:"data,omitempty"`
	Message string      `json:"message,omitempty"`
}

type StreamListResponse struct {
	Success bool           `json:"success"`
	Data    StreamListData `json:"data"`
}

type StreamListData struct {
	Streams []*streaming.Stream `json:"streams"`
	Total   int                 `json:"total"`
	Limit   int                 `json:"limit"`
	Offset  int                 `json:"offset"`
}

type StreamStatsResponse struct {
	Success bool        `json:"success"`
	Data    StreamStats `json:"data"`
}

type StreamStats struct {
	StreamID    string              `json:"stream_id"`
	Status      models.StreamStatus `json:"status"`
	ViewerCount int                 `json:"viewer_count"`
	Duration    int                 `json:"duration"`
	IsRecording bool                `json:"is_recording"`
	Qualities   []string            `json:"qualities"`
	CDNUrls     map[string]string   `json:"cdn_urls"`
	LastUpdated time.Time           `json:"last_updated"`
}

type StartStreamRequest struct {
	StreamKey string `json:"stream_key" binding:"required"`
}

// Helper methods
func (h *StreamsHandler) generateMasterPlaylist(stream *streaming.Stream) string {
	playlist := "#EXTM3U\n#EXT-X-VERSION:6\n\n"

	qualityPresets := map[string]struct {
		Width   int
		Height  int
		Bitrate int
	}{
		"240p":  {426, 240, 400000},
		"360p":  {640, 360, 800000},
		"480p":  {854, 480, 1200000},
		"720p":  {1280, 720, 2500000},
		"1080p": {1920, 1080, 5000000},
	}

	for _, quality := range stream.Qualities {
		if preset, exists := qualityPresets[quality]; exists {
			playlist += fmt.Sprintf("#EXT-X-STREAM-INF:BANDWIDTH=%d,RESOLUTION=%dx%d\n",
				preset.Bitrate, preset.Width, preset.Height)
			playlist += fmt.Sprintf("%s.m3u8\n", quality)
		}
	}

	return playlist
}

func (h *StreamsHandler) generateQualityPlaylist(stream *streaming.Stream, quality string) string {
	// In a real implementation, this would read the actual HLS segments
	// For now, return a basic playlist structure
	playlist := "#EXTM3U\n#EXT-X-VERSION:6\n#EXT-X-TARGETDURATION:2\n#EXT-X-MEDIA-SEQUENCE:0\n\n"

	// Add some sample segments
	for i := 0; i < 5; i++ {
		playlist += "#EXTINF:2.0,\n"
		playlist += fmt.Sprintf("segment_%d.ts\n", i)
	}

	return playlist
}

// RegisterRoutes registers all stream-related routes
func (h *StreamsHandler) RegisterRoutes(router *gin.RouterGroup) {
	streams := router.Group("/streams")
	{
		streams.POST("", h.CreateStream)
		streams.GET("", h.ListStreams)
		streams.GET("/:stream_id", h.GetStream)
		streams.POST("/:stream_id/start", h.StartStream)
		streams.POST("/:stream_id/stop", h.StopStream)
		streams.GET("/:stream_id/stats", h.GetStreamStats)
		streams.GET("/:stream_id/playlist.m3u8", h.GetStreamPlaylist)
	}
}
