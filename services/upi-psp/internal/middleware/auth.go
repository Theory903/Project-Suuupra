package middleware

import (
	"net/http"
	"strings"

	"github.com/gin-gonic/gin"
	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
)

// JWTClaims represents JWT claims
type JWTClaims struct {
	UserID   uuid.UUID `json:"user_id"`
	DeviceID string    `json:"device_id"`
	jwt.RegisteredClaims
}

// Auth middleware validates JWT tokens
func Auth(jwtSecret string) gin.HandlerFunc {
	return func(c *gin.Context) {
		// Get token from Authorization header
		authHeader := c.GetHeader("Authorization")
		if authHeader == "" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Authorization header is required",
			})
			c.Abort()
			return
		}

		// Check Bearer prefix
		tokenParts := strings.Split(authHeader, " ")
		if len(tokenParts) != 2 || tokenParts[0] != "Bearer" {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid authorization header format",
			})
			c.Abort()
			return
		}

		tokenString := tokenParts[1]

		// Parse and validate token
		token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
			if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
				return nil, jwt.ErrSignatureInvalid
			}
			return []byte(jwtSecret), nil
		})

		if err != nil {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid token",
			})
			c.Abort()
			return
		}

		// Extract claims
		if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
			// Set user context
			c.Set("user_id", claims.UserID)
			c.Set("device_id", claims.DeviceID)
			c.Next()
		} else {
			c.JSON(http.StatusUnauthorized, gin.H{
				"error":   "unauthorized",
				"message": "Invalid token claims",
			})
			c.Abort()
			return
		}
	}
}

// GetUserID extracts user ID from context
func GetUserID(c *gin.Context) (uuid.UUID, bool) {
	userID, exists := c.Get("user_id")
	if !exists {
		return uuid.Nil, false
	}

	if uid, ok := userID.(uuid.UUID); ok {
		return uid, true
	}

	return uuid.Nil, false
}

// GetDeviceID extracts device ID from context
func GetDeviceID(c *gin.Context) (string, bool) {
	deviceID, exists := c.Get("device_id")
	if !exists {
		return "", false
	}

	if did, ok := deviceID.(string); ok {
		return did, true
	}

	return "", false
}
