package middleware

import (
	"net/http"
	"time"

	"github.com/gin-gonic/gin"
)

// DeviceValidation middleware validates device information
func DeviceValidation() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get device ID from context (set by auth middleware)
		deviceID, exists := GetDeviceID(c)
		if !exists || deviceID == "" {
			c.JSON(http.StatusBadRequest, gin.H{
				"error":   "bad_request",
				"message": "Device ID is required",
			})
			c.Abort()
			return
		}

		// TODO: Add device validation logic
		// - Check if device is active
		// - Check if device is trusted
		// - Check device fingerprint
		// - Rate limiting per device

		c.Next()
	}
}

// CORS middleware handles Cross-Origin Resource Sharing
func CORS() gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Origin, Content-Type, Content-Length, Accept-Encoding, X-CSRF-Token, Authorization, Device-ID, App-Version")
		c.Header("Access-Control-Expose-Headers", "Content-Length")
		c.Header("Access-Control-Allow-Credentials", "true")

		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(http.StatusNoContent)
			return
		}

		c.Next()
	}
}

// SecurityHeaders middleware adds security headers
func SecurityHeaders() gin.HandlerFunc {
	return func(c *gin.Context) {
		// Prevent XSS attacks
		c.Header("X-XSS-Protection", "1; mode=block")

		// Prevent MIME type sniffing
		c.Header("X-Content-Type-Options", "nosniff")

		// Prevent clickjacking
		c.Header("X-Frame-Options", "DENY")

		// Enforce HTTPS
		c.Header("Strict-Transport-Security", "max-age=31536000; includeSubDomains")

		// Content Security Policy
		c.Header("Content-Security-Policy", "default-src 'self'")

		// Referrer Policy
		c.Header("Referrer-Policy", "strict-origin-when-cross-origin")

		c.Next()
	}
}

// RateLimit middleware implements rate limiting
func RateLimit(maxRequests int, windowDuration time.Duration) gin.HandlerFunc {
	// Simple in-memory rate limiter
	// In production, use Redis-based rate limiting
	clients := make(map[string][]time.Time)

	return func(c *gin.Context) {
		clientIP := c.ClientIP()
		now := time.Now()

		// Clean old requests
		if requests, exists := clients[clientIP]; exists {
			validRequests := []time.Time{}
			for _, reqTime := range requests {
				if now.Sub(reqTime) < windowDuration {
					validRequests = append(validRequests, reqTime)
				}
			}
			clients[clientIP] = validRequests
		}

		// Check rate limit
		if len(clients[clientIP]) >= maxRequests {
			c.JSON(http.StatusTooManyRequests, gin.H{
				"error":   "rate_limit_exceeded",
				"message": "Too many requests",
			})
			c.Abort()
			return
		}

		// Add current request
		clients[clientIP] = append(clients[clientIP], now)
		c.Next()
	}
}

// IPWhitelist middleware restricts access to whitelisted IPs
func IPWhitelist(allowedIPs []string) gin.HandlerFunc {
	whitelist := make(map[string]bool)
	for _, ip := range allowedIPs {
		whitelist[ip] = true
	}

	return func(c *gin.Context) {
		clientIP := c.ClientIP()

		if len(whitelist) > 0 && !whitelist[clientIP] {
			c.JSON(http.StatusForbidden, gin.H{
				"error":   "forbidden",
				"message": "Access denied",
			})
			c.Abort()
			return
		}

		c.Next()
	}
}

// RequestSizeLimit middleware limits request body size
func RequestSizeLimit(maxSize int64) gin.HandlerFunc {
	return gin.HandlerFunc(func(c *gin.Context) {
		if c.Request.ContentLength > maxSize {
			c.JSON(http.StatusRequestEntityTooLarge, gin.H{
				"error":   "request_too_large",
				"message": "Request body too large",
			})
			c.Abort()
			return
		}

		c.Request.Body = http.MaxBytesReader(c.Writer, c.Request.Body, maxSize)
		c.Next()
	})
}
