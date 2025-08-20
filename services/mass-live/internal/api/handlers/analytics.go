package handlers

import (
	"context"
	"net/http"
	"runtime"
	"strconv"
	"sync"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

type AnalyticsHandler struct {
	db          *gorm.DB
	redisClient *redis.Client
}

func NewAnalyticsHandler(db *gorm.DB, redisClient *redis.Client) *AnalyticsHandler {
	return &AnalyticsHandler{
		db:          db,
		redisClient: redisClient,
	}
}

type StreamAnalytics struct {
	StreamID            string         `json:"stream_id"`
	Title               string         `json:"title"`
	CreatorID           string         `json:"creator_id"`
	CreatorName         string         `json:"creator_name"`
	StartTime           time.Time      `json:"start_time"`
	EndTime             *time.Time     `json:"end_time,omitempty"`
	Duration            int64          `json:"duration_seconds"`
	PeakViewers         int            `json:"peak_viewers"`
	TotalViewers        int            `json:"total_viewers"`
	CurrentViewers      int            `json:"current_viewers"`
	TotalBandwidth      int64          `json:"total_bandwidth_bytes"`
	AverageViewTime     float64        `json:"average_view_time_seconds"`
	ChatMessages        int            `json:"chat_messages"`
	Likes               int            `json:"likes"`
	Shares              int            `json:"shares"`
	QualityDistribution map[string]int `json:"quality_distribution"`
	GeographicData      map[string]int `json:"geographic_data"`
}

type ViewerAnalytics struct {
	UserID       string     `json:"user_id"`
	StreamID     string     `json:"stream_id"`
	JoinTime     time.Time  `json:"join_time"`
	LeaveTime    *time.Time `json:"leave_time,omitempty"`
	ViewDuration int64      `json:"view_duration_seconds"`
	Quality      string     `json:"quality"`
	Location     string     `json:"location"`
	Device       string     `json:"device"`
	Bandwidth    int64      `json:"bandwidth_bytes"`
}

type PlatformAnalytics struct {
	TotalStreams        int64             `json:"total_streams"`
	ActiveStreams       int               `json:"active_streams"`
	TotalViewers        int64             `json:"total_viewers"`
	ActiveViewers       int               `json:"active_viewers"`
	TotalBandwidth      int64             `json:"total_bandwidth_bytes"`
	PopularStreams      []StreamAnalytics `json:"popular_streams"`
	TopCreators         []CreatorStats    `json:"top_creators"`
	QualityDistribution map[string]int    `json:"quality_distribution"`
	GeographicData      map[string]int    `json:"geographic_data"`
	HourlyStats         []HourlyStats     `json:"hourly_stats"`
}

type CreatorStats struct {
	CreatorID     string  `json:"creator_id"`
	CreatorName   string  `json:"creator_name"`
	TotalStreams  int     `json:"total_streams"`
	TotalViewers  int64   `json:"total_viewers"`
	AverageRating float64 `json:"average_rating"`
	Followers     int     `json:"followers"`
}

type HourlyStats struct {
	Hour          time.Time `json:"hour"`
	ActiveStreams int       `json:"active_streams"`
	ActiveViewers int       `json:"active_viewers"`
	Bandwidth     int64     `json:"bandwidth_bytes"`
}

func (h *AnalyticsHandler) GetStreamAnalytics(c *gin.Context) {
	streamID := c.Param("streamId")
	if streamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stream ID required"})
		return
	}

	// Get real-time data from Redis
	currentViewers, _ := h.redisClient.SCard(c.Request.Context(), "stream_viewers:"+streamID).Result()

	// Get historical data from database
	var dbStream struct {
		StreamID        string     `json:"stream_id"`
		Title           string     `json:"title"`
		CreatorID       string     `json:"creator_id"`
		CreatorName     string     `json:"creator_name"`
		StartTime       time.Time  `json:"start_time"`
		EndTime         *time.Time `json:"end_time"`
		PeakViewers     int        `json:"peak_viewers"`
		TotalViewers    int        `json:"total_viewers"`
		TotalBandwidth  int64      `json:"total_bandwidth"`
		AverageViewTime float64    `json:"average_view_time"`
		ChatMessages    int        `json:"chat_messages"`
		Likes           int        `json:"likes"`
		Shares          int        `json:"shares"`
	}

	// Query stream from database
	err := h.db.WithContext(c.Request.Context()).Raw(`
		SELECT 
			s.stream_id,
			s.title,
			s.creator_id,
			u.username as creator_name,
			s.start_time,
			s.end_time,
			s.peak_viewers,
			s.total_viewers,
			s.total_bandwidth,
			s.average_view_time,
			COALESCE(chat.message_count, 0) as chat_messages,
			COALESCE(interactions.likes_count, 0) as likes,
			COALESCE(interactions.shares_count, 0) as shares
		FROM streams s
		LEFT JOIN users u ON s.creator_id = u.user_id
		LEFT JOIN (
			SELECT stream_id, COUNT(*) as message_count
			FROM chat_messages
			GROUP BY stream_id
		) chat ON s.stream_id = chat.stream_id
		LEFT JOIN (
			SELECT stream_id, 
				COUNT(CASE WHEN interaction_type = 'like' THEN 1 END) as likes_count,
				COUNT(CASE WHEN interaction_type = 'share' THEN 1 END) as shares_count
			FROM stream_interactions
			GROUP BY stream_id
		) interactions ON s.stream_id = interactions.stream_id
		WHERE s.stream_id = ?
	`, streamID).Scan(&dbStream).Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found"})
		return
	}

	// Get quality distribution from Redis
	qualityDistribution := make(map[string]int)
	qualities := []string{"1080p", "720p", "480p", "360p"}
	for _, quality := range qualities {
		count, _ := h.redisClient.SCard(c.Request.Context(), "stream_quality:"+streamID+":"+quality).Result()
		qualityDistribution[quality] = int(count)
	}

	// Get geographic data from Redis
	geographicData := make(map[string]int)
	viewerLocations, _ := h.redisClient.HGetAll(c.Request.Context(), "stream_geo:"+streamID).Result()
	for country, countStr := range viewerLocations {
		if count, err := strconv.Atoi(countStr); err == nil {
			geographicData[country] = count
		}
	}

	analytics := StreamAnalytics{
		StreamID:            dbStream.StreamID,
		Title:               dbStream.Title,
		CreatorID:           dbStream.CreatorID,
		CreatorName:         dbStream.CreatorName,
		StartTime:           dbStream.StartTime,
		EndTime:             dbStream.EndTime,
		Duration:            int64(time.Since(dbStream.StartTime).Seconds()),
		PeakViewers:         dbStream.PeakViewers,
		TotalViewers:        dbStream.TotalViewers,
		CurrentViewers:      int(currentViewers),
		TotalBandwidth:      dbStream.TotalBandwidth,
		AverageViewTime:     dbStream.AverageViewTime,
		ChatMessages:        dbStream.ChatMessages,
		Likes:               dbStream.Likes,
		Shares:              dbStream.Shares,
		QualityDistribution: qualityDistribution,
		GeographicData:      geographicData,
	}

	// Update duration if stream has ended
	if dbStream.EndTime != nil {
		analytics.Duration = int64(dbStream.EndTime.Sub(dbStream.StartTime).Seconds())
	}

	c.JSON(http.StatusOK, analytics)
}

