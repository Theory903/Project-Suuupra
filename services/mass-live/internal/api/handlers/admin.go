package handlers

import (
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
	"gorm.io/gorm"
)

type AdminHandler struct {
	db          *gorm.DB
	redisClient *redis.Client
}

func NewAdminHandler(db *gorm.DB, redisClient *redis.Client) *AdminHandler {
	return &AdminHandler{
		db:          db,
		redisClient: redisClient,
	}
}

type SystemStats struct {
	Timestamp      time.Time `json:"timestamp"`
	ActiveStreams  int       `json:"active_streams"`
	TotalViewers   int       `json:"total_viewers"`
	TotalBandwidth int64     `json:"total_bandwidth_bytes"`
	ServerUptime   string    `json:"server_uptime"`
	MemoryUsage    string    `json:"memory_usage"`
	CPUUsage       string    `json:"cpu_usage"`
	DiskUsage      string    `json:"disk_usage"`
	DatabaseSize   string    `json:"database_size"`
	RedisMemory    string    `json:"redis_memory"`
}

type StreamManagement struct {
	StreamID    string    `json:"stream_id"`
	Title       string    `json:"title"`
	CreatorID   string    `json:"creator_id"`
	CreatorName string    `json:"creator_name"`
	Status      string    `json:"status"`
	StartTime   time.Time `json:"start_time"`
	Viewers     int       `json:"current_viewers"`
	Quality     []string  `json:"available_qualities"`
	Bandwidth   int64     `json:"bandwidth_usage"`
}

func (h *AdminHandler) GetSystemStats(c *gin.Context) {
	ctx := c.Request.Context()

	// Get active streams count
	activeStreamsCount, _ := h.redisClient.SCard(ctx, "active_streams").Result()

	// Get total viewers
	totalViewers := 0
	streams, _ := h.redisClient.SMembers(ctx, "active_streams").Result()
	for _, streamID := range streams {
		viewers, _ := h.redisClient.SCard(ctx, "stream_viewers:"+streamID).Result()
		totalViewers += int(viewers)
	}

	// TODO: Implement actual system monitoring
	stats := SystemStats{
		Timestamp:     time.Now(),
		ActiveStreams: int(activeStreamsCount),
		TotalViewers:  totalViewers,
		ServerUptime:  time.Since(ServiceStartTime).String(),
		MemoryUsage:   "TODO", // TODO: Implement memory monitoring
		CPUUsage:      "TODO", // TODO: Implement CPU monitoring
		DiskUsage:     "TODO", // TODO: Implement disk monitoring
		DatabaseSize:  "TODO", // TODO: Implement database size monitoring
		RedisMemory:   "TODO", // TODO: Implement Redis memory monitoring
	}

	c.JSON(http.StatusOK, stats)
}

func (h *AdminHandler) ListAllStreams(c *gin.Context) {
	ctx := c.Request.Context()

	// Get pagination parameters
	page, _ := strconv.Atoi(c.DefaultQuery("page", "1"))
	limit, _ := strconv.Atoi(c.DefaultQuery("limit", "20"))
	status := c.DefaultQuery("status", "") // active, ended, all

	if page < 1 {
		page = 1
	}
	if limit < 1 || limit > 100 {
		limit = 20
	}

	var streams []StreamManagement

	// Get active streams from Redis
	if status == "" || status == "active" {
		activeStreamIDs, _ := h.redisClient.SMembers(ctx, "active_streams").Result()

		for _, streamID := range activeStreamIDs {
			// Get stream info from Redis
			streamInfo, _ := h.redisClient.HGetAll(ctx, "stream_info:"+streamID).Result()
			viewerCount, _ := h.redisClient.SCard(ctx, "stream_viewers:"+streamID).Result()

			stream := StreamManagement{
				StreamID:    streamID,
				Title:       streamInfo["title"],
				CreatorID:   streamInfo["creator_id"],
				CreatorName: streamInfo["creator_name"],
				Status:      "active",
				Viewers:     int(viewerCount),
				Quality:     []string{"720p", "480p", "360p"}, // TODO: Get actual qualities
			}

			// Parse start time
			if startTimeStr, exists := streamInfo["start_time"]; exists {
				if startTimeInt, err := strconv.ParseInt(startTimeStr, 10, 64); err == nil {
					stream.StartTime = time.Unix(startTimeInt, 0)
				}
			}

			streams = append(streams, stream)
		}
	}

	// TODO: Get historical streams from database if status includes "ended" or "all"

	// Apply pagination
	start := (page - 1) * limit
	end := start + limit

	if start >= len(streams) {
		streams = []StreamManagement{}
	} else if end > len(streams) {
		streams = streams[start:]
	} else {
		streams = streams[start:end]
	}

	c.JSON(http.StatusOK, gin.H{
		"streams": streams,
		"page":    page,
		"limit":   limit,
		"total":   len(streams),
	})
}

