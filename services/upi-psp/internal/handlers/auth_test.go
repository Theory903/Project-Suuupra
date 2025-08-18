package handlers

import (
	"bytes"
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"testing"

	"github.com/gin-gonic/gin"
	"github.com/google/uuid"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/mock"

	"github.com/suuupra/upi-psp/internal/models"
	"github.com/suuupra/upi-psp/internal/services"
)

// Mock AuthService
type MockAuthService struct {
	mock.Mock
}

func (m *MockAuthService) Register(req services.RegisterRequest) (*services.AuthResponse, error) {
	args := m.Called(req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*services.AuthResponse), args.Error(1)
}

func (m *MockAuthService) Login(req services.LoginRequest) (*services.AuthResponse, error) {
	args := m.Called(req)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*services.AuthResponse), args.Error(1)
}

func (m *MockAuthService) RefreshToken(refreshToken string) (*services.AuthResponse, error) {
	args := m.Called(refreshToken)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*services.AuthResponse), args.Error(1)
}

func (m *MockAuthService) Logout(userID uuid.UUID, deviceID, accessToken, refreshToken string) error {
	args := m.Called(userID, deviceID, accessToken, refreshToken)
	return args.Error(0)
}

func (m *MockAuthService) BindDevice(userID uuid.UUID, deviceID string, deviceInfo services.DeviceInfo) (*models.Device, error) {
	args := m.Called(userID, deviceID, deviceInfo)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*models.Device), args.Error(1)
}

func (m *MockAuthService) ValidateToken(tokenString string) (*services.JWTClaims, error) {
	args := m.Called(tokenString)
	if args.Get(0) == nil {
		return nil, args.Error(1)
	}
	return args.Get(0).(*services.JWTClaims), args.Error(1)
}

func setupAuthHandler() (*AuthHandler, *MockAuthService) {
	mockAuthService := new(MockAuthService)
	logger := logrus.New()
	handler := NewAuthHandler(mockAuthService, logger)
	return handler, mockAuthService
}