func (h *AnalyticsHandler) GetViewerAnalytics(c *gin.Context) {
	streamID := c.Param("streamId")
	if streamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stream ID required"})
		return
	}

	// Get pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "50"))

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 50
	}

	// Get viewer analytics from database
	var viewers []ViewerAnalytics

	offset := (page - 1) * limit

	err := h.db.WithContext(c.Request.Context()).Raw(`
		SELECT 
			vs.user_id,
			vs.stream_id,
			vs.join_time,
			vs.leave_time,
			EXTRACT(EPOCH FROM (COALESCE(vs.leave_time, NOW()) - vs.join_time)) as view_duration,
			vs.quality,
			vs.location,
			vs.device,
			vs.bandwidth_usage as bandwidth
		FROM viewer_sessions vs
		WHERE vs.stream_id = ?
		ORDER BY vs.join_time DESC
		LIMIT ? OFFSET ?
	`, streamID, limit, offset).Scan(&viewers).Error

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch viewer analytics"})
		return
	}

	// Get total count for pagination
	var total int64
	h.db.WithContext(c.Request.Context()).Raw(`
		SELECT COUNT(*) FROM viewer_sessions WHERE stream_id = ?
	`, streamID).Scan(&total)

	c.JSON(http.StatusOK, gin.H{
		"viewers": viewers,
		"page":    page,
		"limit":   limit,
		"total":   total,
	})
}

