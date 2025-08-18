package services

import (
	"context"
	"crypto/rand"
	"encoding/base64"
	"fmt"
	"time"

	"github.com/golang-jwt/jwt/v5"
	"github.com/google/uuid"
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
	"golang.org/x/crypto/bcrypt"

	"github.com/suuupra/upi-psp/internal/config"
	"github.com/suuupra/upi-psp/internal/models"
	"github.com/suuupra/upi-psp/internal/repository"
)

// AuthService handles authentication and authorization
type AuthService struct {
	userRepo    *repository.UserRepository
	deviceRepo  *repository.DeviceRepository
	redisClient *redis.Client
	config      config.Security
	logger      *logrus.Logger
}

// NewAuthService creates a new auth service
func NewAuthService(
	userRepo *repository.UserRepository,
	deviceRepo *repository.DeviceRepository,
	redisClient *redis.Client,
	config config.Security,
	logger *logrus.Logger,
) *AuthService {
	return &AuthService{
		userRepo:    userRepo,
		deviceRepo:  deviceRepo,
		redisClient: redisClient,
		config:      config,
		logger:      logger,
	}
}

// RegisterRequest represents a user registration request
type RegisterRequest struct {
	FirstName   string `json:"first_name" binding:"required"`
	LastName    string `json:"last_name" binding:"required"`
	Email       string `json:"email" binding:"required,email"`
	PhoneNumber string `json:"phone_number" binding:"required"`
	Password    string `json:"password" binding:"required,min=8"`
	PIN         string `json:"pin" binding:"required,len=4"`
}

// LoginRequest represents a login request
type LoginRequest struct {
	Email      string     `json:"email" binding:"required,email"`
	Password   string     `json:"password" binding:"required"`
	DeviceID   string     `json:"device_id" binding:"required"`
	DeviceInfo DeviceInfo `json:"device_info"`
}

// DeviceInfo represents device information
type DeviceInfo struct {
	DeviceName string `json:"device_name"`
	DeviceType string `json:"device_type"`
	Platform   string `json:"platform"`
	OSVersion  string `json:"os_version"`
	AppVersion string `json:"app_version"`
	IPAddress  string `json:"ip_address"`
}

// AuthResponse represents authentication response
type AuthResponse struct {
	AccessToken  string       `json:"access_token"`
	RefreshToken string       `json:"refresh_token"`
	ExpiresIn    int          `json:"expires_in"`
	User         *models.User `json:"user"`
}

// JWTClaims represents JWT claims
type JWTClaims struct {
	UserID   uuid.UUID `json:"user_id"`
	DeviceID string    `json:"device_id"`
	jwt.RegisteredClaims
}

// Register registers a new user
func (s *AuthService) Register(req RegisterRequest) (*AuthResponse, error) {
	// Check if user already exists
	if s.userRepo.EmailExists(req.Email) {
		return nil, fmt.Errorf("user with email already exists")
	}

	if s.userRepo.PhoneExists(req.PhoneNumber) {
		return nil, fmt.Errorf("user with phone number already exists")
	}

	// Hash password
	passwordHash, err := bcrypt.GenerateFromPassword([]byte(req.Password), s.config.BCryptCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash password: %w", err)
	}

	// Hash PIN
	pinHash, err := bcrypt.GenerateFromPassword([]byte(req.PIN), s.config.BCryptCost)
	if err != nil {
		return nil, fmt.Errorf("failed to hash PIN: %w", err)
	}

	// Create user
	user := &models.User{
		FirstName:    req.FirstName,
		LastName:     req.LastName,
		Email:        req.Email,
		PhoneNumber:  req.PhoneNumber,
		PasswordHash: string(passwordHash),
		PINHash:      string(pinHash),
		IsActive:     true,
		IsVerified:   false,
		KYCStatus:    models.KYCStatusPending,
	}

	if err := s.userRepo.Create(user); err != nil {
		return nil, fmt.Errorf("failed to create user: %w", err)
	}

	s.logger.WithField("user_id", user.ID).Info("User registered successfully")

	return &AuthResponse{
		User: user,
	}, nil
}

