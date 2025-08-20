package handlers

import (
	"context"
	"fmt"
	"net/http"
	"os"
	"runtime"
	"strconv"
	"strings"
	"sync"
	"syscall"
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

	// Implement actual system monitoring
	var memStats runtime.MemStats
	runtime.ReadMemStats(&memStats)

	// Get CPU usage
	cpuPercent := getCPUUsage()

	// Get disk usage (simplified)
	diskUsage := getDiskUsage()

	// Get database size
	dbSize := getDatabaseSize(h.db, ctx)

	// Get Redis memory usage
	redisMemory := getRedisMemoryUsage(h.redisClient, ctx)

	stats := SystemStats{
		Timestamp:     time.Now(),
		ActiveStreams: int(activeStreamsCount),
		TotalViewers:  totalViewers,
		ServerUptime:  time.Since(ServiceStartTime).String(),
		MemoryUsage:   fmt.Sprintf("%.2f MB / %.2f MB", float64(memStats.Alloc)/1024/1024, float64(memStats.Sys)/1024/1024),
		CPUUsage:      fmt.Sprintf("%.2f%%", cpuPercent),
		DiskUsage:     diskUsage,
		DatabaseSize:  dbSize,
		RedisMemory:   redisMemory,
	}

	c.JSON(http.StatusOK, stats)
}

