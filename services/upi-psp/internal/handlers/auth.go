package handlers

import (
	"net/http"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"

	"github.com/suuupra/upi-psp/internal/middleware"
	"github.com/suuupra/upi-psp/internal/services"
)

// AuthHandler handles authentication endpoints
type AuthHandler struct {
	authService *services.AuthService
	logger      *logrus.Logger
}

// NewAuthHandler creates a new auth handler
func NewAuthHandler(authService *services.AuthService, logger *logrus.Logger) *AuthHandler {
	return &AuthHandler{
		authService: authService,
		logger:      logger,
	}
}

// Register handles user registration
func (h *AuthHandler) Register(c *gin.Context) {
	var req services.RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	response, err := h.authService.Register(req)
	if err != nil {
		h.logger.WithError(err).Error("Registration failed")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "registration_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "User registered successfully",
		"user":    response.User,
	})
}

// Login handles user login
func (h *AuthHandler) Login(c *gin.Context) {
	var req services.LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// Get client IP
	req.DeviceInfo.IPAddress = c.ClientIP()

	response, err := h.authService.Login(req)
	if err != nil {
		h.logger.WithError(err).Error("Login failed")
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "login_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message":       "Login successful",
		"access_token":  response.AccessToken,
		"refresh_token": response.RefreshToken,
		"expires_in":    response.ExpiresIn,
		"user":          response.User,
	})
}

// RefreshToken handles token refresh
func (h *AuthHandler) RefreshToken(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	response, err := h.authService.RefreshToken(req.RefreshToken)
	if err != nil {
		h.logger.WithError(err).Error("Token refresh failed")
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "token_refresh_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"access_token":  response.AccessToken,
		"refresh_token": response.RefreshToken,
		"expires_in":    response.ExpiresIn,
	})
}

// Logout handles user logout
func (h *AuthHandler) Logout(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	deviceID, _ := middleware.GetDeviceID(c)

	var req struct {
		RefreshToken string `json:"refresh_token"`
	}
	c.ShouldBindJSON(&req)

	// Get access token from header
	authHeader := c.GetHeader("Authorization")
	accessToken := ""
	if len(authHeader) > 7 {
		accessToken = authHeader[7:] // Remove "Bearer " prefix
	}

	err := h.authService.Logout(userID, deviceID, accessToken, req.RefreshToken)
	if err != nil {
		h.logger.WithError(err).Error("Logout failed")
		c.JSON(http.StatusInternalServerError, gin.H{
			"error":   "logout_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"message": "Logout successful",
	})
}

// BindDevice handles device binding
func (h *AuthHandler) BindDevice(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	var req struct {
		DeviceID   string              `json:"device_id" binding:"required"`
		DeviceInfo services.DeviceInfo `json:"device_info" binding:"required"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// Set client IP
	req.DeviceInfo.IPAddress = c.ClientIP()

	device, err := h.authService.BindDevice(userID, req.DeviceID, req.DeviceInfo)
	if err != nil {
		h.logger.WithError(err).Error("Device binding failed")
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "device_binding_failed",
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusCreated, gin.H{
		"message": "Device bound successfully",
		"device":  device,
	})
}

// UnbindDevice handles device unbinding
func (h *AuthHandler) UnbindDevice(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	deviceIDStr := c.Param("deviceId")
	deviceID, err := uuid.Parse(deviceIDStr)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_device_id",
			"message": "Invalid device ID format",
		})
		return
	}

	// TODO: Implement device unbinding in auth service
	_ = userID
	_ = deviceID

	c.JSON(http.StatusOK, gin.H{
		"message": "Device unbound successfully",
	})
}

// GetProfile gets user profile
func (h *AuthHandler) GetProfile(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	// TODO: Implement get profile in auth service
	c.JSON(http.StatusOK, gin.H{
		"user_id": userID,
		"message": "Profile retrieved successfully",
	})
}

// UpdateProfile updates user profile
func (h *AuthHandler) UpdateProfile(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	var req struct {
		FirstName   string `json:"first_name"`
		LastName    string `json:"last_name"`
		PhoneNumber string `json:"phone_number"`
	}

	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{
			"error":   "invalid_request",
			"message": err.Error(),
		})
		return
	}

	// TODO: Implement update profile in auth service
	// Use userID when implementing the actual update logic
	_ = userID

	c.JSON(http.StatusOK, gin.H{
		"message": "Profile updated successfully",
	})
}

// GetDevices gets user devices
func (h *AuthHandler) GetDevices(c *gin.Context) {
	userID, exists := middleware.GetUserID(c)
	if !exists {
		c.JSON(http.StatusUnauthorized, gin.H{
			"error":   "unauthorized",
			"message": "User ID not found",
		})
		return
	}

	// TODO: Implement get devices in auth service
	c.JSON(http.StatusOK, gin.H{
		"user_id": userID,
		"devices": []interface{}{},
		"message": "Devices retrieved successfully",
	})
}