func TestAuthHandler_Register(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("successful registration", func(t *testing.T) {
		handler, mockAuthService := setupAuthHandler()

		// Setup request
		registerReq := services.RegisterRequest{
			FirstName:   "John",
			LastName:    "Doe",
			Email:       "john@example.com",
			PhoneNumber: "+1234567890",
			Password:    "password123",
			PIN:         "1234",
		}

		user := &models.User{
			ID:        uuid.New(),
			FirstName: registerReq.FirstName,
			LastName:  registerReq.LastName,
			Email:     registerReq.Email,
		}

		expectedResponse := &services.AuthResponse{
			User: user,
		}

		// Setup mock
		mockAuthService.On("Register", registerReq).Return(expectedResponse, nil)

		// Create request
		reqBody, _ := json.Marshal(registerReq)
		req, _ := http.NewRequest("POST", "/auth/register", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = req

		// Execute
		handler.Register(c)

		// Assert
		assert.Equal(t, http.StatusCreated, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "User registered successfully", response["message"])
		assert.NotNil(t, response["user"])

		// Verify mock
		mockAuthService.AssertExpectations(t)
	})

	t.Run("invalid request body", func(t *testing.T) {
		handler, _ := setupAuthHandler()

		// Create request with invalid JSON
		req, _ := http.NewRequest("POST", "/auth/register", bytes.NewBuffer([]byte("invalid json")))
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = req

		// Execute
		handler.Register(c)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "invalid_request", response["error"])
	})

	t.Run("registration failure", func(t *testing.T) {
		handler, mockAuthService := setupAuthHandler()

		registerReq := services.RegisterRequest{
			FirstName:   "John",
			LastName:    "Doe",
			Email:       "existing@example.com",
			PhoneNumber: "+1234567890",
			Password:    "password123",
			PIN:         "1234",
		}

		// Setup mock to return error
		mockAuthService.On("Register", registerReq).Return(nil, assert.AnError)

		// Create request
		reqBody, _ := json.Marshal(registerReq)
		req, _ := http.NewRequest("POST", "/auth/register", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = req

		// Execute
		handler.Register(c)

		// Assert
		assert.Equal(t, http.StatusBadRequest, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "registration_failed", response["error"])

		// Verify mock
		mockAuthService.AssertExpectations(t)
	})
}

func TestAuthHandler_Login(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("successful login", func(t *testing.T) {
		handler, mockAuthService := setupAuthHandler()

		// Setup request
		loginReq := services.LoginRequest{
			Email:    "john@example.com",
			Password: "password123",
			DeviceID: "test-device-123",
			DeviceInfo: services.DeviceInfo{
				DeviceName: "Test Device",
				Platform:   "ios",
			},
		}

		user := &models.User{
			ID:        uuid.New(),
			FirstName: "John",
			LastName:  "Doe",
			Email:     loginReq.Email,
		}

		expectedResponse := &services.AuthResponse{
			AccessToken:  "access-token",
			RefreshToken: "refresh-token",
			ExpiresIn:    3600,
			User:         user,
		}

		// Setup mock
		mockAuthService.On("Login", mock.MatchedBy(func(req services.LoginRequest) bool {
			return req.Email == loginReq.Email && req.Password == loginReq.Password
		})).Return(expectedResponse, nil)

		// Create request
		reqBody, _ := json.Marshal(loginReq)
		req, _ := http.NewRequest("POST", "/auth/login", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")
		req.RemoteAddr = "192.168.1.1:12345"

		// Create response recorder
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = req

		// Execute
		handler.Login(c)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "Login successful", response["message"])
		assert.Equal(t, "access-token", response["access_token"])
		assert.Equal(t, "refresh-token", response["refresh_token"])
		assert.Equal(t, float64(3600), response["expires_in"])

		// Verify mock
		mockAuthService.AssertExpectations(t)
	})

	t.Run("invalid credentials", func(t *testing.T) {
		handler, mockAuthService := setupAuthHandler()

		loginReq := services.LoginRequest{
			Email:    "john@example.com",
			Password: "wrongpassword",
			DeviceID: "test-device-123",
		}

		// Setup mock to return error
		mockAuthService.On("Login", mock.AnythingOfType("services.LoginRequest")).Return(nil, assert.AnError)

		// Create request
		reqBody, _ := json.Marshal(loginReq)
		req, _ := http.NewRequest("POST", "/auth/login", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = req

		// Execute
		handler.Login(c)

		// Assert
		assert.Equal(t, http.StatusUnauthorized, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "login_failed", response["error"])

		// Verify mock
		mockAuthService.AssertExpectations(t)
	})
}

func TestAuthHandler_RefreshToken(t *testing.T) {
	gin.SetMode(gin.TestMode)

	t.Run("successful token refresh", func(t *testing.T) {
		handler, mockAuthService := setupAuthHandler()

		refreshTokenReq := map[string]string{
			"refresh_token": "valid-refresh-token",
		}

		expectedResponse := &services.AuthResponse{
			AccessToken:  "new-access-token",
			RefreshToken: "new-refresh-token",
			ExpiresIn:    3600,
		}

		// Setup mock
		mockAuthService.On("RefreshToken", "valid-refresh-token").Return(expectedResponse, nil)

		// Create request
		reqBody, _ := json.Marshal(refreshTokenReq)
		req, _ := http.NewRequest("POST", "/auth/refresh", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = req

		// Execute
		handler.RefreshToken(c)

		// Assert
		assert.Equal(t, http.StatusOK, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "new-access-token", response["access_token"])
		assert.Equal(t, "new-refresh-token", response["refresh_token"])

		// Verify mock
		mockAuthService.AssertExpectations(t)
	})

	t.Run("invalid refresh token", func(t *testing.T) {
		handler, mockAuthService := setupAuthHandler()

		refreshTokenReq := map[string]string{
			"refresh_token": "invalid-refresh-token",
		}

		// Setup mock to return error
		mockAuthService.On("RefreshToken", "invalid-refresh-token").Return(nil, assert.AnError)

		// Create request
		reqBody, _ := json.Marshal(refreshTokenReq)
		req, _ := http.NewRequest("POST", "/auth/refresh", bytes.NewBuffer(reqBody))
		req.Header.Set("Content-Type", "application/json")

		// Create response recorder
		w := httptest.NewRecorder()
		c, _ := gin.CreateTestContext(w)
		c.Request = req

		// Execute
		handler.RefreshToken(c)

		// Assert
		assert.Equal(t, http.StatusUnauthorized, w.Code)

		var response map[string]interface{}
		err := json.Unmarshal(w.Body.Bytes(), &response)
		assert.NoError(t, err)
		assert.Equal(t, "token_refresh_failed", response["error"])

		// Verify mock
		mockAuthService.AssertExpectations(t)
	})
}