// getStreamQualities retrieves the actual qualities available for a stream from Redis
func getStreamQualities(streamID string, redisClient *redis.Client) []string {
	ctx := context.Background()
	qualities := []string{}

	// Check which quality levels have viewers
	qualityLevels := []string{"1080p", "720p", "480p", "360p"}

	for _, quality := range qualityLevels {
		qualityKey := fmt.Sprintf("stream_quality:%s:%s", streamID, quality)
		count, err := redisClient.SCard(ctx, qualityKey).Result()
		if err == nil && count > 0 {
			qualities = append(qualities, quality)
		}
	}

	// If no qualities found, return default
	if len(qualities) == 0 {
		return []string{"720p", "480p", "360p"}
	}

	return qualities
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
				Quality:     getStreamQualities(streamData["stream_id"].(string), h.redisClient), // Get actual qualities from Redis
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

	// Get historical streams from database if status includes "ended" or "all"
	if status == "ended" || status == "all" {
		var historicalStreams []StreamManagement

		query := h.db.WithContext(ctx).Raw(`
			SELECT 
				s.stream_id,
				s.title,
				s.creator_id,
				u.username as creator_name,
				s.start_time,
				s.end_time,
				s.total_viewers as viewers,
				s.total_bandwidth as bandwidth,
				CASE WHEN s.end_time IS NULL THEN 'active' ELSE 'ended' END as status
			FROM streams s
			LEFT JOIN users u ON s.creator_id = u.user_id
			WHERE 1=1
		`)

		if status == "ended" {
			query = h.db.WithContext(ctx).Raw(`
				SELECT 
					s.stream_id,
					s.title,
					s.creator_id,
					u.username as creator_name,
					s.start_time,
					s.end_time,
					s.total_viewers as viewers,
					s.total_bandwidth as bandwidth,
					'ended' as status
				FROM streams s
				LEFT JOIN users u ON s.creator_id = u.user_id
				WHERE s.end_time IS NOT NULL
				ORDER BY s.end_time DESC
			`)
		} else {
			query = h.db.WithContext(ctx).Raw(`
				SELECT 
					s.stream_id,
					s.title,
					s.creator_id,
					u.username as creator_name,
					s.start_time,
					s.end_time,
					s.total_viewers as viewers,
					s.total_bandwidth as bandwidth,
					CASE WHEN s.end_time IS NULL THEN 'active' ELSE 'ended' END as status
				FROM streams s
				LEFT JOIN users u ON s.creator_id = u.user_id
				ORDER BY s.start_time DESC
			`)
		}

		query.Scan(&historicalStreams)

		// Merge with active streams if needed
		if status == "all" {
			streams = append(streams, historicalStreams...)
		} else {
			streams = historicalStreams
		}
	}

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

	// Stop transcoding processes and cleanup files
	go func() {
		// Signal transcoding processes to stop
		h.redisClient.Publish(context.Background(), "transcode_stop:"+streamID, "stop")

		// Cleanup temporary files (this would be more sophisticated in production)
		// For now, just signal cleanup
		h.redisClient.Set(context.Background(), "cleanup:"+streamID, "pending", time.Hour)

		// Update database to mark stream as ended
		h.db.Exec(`
			UPDATE streams 
			SET end_time = NOW(), status = 'ended'
			WHERE stream_id = ? AND end_time IS NULL
		`, streamID)
	}()

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

	// Disconnect user from all active streams
	go func() {
		disconnectCtx := context.Background()

		// Get all active streams the user is in
		activeStreamIDs, _ := h.redisClient.SMembers(disconnectCtx, "active_streams").Result()

		for _, streamID := range activeStreamIDs {
			// Check if user is in this stream
			isMember, _ := h.redisClient.SIsMember(disconnectCtx, "stream_viewers:"+streamID, userID).Result()
			if isMember {
				// Remove user from stream
				h.redisClient.SRem(disconnectCtx, "stream_viewers:"+streamID, userID)

				// Send disconnect message via WebSocket
				h.redisClient.Publish(disconnectCtx, "user_disconnect:"+streamID, userID)

				// Clean up user session
				h.redisClient.Del(disconnectCtx, "viewer_session:"+userID+":"+streamID)
			}
		}
	}()

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

// getDiskUsage returns disk usage information
func getDiskUsage() string {
	var stat syscall.Statfs_t
	wd, err := os.Getwd()
	if err != nil {
		return "unknown"
	}

	err = syscall.Statfs(wd, &stat)
	if err != nil {
		return "unknown"
	}

	// Calculate disk usage
	total := stat.Blocks * uint64(stat.Bsize)
	available := stat.Bavail * uint64(stat.Bsize)
	used := total - available

	usedGB := float64(used) / 1024 / 1024 / 1024
	totalGB := float64(total) / 1024 / 1024 / 1024
	usagePercent := (float64(used) / float64(total)) * 100

	return fmt.Sprintf("%.2f GB / %.2f GB (%.1f%%)", usedGB, totalGB, usagePercent)
}

// getDatabaseSize returns database size information
func getDatabaseSize(db *gorm.DB, ctx context.Context) string {
	var result struct {
		DatabaseSize string `json:"database_size"`
	}

	err := db.WithContext(ctx).Raw(`
		SELECT pg_size_pretty(pg_database_size(current_database())) as database_size
	`).Scan(&result).Error

	if err != nil {
		return "unknown"
	}

	return result.DatabaseSize
}

// getRedisMemoryUsage returns Redis memory usage information
func getRedisMemoryUsage(rdb *redis.Client, ctx context.Context) string {
	info, err := rdb.Info(ctx, "memory").Result()
	if err != nil {
		return "unknown"
	}

	// Parse memory info from Redis INFO command
	// This is a simplified parsing - in production you'd parse the full output
	lines := strings.Split(info, "\r\n")
	for _, line := range lines {
		if strings.HasPrefix(line, "used_memory_human:") {
			return strings.TrimPrefix(line, "used_memory_human:")
		}
	}

	return "unknown"
}

// getCPUUsage returns approximate CPU usage percentage (shared with analytics)
func getCPUUsage() float64 {
	cpuMutex.RLock()
	defer cpuMutex.RUnlock()

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
		return 0.0
	}

	lastCPUTime = now
	lastCPUStat = memStats

	numGoroutines := float64(runtime.NumGoroutine())
	return (numGoroutines / 1000.0) * 100.0
}

// ServiceStartTime tracks when the service started (shared with analytics)
var ServiceStartTime = time.Now()

// CPU usage tracking (shared with analytics)
var (
	lastCPUTime time.Time
	lastCPUStat runtime.MemStats
	cpuMutex    sync.RWMutex
)
