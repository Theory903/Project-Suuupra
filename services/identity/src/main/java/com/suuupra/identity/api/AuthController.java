package com.suuupra.identity.api;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import com.suuupra.identity.dto.*;
import com.suuupra.identity.service.AuthService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;

@RestController
@RequestMapping("/api/v1/auth")
@Tag(name = "Authentication", description = "User authentication and authorization endpoints")
public class AuthController {

    private static final Logger logger = LoggerFactory.getLogger(AuthController.class);
    private final AuthService authService;

    public AuthController(AuthService authService) {
        this.authService = authService;
    }

    @PostMapping("/register")
    @Operation(summary = "Register new user", description = "Create a new user account")
    @ApiResponse(responseCode = "201", description = "User registered successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request data")
    @ApiResponse(responseCode = "409", description = "User already exists")
    public ResponseEntity<AuthResponse> register(@RequestBody RegisterRequest request) {
        logger.info("Registration attempt for email: {}", request.getEmail());
        try {
            AuthResponse response = authService.register(request);
            logger.info("Registration successful for email: {}", request.getEmail());
            return ResponseEntity.status(HttpStatus.CREATED).body(response);
        } catch (IllegalArgumentException e) {
            // Handle specific cases like "Email already registered" or "Password found in breach list"
            HttpStatus status = e.getMessage().contains("already registered") ? HttpStatus.CONFLICT : HttpStatus.BAD_REQUEST;
            logger.warn("Registration failed for email: {} - Reason: {}", request.getEmail(), e.getMessage());
            return ResponseEntity.status(status).body(
                AuthResponse.builder()
                    .success(false)
                    .message("Registration failed: " + e.getMessage())
                    .build()
            );
        } catch (Exception e) {
            logger.error("Registration failed for email: {} - Unexpected error: {}", request.getEmail(), e.getMessage(), e);
            return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(
                AuthResponse.builder()
                    .success(false)
                    .message("Registration failed: Internal server error")
                    .build()
            );
        }
    }

    @PostMapping("/login")
    @Operation(summary = "User login", description = "Authenticate user and return JWT token")
    @ApiResponse(responseCode = "200", description = "Login successful")
    @ApiResponse(responseCode = "401", description = "Invalid credentials")
    public ResponseEntity<AuthResponse> login(@RequestBody LoginRequest request) {
        try {
            AuthResponse response = authService.login(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                AuthResponse.builder()
                    .success(false)
                    .message("Login failed: " + e.getMessage())
                    .build()
            );
        }
    }

    @PostMapping("/refresh")
    @Operation(summary = "Refresh JWT token", description = "Generate new access token using refresh token")
    @ApiResponse(responseCode = "200", description = "Token refreshed successfully")
    @ApiResponse(responseCode = "401", description = "Invalid refresh token")
    public ResponseEntity<AuthResponse> refreshToken(@RequestBody RefreshTokenRequest request) {
        try {
            AuthResponse response = authService.refreshToken(request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                AuthResponse.builder()
                    .success(false)
                    .message("Token refresh failed: " + e.getMessage())
                    .build()
            );
        }
    }

    @PostMapping("/logout")
    @Operation(summary = "User logout", description = "Invalidate user session and tokens")
    @ApiResponse(responseCode = "200", description = "Logout successful")
    public ResponseEntity<AuthResponse> logout(@RequestHeader("Authorization") String token) {
        try {
            authService.logout(token);
            return ResponseEntity.ok(
                AuthResponse.builder()
                    .success(true)
                    .message("Logout successful")
                    .build()
            );
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).body(
                AuthResponse.builder()
                    .success(false)
                    .message("Logout failed: " + e.getMessage())
                    .build()
            );
        }
    }

    @PostMapping("/validate")
    @Operation(summary = "Validate JWT token", description = "Verify if JWT token is valid and active")
    @ApiResponse(responseCode = "200", description = "Token is valid")
    @ApiResponse(responseCode = "401", description = "Token is invalid or expired")
    public ResponseEntity<TokenValidationResponse> validateToken(@RequestHeader("Authorization") String token) {
        try {
            TokenValidationResponse response = authService.validateToken(token);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).body(
                TokenValidationResponse.builder()
                    .valid(false)
                    .message("Token validation failed: " + e.getMessage())
                    .build()
            );
        }
    }
}