// Login authenticates a user and returns tokens
func (s *AuthService) Login(req LoginRequest) (*AuthResponse, error) {
	// Get user by email
	user, err := s.userRepo.GetByEmail(req.Email)
	if err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	// Check if user is active
	if !user.IsActive {
		return nil, fmt.Errorf("user account is deactivated")
	}

	// Verify password
	if err := bcrypt.CompareHashAndPassword([]byte(user.PasswordHash), []byte(req.Password)); err != nil {
		return nil, fmt.Errorf("invalid credentials")
	}

	// Get or create device
	device, err := s.getOrCreateDevice(user.ID, req.DeviceID, req.DeviceInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to handle device: %w", err)
	}

	// Check if device is locked
	if device.IsLocked() {
		return nil, fmt.Errorf("device is locked due to failed attempts")
	}

	// Update device last used
	device.UpdateLastUsed(req.DeviceInfo.IPAddress)
	device.ResetFailedAttempts()
	if err := s.deviceRepo.Update(device); err != nil {
		s.logger.WithError(err).Error("Failed to update device")
	}

	// Generate tokens
	accessToken, refreshToken, err := s.generateTokens(user.ID, req.DeviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"user_id":   user.ID,
		"device_id": req.DeviceID,
	}).Info("User logged in successfully")

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		ExpiresIn:    s.config.JWTExpirationHours * 3600,
		User:         user,
	}, nil
}

// RefreshToken refreshes access token using refresh token
func (s *AuthService) RefreshToken(refreshToken string) (*AuthResponse, error) {
	// Validate refresh token
	claims, err := s.validateToken(refreshToken)
	if err != nil {
		return nil, fmt.Errorf("invalid refresh token")
	}

	// Check if refresh token is blacklisted
	ctx := context.Background()
	if s.redisClient.Exists(ctx, "blacklist:"+refreshToken).Val() > 0 {
		return nil, fmt.Errorf("refresh token is blacklisted")
	}

	// Get user
	user, err := s.userRepo.GetByID(claims.UserID)
	if err != nil {
		return nil, fmt.Errorf("user not found")
	}

	// Generate new tokens
	accessToken, newRefreshToken, err := s.generateTokens(claims.UserID, claims.DeviceID)
	if err != nil {
		return nil, fmt.Errorf("failed to generate tokens: %w", err)
	}

	// Blacklist old refresh token
	s.redisClient.Set(ctx, "blacklist:"+refreshToken, "1", time.Duration(s.config.JWTExpirationHours)*time.Hour)

	return &AuthResponse{
		AccessToken:  accessToken,
		RefreshToken: newRefreshToken,
		ExpiresIn:    s.config.JWTExpirationHours * 3600,
		User:         user,
	}, nil
}

// Logout logs out a user and blacklists tokens
func (s *AuthService) Logout(userID uuid.UUID, deviceID, accessToken, refreshToken string) error {
	ctx := context.Background()

	// Blacklist tokens
	expiry := time.Duration(s.config.JWTExpirationHours) * time.Hour
	s.redisClient.Set(ctx, "blacklist:"+accessToken, "1", expiry)
	s.redisClient.Set(ctx, "blacklist:"+refreshToken, "1", expiry)

	s.logger.WithFields(logrus.Fields{
		"user_id":   userID,
		"device_id": deviceID,
	}).Info("User logged out successfully")

	return nil
}

// BindDevice binds a new device to user account
func (s *AuthService) BindDevice(userID uuid.UUID, deviceID string, deviceInfo DeviceInfo) (*models.Device, error) {
	// Check if device already exists for this user
	if s.deviceRepo.IsDeviceOwnedByUser(deviceID, userID) {
		return nil, fmt.Errorf("device already bound to this user")
	}

	// Create device fingerprint
	fingerprint, err := s.generateDeviceFingerprint(deviceInfo)
	if err != nil {
		return nil, fmt.Errorf("failed to generate device fingerprint: %w", err)
	}

	// Create device
	device := &models.Device{
		UserID:            userID,
		DeviceID:          deviceID,
		DeviceFingerprint: fingerprint,
		DeviceName:        deviceInfo.DeviceName,
		DeviceType:        deviceInfo.DeviceType,
		Platform:          deviceInfo.Platform,
		OSVersion:         deviceInfo.OSVersion,
		AppVersion:        deviceInfo.AppVersion,
		LastLoginIP:       deviceInfo.IPAddress,
		IsActive:          true,
		IsPrimary:         false,
		TrustLevel:        50, // Initial trust level
		LastUsedAt:        time.Now(),
	}

	if err := s.deviceRepo.Create(device); err != nil {
		return nil, fmt.Errorf("failed to create device: %w", err)
	}

	s.logger.WithFields(logrus.Fields{
		"user_id":   userID,
		"device_id": deviceID,
	}).Info("Device bound successfully")

	return device, nil
}

