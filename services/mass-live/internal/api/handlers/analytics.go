package handlers

import (
	"context"
	"net/http"
	"strconv"
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

	// TODO: Get historical data from database
	analytics := StreamAnalytics{
		StreamID:       streamID,
		Title:          "Live Stream", // TODO: Get from database
		CurrentViewers: int(currentViewers),
		// TODO: Populate other fields from database
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

	// TODO: Get viewer analytics from database
	viewers := []ViewerAnalytics{
		// Mock data for now
	}

	c.JSON(http.StatusOK, gin.H{
		"viewers": viewers,
		"page":    page,
		"limit":   limit,
		"total":   len(viewers),
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

	// TODO: Get historical data from database
	analytics := PlatformAnalytics{
		ActiveStreams: int(activeStreamsCount),
		ActiveViewers: activeViewers,
		// TODO: Populate other fields from database
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

	// TODO: Get creator analytics from database
	stats := CreatorStats{
		CreatorID:   creatorID,
		CreatorName: "Creator", // TODO: Get from database
		// TODO: Populate other fields
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

	// System metrics
	metrics["system"] = map[string]interface{}{
		"uptime_seconds": time.Since(startTime).Seconds(),
		"memory_usage":   "TODO", // TODO: Implement memory monitoring
		"cpu_usage":      "TODO", // TODO: Implement CPU monitoring
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

	// TODO: Calculate view duration and store in database for historical analytics

	return nil
}

// RecordBandwidthUsage records bandwidth usage for analytics
func (h *AnalyticsHandler) RecordBandwidthUsage(ctx context.Context, streamID string, bytes int64) error {
	key := "bandwidth:" + streamID + ":" + time.Now().Format("2006-01-02-15")
	return h.redisClient.IncrBy(ctx, key, bytes).Err()
}