func (h *AdminHandler) ForceStopStream(c *gin.Context) {
	streamID := c.Param("streamId")
	if streamID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Stream ID required"})
		return
	}

	ctx := c.Request.Context()

	// Check if stream exists
	exists, _ := h.redisClient.SIsMember(ctx, "active_streams", streamID).Result()
	if !exists {
		c.JSON(http.StatusNotFound, gin.H{"error": "Stream not found or already stopped"})
		return
	}

	// Remove stream from active streams
	err := h.redisClient.SRem(ctx, "active_streams", streamID).Err()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to stop stream"})
		return
	}

	// Clear stream data
	pipe := h.redisClient.Pipeline()
	pipe.Del(ctx, "stream_info:"+streamID)
	pipe.Del(ctx, "stream_viewers:"+streamID)
	pipe.Del(ctx, "stream_chat:"+streamID)
	_, err = pipe.Exec(ctx)

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to cleanup stream data"})
		return
	}

	// TODO: Stop transcoding processes and cleanup files

	c.JSON(http.StatusOK, gin.H{
		"message":    "Stream stopped successfully",
		"stream_id":  streamID,
		"stopped_at": time.Now(),
	})
}

func (h *AdminHandler) BanUser(c *gin.Context) {
	userID := c.Param("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID required"})
		return
	}

	var req struct {
		Reason   string `json:"reason"`
		Duration int    `json:"duration_hours"` // 0 for permanent
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	ctx := c.Request.Context()

	// Add user to banned set
	banKey := "banned_users"
	err := h.redisClient.SAdd(ctx, banKey, userID).Err()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to ban user"})
		return
	}

	// Store ban details
	banInfoKey := "ban_info:" + userID
	banInfo := map[string]interface{}{
		"reason":    req.Reason,
		"banned_at": time.Now().Unix(),
		"banned_by": c.GetString("user_id"),
		"duration":  req.Duration,
	}

	if req.Duration > 0 {
		banInfo["expires_at"] = time.Now().Add(time.Duration(req.Duration) * time.Hour).Unix()
		// Set expiration
		h.redisClient.Expire(ctx, banInfoKey, time.Duration(req.Duration)*time.Hour)
	}

	err = h.redisClient.HMSet(ctx, banInfoKey, banInfo).Err()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to store ban information"})
		return
	}

	// TODO: Disconnect user from all active streams

	c.JSON(http.StatusOK, gin.H{
		"message":  "User banned successfully",
		"user_id":  userID,
		"reason":   req.Reason,
		"duration": req.Duration,
	})
}

func (h *AdminHandler) UnbanUser(c *gin.Context) {
	userID := c.Param("userId")
	if userID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "User ID required"})
		return
	}

	ctx := c.Request.Context()

	// Remove user from banned set
	err := h.redisClient.SRem(ctx, "banned_users", userID).Err()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to unban user"})
		return
	}

	// Remove ban info
	h.redisClient.Del(ctx, "ban_info:"+userID)

	c.JSON(http.StatusOK, gin.H{
		"message": "User unbanned successfully",
		"user_id": userID,
	})
}

func (h *AdminHandler) GetBannedUsers(c *gin.Context) {
	ctx := c.Request.Context()

	// Get all banned users
	bannedUsers, err := h.redisClient.SMembers(ctx, "banned_users").Result()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to get banned users"})
		return
	}

	// Get ban details for each user
	var bans []map[string]interface{}
	for _, userID := range bannedUsers {
		banInfo, err := h.redisClient.HGetAll(ctx, "ban_info:"+userID).Result()
		if err != nil {
			continue
		}

		ban := map[string]interface{}{
			"user_id": userID,
		}

		for key, value := range banInfo {
			ban[key] = value
		}

		bans = append(bans, ban)
	}

	c.JSON(http.StatusOK, gin.H{
		"banned_users": bans,
		"total":        len(bans),
	})
}

func (h *AdminHandler) UpdateServerConfig(c *gin.Context) {
	var req struct {
		MaxConcurrentStreams int `json:"max_concurrent_streams"`
		MaxViewersPerStream  int `json:"max_viewers_per_stream"`
		RateLimitRequests    int `json:"rate_limit_requests"`
		RateLimitWindow      int `json:"rate_limit_window"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Invalid request body"})
		return
	}

	ctx := c.Request.Context()

	// Store config in Redis
	configKey := "server_config"
	config := map[string]interface{}{
		"max_concurrent_streams": req.MaxConcurrentStreams,
		"max_viewers_per_stream": req.MaxViewersPerStream,
		"rate_limit_requests":    req.RateLimitRequests,
		"rate_limit_window":      req.RateLimitWindow,
		"updated_at":             time.Now().Unix(),
		"updated_by":             c.GetString("user_id"),
	}

	err := h.redisClient.HMSet(ctx, configKey, config).Err()
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update configuration"})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Server configuration updated successfully",
		"config":  config,
	})
}
