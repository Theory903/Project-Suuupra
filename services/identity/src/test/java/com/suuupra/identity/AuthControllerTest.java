package com.suuupra.identity;

import com.suuupra.identity.api.AuthController;
import com.suuupra.identity.dto.AuthResponse;
import com.suuupra.identity.dto.LoginRequest;
import com.suuupra.identity.dto.RegisterRequest;
import com.suuupra.identity.dto.RefreshTokenRequest;
import com.suuupra.identity.dto.TokenValidationResponse;
import com.suuupra.identity.service.AuthService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(AuthController.class)
@DisplayName("Authentication Controller Tests")
class AuthControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private AuthService authService;

    @Autowired
    private ObjectMapper objectMapper;

    private RegisterRequest registerRequest;
    private LoginRequest loginRequest;
    private AuthResponse authResponse;

    @BeforeEach
    void setUp() {
        registerRequest = RegisterRequest.builder()
                .email("test@example.com")
                .password("SecurePassword123!")
                .firstName("John")
                .lastName("Doe")
                .phoneNumber("+91-9876543210")
                .build();

        loginRequest = LoginRequest.builder()
                .email("test@example.com")
                .password("SecurePassword123!")
                .build();

        authResponse = AuthResponse.builder()
                .success(true)
                .message("Authentication successful")
                .token("jwt_token_here")
                .refreshToken("refresh_token_here")
                .expiresIn(3600)
                .build();
    }

    @Test
    @DisplayName("Should register user successfully")
    void shouldRegisterUserSuccessfully() throws Exception {
        when(authService.register(any(RegisterRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isCreated())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Authentication successful"))
                .andExpect(jsonPath("$.token").exists())
                .andExpect(jsonPath("$.refreshToken").exists());
    }

    @Test
    @DisplayName("Should handle registration failure")
    void shouldHandleRegistrationFailure() throws Exception {
        when(authService.register(any(RegisterRequest.class)))
                .thenThrow(new RuntimeException("Email already exists"));

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isBadRequest())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Registration failed: Email already exists"));
    }

    @Test
    @DisplayName("Should login user successfully")
    void shouldLoginUserSuccessfully() throws Exception {
        when(authService.login(any(LoginRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").exists());
    }

    @Test
    @DisplayName("Should handle login failure")
    void shouldHandleLoginFailure() throws Exception {
        when(authService.login(any(LoginRequest.class)))
                .thenThrow(new RuntimeException("Invalid credentials"));

        mockMvc.perform(post("/api/v1/auth/login")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(loginRequest)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false))
                .andExpect(jsonPath("$.message").value("Login failed: Invalid credentials"));
    }

    @Test
    @DisplayName("Should refresh token successfully")
    void shouldRefreshTokenSuccessfully() throws Exception {
        RefreshTokenRequest refreshRequest = RefreshTokenRequest.builder()
                .refreshToken("valid_refresh_token")
                .build();

        when(authService.refreshToken(any(RefreshTokenRequest.class))).thenReturn(authResponse);

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(refreshRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.token").exists());
    }

    @Test
    @DisplayName("Should handle invalid refresh token")
    void shouldHandleInvalidRefreshToken() throws Exception {
        RefreshTokenRequest refreshRequest = RefreshTokenRequest.builder()
                .refreshToken("invalid_refresh_token")
                .build();

        when(authService.refreshToken(any(RefreshTokenRequest.class)))
                .thenThrow(new RuntimeException("Invalid refresh token"));

        mockMvc.perform(post("/api/v1/auth/refresh")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(refreshRequest)))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.success").value(false));
    }

    @Test
    @DisplayName("Should logout user successfully")
    void shouldLogoutUserSuccessfully() throws Exception {
        mockMvc.perform(post("/api/v1/auth/logout")
                .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.success").value(true))
                .andExpect(jsonPath("$.message").value("Logout successful"));
    }

    @Test
    @DisplayName("Should validate token successfully")
    void shouldValidateTokenSuccessfully() throws Exception {
        TokenValidationResponse validationResponse = TokenValidationResponse.builder()
                .valid(true)
                .userId("user_123")
                .email("test@example.com")
                .role("USER")
                .build();

        when(authService.validateToken(anyString())).thenReturn(validationResponse);

        mockMvc.perform(post("/api/v1/auth/validate")
                .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.valid").value(true))
                .andExpect(jsonPath("$.userId").value("user_123"))
                .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    @DisplayName("Should handle invalid token validation")
    void shouldHandleInvalidTokenValidation() throws Exception {
        when(authService.validateToken(anyString()))
                .thenThrow(new RuntimeException("Invalid token"));

        mockMvc.perform(post("/api/v1/auth/validate")
                .header("Authorization", "Bearer invalid_token"))
                .andExpect(status().isUnauthorized())
                .andExpect(jsonPath("$.valid").value(false));
    }

    @Test
    @DisplayName("Should reject registration with invalid email")
    void shouldRejectRegistrationWithInvalidEmail() throws Exception {
        registerRequest.setEmail("invalid-email");

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Should reject registration with weak password")
    void shouldRejectRegistrationWithWeakPassword() throws Exception {
        registerRequest.setPassword("weak");

        mockMvc.perform(post("/api/v1/auth/register")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(registerRequest)))
                .andExpect(status().isBadRequest());
    }
}