package middleware

import (
	"context"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/go-redis/redis/v8"
)

type RateLimiter struct {
	redisClient *redis.Client
	requests    int
	window      time.Duration
}

func NewRateLimiter(redisClient *redis.Client, requests int, window time.Duration) *RateLimiter {
	return &RateLimiter{
		redisClient: redisClient,
		requests:    requests,
		window:      window,
	}
}

func (rl *RateLimiter) Middleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get client identifier (IP address or user ID if authenticated)
		clientID := rl.getClientID(c)

		// Check rate limit
		allowed, remaining, resetTime, err := rl.checkRateLimit(c.Request.Context(), clientID)
		if err != nil {
			// Log error but don't block request
			c.Header("X-RateLimit-Error", "Rate limit check failed")
			c.Next()
			return
		}

		// Set rate limit headers
		c.Header("X-RateLimit-Limit", strconv.Itoa(rl.requests))
		c.Header("X-RateLimit-Remaining", strconv.Itoa(remaining))
		c.Header("X-RateLimit-Reset", strconv.FormatInt(resetTime.Unix(), 10))

		if !allowed {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":       "Rate limit exceeded",
				"retry_after": resetTime.Sub(time.Now()).Seconds(),
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

func (rl *RateLimiter) getClientID(c *gin.Context) string {
	// Try to get user ID from context (if authenticated)
	if userID, exists := c.Get("user_id"); exists {
		return fmt.Sprintf("user:%s", userID)
	}

	// Fall back to IP address
	clientIP := c.ClientIP()
	return fmt.Sprintf("ip:%s", clientIP)
}

func (rl *RateLimiter) checkRateLimit(ctx context.Context, clientID string) (bool, int, time.Time, error) {
	key := fmt.Sprintf("rate_limit:%s", clientID)
	now := time.Now()
	window := now.Truncate(rl.window)

	// Use Redis pipeline for atomic operations
	pipe := rl.redisClient.Pipeline()

	// Increment counter
	incrCmd := pipe.Incr(ctx, key)

	// Set expiration on first request
	pipe.ExpireAt(ctx, key, window.Add(rl.window))

	// Execute pipeline
	_, err := pipe.Exec(ctx)
	if err != nil {
		return false, 0, time.Time{}, err
	}

	// Get current count
	currentCount := int(incrCmd.Val())

	// Calculate remaining requests and reset time
	remaining := rl.requests - currentCount
	if remaining < 0 {
		remaining = 0
	}

	resetTime := window.Add(rl.window)
	allowed := currentCount <= rl.requests

	return allowed, remaining, resetTime, nil
}

// StreamRateLimiter provides rate limiting for streaming operations
type StreamRateLimiter struct {
	redisClient *redis.Client
}

func NewStreamRateLimiter(redisClient *redis.Client) *StreamRateLimiter {
	return &StreamRateLimiter{
		redisClient: redisClient,
	}
}

func (srl *StreamRateLimiter) CheckStreamLimit(ctx context.Context, userID string, maxStreams int) (bool, error) {
	key := fmt.Sprintf("user_streams:%s", userID)

	count, err := srl.redisClient.SCard(ctx, key).Result()
	if err != nil && err != redis.Nil {
		return false, err
	}

	return int(count) < maxStreams, nil
}

func (srl *StreamRateLimiter) AddUserStream(ctx context.Context, userID, streamID string) error {
	key := fmt.Sprintf("user_streams:%s", userID)

	// Add stream to user's active streams set
	err := srl.redisClient.SAdd(ctx, key, streamID).Err()
	if err != nil {
		return err
	}

	// Set expiration (cleanup in case of ungraceful shutdown)
	return srl.redisClient.Expire(ctx, key, 24*time.Hour).Err()
}

func (srl *StreamRateLimiter) RemoveUserStream(ctx context.Context, userID, streamID string) error {
	key := fmt.Sprintf("user_streams:%s", userID)
	return srl.redisClient.SRem(ctx, key, streamID).Err()
}