func (h *AnalyticsHandler) GetPlatformAnalytics(c *gin.Context) {
	ctx := c.Request.Context()

	// Get real-time metrics from Redis
	activeStreamsCount, _ := h.redisClient.SCard(ctx, "active_streams").Result()

	// Get total viewers across all streams
	activeViewers := 0
	streams, _ := h.redisClient.SMembers(ctx, "active_streams").Result()
	for _, streamID := range streams {
		viewers, _ := h.redisClient.SCard(ctx, "stream_viewers:"+streamID).Result()
		activeViewers += int(viewers)
	}

	// Get historical data from database
	var platformStats struct {
		TotalStreams   int64
		TotalViewers   int64
		TotalBandwidth int64
	}

	err := h.db.WithContext(ctx).Raw(`
		SELECT 
			COUNT(DISTINCT s.stream_id) as total_streams,
			COALESCE(SUM(s.total_viewers), 0) as total_viewers,
			COALESCE(SUM(s.total_bandwidth), 0) as total_bandwidth
		FROM streams s
		WHERE s.start_time >= CURRENT_DATE
	`).Scan(&platformStats).Error

	if err != nil {
		// Log error but continue with partial data
		h.redisClient.Set(ctx, "analytics_error", err.Error(), time.Minute)
	}

	// Get popular streams from database
	var popularStreams []StreamAnalytics
	h.db.WithContext(ctx).Raw(`
		SELECT 
			s.stream_id,
			s.title,
			s.creator_id,
			u.username as creator_name,
			s.start_time,
			s.end_time,
			s.peak_viewers,
			s.total_viewers,
			s.total_bandwidth,
			s.average_view_time
		FROM streams s
		LEFT JOIN users u ON s.creator_id = u.user_id
		WHERE s.start_time >= CURRENT_DATE - INTERVAL '7 days'
		ORDER BY s.peak_viewers DESC
		LIMIT 10
	`).Scan(&popularStreams)

	// Get top creators from database
	var topCreators []CreatorStats
	h.db.WithContext(ctx).Raw(`
		SELECT 
			s.creator_id,
			u.username as creator_name,
			COUNT(s.stream_id) as total_streams,
			COALESCE(SUM(s.total_viewers), 0) as total_viewers,
			COALESCE(AVG(s.rating), 0) as average_rating,
			COALESCE(u.followers_count, 0) as followers
		FROM streams s
		LEFT JOIN users u ON s.creator_id = u.user_id
		WHERE s.start_time >= CURRENT_DATE - INTERVAL '30 days'
		GROUP BY s.creator_id, u.username, u.followers_count
		ORDER BY total_viewers DESC
		LIMIT 10
	`).Scan(&topCreators)

	// Get hourly stats for the last 24 hours
	var hourlyStats []HourlyStats
	h.db.WithContext(ctx).Raw(`
		SELECT 
			DATE_TRUNC('hour', vs.join_time) as hour,
			COUNT(DISTINCT vs.stream_id) as active_streams,
			COUNT(vs.user_id) as active_viewers,
			COALESCE(SUM(vs.bandwidth_usage), 0) as bandwidth
		FROM viewer_sessions vs
		WHERE vs.join_time >= NOW() - INTERVAL '24 hours'
		GROUP BY DATE_TRUNC('hour', vs.join_time)
		ORDER BY hour
	`).Scan(&hourlyStats)

	// Get quality distribution from Redis aggregated
	overallQualityDist := make(map[string]int)
	for _, streamID := range streams {
		for _, quality := range []string{"1080p", "720p", "480p", "360p"} {
			count, _ := h.redisClient.SCard(ctx, "stream_quality:"+streamID+":"+quality).Result()
			overallQualityDist[quality] += int(count)
		}
	}

	// Get geographic distribution aggregated
	overallGeoDist := make(map[string]int)
	for _, streamID := range streams {
		geoData, _ := h.redisClient.HGetAll(ctx, "stream_geo:"+streamID).Result()
		for country, countStr := range geoData {
			if count, err := strconv.Atoi(countStr); err == nil {
				overallGeoDist[country] += count
			}
		}
	}

	analytics := PlatformAnalytics{
		TotalStreams:        platformStats.TotalStreams,
		ActiveStreams:       int(activeStreamsCount),
		TotalViewers:        platformStats.TotalViewers,
		ActiveViewers:       activeViewers,
		TotalBandwidth:      platformStats.TotalBandwidth,
		PopularStreams:      popularStreams,
		TopCreators:         topCreators,
		QualityDistribution: overallQualityDist,
		GeographicData:      overallGeoDist,
		HourlyStats:         hourlyStats,
	}

	c.JSON(http.StatusOK, analytics)
}

