package com.suuupra.identity.api;

import org.springframework.web.bind.annotation.*;
import org.springframework.http.ResponseEntity;
import org.springframework.http.HttpStatus;
import com.suuupra.identity.dto.*;
import com.suuupra.identity.service.UserService;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.security.SecurityRequirement;

import java.util.List;

@RestController
@RequestMapping("/api/v1/users")
@Tag(name = "User Management", description = "User profile and management endpoints")
@SecurityRequirement(name = "bearerAuth")
public class UserController {

    private final UserService userService;

    public UserController(UserService userService) {
        this.userService = userService;
    }

    @GetMapping("/profile")
    @Operation(summary = "Get user profile", description = "Get current user's profile information")
    @ApiResponse(responseCode = "200", description = "Profile retrieved successfully")
    @ApiResponse(responseCode = "401", description = "Unauthorized")
    public ResponseEntity<UserProfileResponse> getProfile(@RequestHeader("Authorization") String token) {
        try {
            UserProfileResponse response = userService.getProfile(token);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    @PutMapping("/profile")
    @Operation(summary = "Update user profile", description = "Update current user's profile information")
    @ApiResponse(responseCode = "200", description = "Profile updated successfully")
    @ApiResponse(responseCode = "400", description = "Invalid request data")
    @ApiResponse(responseCode = "401", description = "Unauthorized")
    public ResponseEntity<UserProfileResponse> updateProfile(
            @RequestHeader("Authorization") String token,
            @RequestBody UpdateProfileRequest request) {
        try {
            UserProfileResponse response = userService.updateProfile(token, request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.BAD_REQUEST).build();
        }
    }

    @GetMapping
    @Operation(summary = "List users", description = "Get list of users (admin only)")
    @ApiResponse(responseCode = "200", description = "Users retrieved successfully")
    @ApiResponse(responseCode = "403", description = "Forbidden - admin access required")
    public ResponseEntity<List<UserSummary>> listUsers(
            @RequestHeader("Authorization") String token,
            @RequestParam(defaultValue = "0") int page,
            @RequestParam(defaultValue = "20") int size) {
        try {
            List<UserSummary> users = userService.listUsers(token, page, size);
            return ResponseEntity.ok(users);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.FORBIDDEN).build();
        }
    }

    @GetMapping("/{userId}")
    @Operation(summary = "Get user by ID", description = "Get user information by user ID (admin only)")
    @ApiResponse(responseCode = "200", description = "User retrieved successfully")
    @ApiResponse(responseCode = "404", description = "User not found")
    @ApiResponse(responseCode = "403", description = "Forbidden - admin access required")
    public ResponseEntity<UserProfileResponse> getUserById(
            @RequestHeader("Authorization") String token,
            @PathVariable String userId) {
        try {
            UserProfileResponse response = userService.getUserById(token, userId);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @PutMapping("/{userId}/status")
    @Operation(summary = "Update user status", description = "Update user status (admin only)")
    @ApiResponse(responseCode = "200", description = "Status updated successfully")
    @ApiResponse(responseCode = "404", description = "User not found")
    @ApiResponse(responseCode = "403", description = "Forbidden - admin access required")
    public ResponseEntity<UserProfileResponse> updateUserStatus(
            @RequestHeader("Authorization") String token,
            @PathVariable String userId,
            @RequestBody UpdateUserStatusRequest request) {
        try {
            UserProfileResponse response = userService.updateUserStatus(token, userId, request);
            return ResponseEntity.ok(response);
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }

    @DeleteMapping("/{userId}")
    @Operation(summary = "Delete user", description = "Delete user account (admin only)")
    @ApiResponse(responseCode = "204", description = "User deleted successfully")
    @ApiResponse(responseCode = "404", description = "User not found")
    @ApiResponse(responseCode = "403", description = "Forbidden - admin access required")
    public ResponseEntity<Void> deleteUser(
            @RequestHeader("Authorization") String token,
            @PathVariable String userId) {
        try {
            userService.deleteUser(token, userId);
            return ResponseEntity.noContent().build();
        } catch (Exception e) {
            return ResponseEntity.status(HttpStatus.NOT_FOUND).build();
        }
    }
}