// ValidateToken validates a JWT token
func (s *AuthService) ValidateToken(tokenString string) (*JWTClaims, error) {
	// Check if token is blacklisted
	ctx := context.Background()
	if s.redisClient.Exists(ctx, "blacklist:"+tokenString).Val() > 0 {
		return nil, fmt.Errorf("token is blacklisted")
	}

	return s.validateToken(tokenString)
}

// validateToken validates JWT token without blacklist check
func (s *AuthService) validateToken(tokenString string) (*JWTClaims, error) {
	token, err := jwt.ParseWithClaims(tokenString, &JWTClaims{}, func(token *jwt.Token) (interface{}, error) {
		if _, ok := token.Method.(*jwt.SigningMethodHMAC); !ok {
			return nil, fmt.Errorf("unexpected signing method: %v", token.Header["alg"])
		}
		return []byte(s.config.JWTSecret), nil
	})

	if err != nil {
		return nil, err
	}

	if claims, ok := token.Claims.(*JWTClaims); ok && token.Valid {
		return claims, nil
	}

	return nil, fmt.Errorf("invalid token")
}

// generateTokens generates access and refresh tokens
func (s *AuthService) generateTokens(userID uuid.UUID, deviceID string) (string, string, error) {
	// Access token claims
	accessClaims := &JWTClaims{
		UserID:   userID,
		DeviceID: deviceID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(time.Duration(s.config.JWTExpirationHours) * time.Hour)),
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Subject:   userID.String(),
		},
	}

	// Generate access token
	accessToken := jwt.NewWithClaims(jwt.SigningMethodHS256, accessClaims)
	accessTokenString, err := accessToken.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return "", "", err
	}

	// Refresh token claims (longer expiry)
	refreshClaims := &JWTClaims{
		UserID:   userID,
		DeviceID: deviceID,
		RegisteredClaims: jwt.RegisteredClaims{
			ExpiresAt: jwt.NewNumericDate(time.Now().Add(24 * 7 * time.Hour)), // 7 days
			IssuedAt:  jwt.NewNumericDate(time.Now()),
			NotBefore: jwt.NewNumericDate(time.Now()),
			Subject:   userID.String(),
		},
	}

	// Generate refresh token
	refreshToken := jwt.NewWithClaims(jwt.SigningMethodHS256, refreshClaims)
	refreshTokenString, err := refreshToken.SignedString([]byte(s.config.JWTSecret))
	if err != nil {
		return "", "", err
	}

	return accessTokenString, refreshTokenString, nil
}

// getOrCreateDevice gets an existing device or creates a new one
func (s *AuthService) getOrCreateDevice(userID uuid.UUID, deviceID string, deviceInfo DeviceInfo) (*models.Device, error) {
	// Try to get existing device
	device, err := s.deviceRepo.GetByDeviceID(deviceID)
	if err == nil {
		// Device exists, verify it belongs to the user
		if device.UserID != userID {
			return nil, fmt.Errorf("device belongs to different user")
		}
		return device, nil
	}

	// Device doesn't exist, create it
	return s.BindDevice(userID, deviceID, deviceInfo)
}

// generateDeviceFingerprint generates a unique device fingerprint
func (s *AuthService) generateDeviceFingerprint(deviceInfo DeviceInfo) (string, error) {
	// Generate random bytes for fingerprint
	bytes := make([]byte, 32)
	if _, err := rand.Read(bytes); err != nil {
		return "", err
	}

	// Combine with device info for uniqueness
	fingerprint := fmt.Sprintf("%s-%s-%s-%s",
		base64.URLEncoding.EncodeToString(bytes),
		deviceInfo.Platform,
		deviceInfo.DeviceType,
		deviceInfo.OSVersion,
	)

	return fingerprint, nil
}