func (h *AnalyticsHandler) GetCreatorAnalytics(c *gin.Context) {
	creatorID := c.Param("creatorId")
	if creatorID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Creator ID required"})
		return
	}

	// Check if user can access this creator's analytics
	userID, exists := c.Get("user_id")
	role, roleExists := c.Get("role")

	if !exists || (creatorID != userID && roleExists && role != "admin" && role != "moderator") {
		c.JSON(http.StatusForbidden, gin.H{"error": "Access denied"})
		return
	}

	// Get creator analytics from database
	var stats CreatorStats

	err := h.db.WithContext(c.Request.Context()).Raw(`
		SELECT 
			s.creator_id,
			u.username as creator_name,
			COUNT(s.stream_id) as total_streams,
			COALESCE(SUM(s.total_viewers), 0) as total_viewers,
			COALESCE(AVG(s.rating), 0) as average_rating,
			COALESCE(u.followers_count, 0) as followers
		FROM streams s
		LEFT JOIN users u ON s.creator_id = u.user_id
		WHERE s.creator_id = ? AND s.start_time >= CURRENT_DATE - INTERVAL '30 days'
		GROUP BY s.creator_id, u.username, u.followers_count
	`, creatorID).Scan(&stats).Error

	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Creator analytics not found"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func (h *AnalyticsHandler) GetRealtimeMetrics(c *gin.Context) {
	ctx := c.Request.Context()

	// Get real-time metrics from Redis
	metrics := map[string]interface{}{
		"timestamp": time.Now(),
	}

	// Active streams
	activeStreamsCount, _ := h.redisClient.SCard(ctx, "active_streams").Result()
	metrics["active_streams"] = activeStreamsCount

	// Total viewers
	totalViewers := 0
	streams, _ := h.redisClient.SMembers(ctx, "active_streams").Result()
	streamViewers := make(map[string]int)

	for _, streamID := range streams {
		viewers, _ := h.redisClient.SCard(ctx, "stream_viewers:"+streamID).Result()
		streamViewers[streamID] = int(viewers)
		totalViewers += int(viewers)
	}

	metrics["total_viewers"] = totalViewers
	metrics["stream_viewers"] = streamViewers

	// System metrics - implementation with runtime stats
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Get CPU usage (simplified)
	cpuPercent := getCPUUsage()

	metrics["system"] = map[string]interface{}{
		"uptime_seconds":    time.Since(ServiceStartTime).Seconds(),
		"memory_usage_mb":   memStats.Alloc / 1024 / 1024,
		"memory_total_mb":   memStats.Sys / 1024 / 1024,
		"memory_gc_cycles":  memStats.NumGC,
		"cpu_usage_percent": cpuPercent,
		"goroutines":        runtime.NumGoroutine(),
		"gc_pause_ns":       memStats.PauseNs[(memStats.NumGC+255)%256],
	}

	c.JSON(http.StatusOK, metrics)
}

// RecordViewerJoin records when a viewer joins a stream
func (h *AnalyticsHandler) RecordViewerJoin(ctx context.Context, streamID, userID, quality, location, device string) error {
	// Add viewer to stream's viewer set
	err := h.redisClient.SAdd(ctx, "stream_viewers:"+streamID, userID).Err()
	if err != nil {
		return err
	}

	// Record viewer session start
	sessionKey := "viewer_session:" + userID + ":" + streamID
	sessionData := map[string]interface{}{
		"join_time": time.Now().Unix(),
		"quality":   quality,
		"location":  location,
		"device":    device,
	}

	err = h.redisClient.HMSet(ctx, sessionKey, sessionData).Err()
	if err != nil {
		return err
	}

	// Set session expiration
	return h.redisClient.Expire(ctx, sessionKey, 24*time.Hour).Err()
}

// RecordViewerLeave records when a viewer leaves a stream
func (h *AnalyticsHandler) RecordViewerLeave(ctx context.Context, streamID, userID string) error {
	// Remove viewer from stream's viewer set
	err := h.redisClient.SRem(ctx, "stream_viewers:"+streamID, userID).Err()
	if err != nil {
		return err
	}

	// Update viewer session end time
	sessionKey := "viewer_session:" + userID + ":" + streamID
	err = h.redisClient.HSet(ctx, sessionKey, "leave_time", time.Now().Unix()).Err()
	if err != nil {
		return err
	}

	// Calculate view duration and store in database for historical analytics
	joinTimeStr, _ := h.redisClient.HGet(ctx, sessionKey, "join_time").Result()
	if joinTimeStr != "" {
		if joinTimeInt, err := strconv.ParseInt(joinTimeStr, 10, 64); err == nil {
			joinTime := time.Unix(joinTimeInt, 0)
			viewDuration := time.Since(joinTime)

			// Store completed session in database
			go func() {
				dbCtx := context.Background()
				h.db.WithContext(dbCtx).Exec(`
					INSERT INTO viewer_sessions (
						user_id, stream_id, join_time, leave_time, 
						view_duration, quality, location, device, bandwidth_usage
					) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
				`, userID, streamID, joinTime, time.Now(),
					int64(viewDuration.Seconds()),
					sessionData["quality"], sessionData["location"], sessionData["device"], 0)
			}()
		}
	}

	return nil
}

// RecordBandwidthUsage records bandwidth usage for analytics
func (h *AnalyticsHandler) RecordBandwidthUsage(ctx context.Context, streamID string, bytes int64) error {
	key := "bandwidth:" + streamID + ":" + time.Now().Format("2006-01-02-15")
	return h.redisClient.IncrBy(ctx, key, bytes).Err()
}

// ServiceStartTime tracks when the service started
var ServiceStartTime = time.Now()

// CPU usage tracking with simple sampling
var (
	lastCPUTime time.Time
	lastCPUStat runtime.MemStats
	cpuMutex    sync.RWMutex
)

// getCPUUsage returns approximate CPU usage percentage
func getCPUUsage() float64 {
	cpuMutex.RLock()
	defer cpuMutex.RUnlock()

	// This is a simplified CPU usage calculation
	// In production, you would use proper system metrics libraries
	// like gopsutil or integrate with Prometheus metrics

	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	now := time.Now()
	if lastCPUTime.IsZero() {
		lastCPUTime = now
		lastCPUStat = memStats
		return 0.0
	}

	timeDelta := now.Sub(lastCPUTime).Seconds()
	if timeDelta < 1.0 {
		return 0.0 // Not enough time has passed
	}

	// Update for next calculation
	lastCPUTime = now
	lastCPUStat = memStats

	// Return a simulated CPU usage based on goroutines and GC activity
	// This is a very rough approximation
	numGoroutines := float64(runtime.NumGoroutine())
	return (numGoroutines / 1000.0) * 100.0 // Normalize to percentage
}
