package com.suuupra.identity;

import com.suuupra.identity.api.UserController;
import com.suuupra.identity.dto.UserProfileResponse;
import com.suuupra.identity.dto.UpdateProfileRequest;
import com.suuupra.identity.dto.UserSummary;
import com.suuupra.identity.service.UserService;
import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.DisplayName;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.WebMvcTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.http.MediaType;
import org.springframework.test.web.servlet.MockMvc;

import java.time.LocalDateTime;
import java.util.Arrays;
import java.util.List;

import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.Mockito.when;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.*;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.*;

@WebMvcTest(UserController.class)
@DisplayName("User Controller Tests")
class UserControllerTest {

    @Autowired
    private MockMvc mockMvc;

    @MockBean
    private UserService userService;

    @Autowired
    private ObjectMapper objectMapper;

    private UserProfileResponse userProfile;
    private UpdateProfileRequest updateRequest;

    @BeforeEach
    void setUp() {
        userProfile = UserProfileResponse.builder()
                .id("user_123")
                .email("test@example.com")
                .firstName("John")
                .lastName("Doe")
                .phoneNumber("+91-9876543210")
                .role("USER")
                .status("ACTIVE")
                .createdAt(LocalDateTime.now().minusDays(30))
                .updatedAt(LocalDateTime.now())
                .lastLoginAt(LocalDateTime.now().minusHours(1))
                .build();

        updateRequest = UpdateProfileRequest.builder()
                .firstName("John")
                .lastName("Smith")
                .phoneNumber("+91-9876543210")
                .build();
    }

    @Test
    @DisplayName("Should get user profile successfully")
    void shouldGetUserProfileSuccessfully() throws Exception {
        when(userService.getProfile(anyString())).thenReturn(userProfile);

        mockMvc.perform(get("/api/v1/users/profile")
                .header("Authorization", "Bearer valid_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("user_123"))
                .andExpect(jsonPath("$.email").value("test@example.com"))
                .andExpect(jsonPath("$.firstName").value("John"))
                .andExpect(jsonPath("$.lastName").value("Doe"));
    }

    @Test
    @DisplayName("Should handle unauthorized profile access")
    void shouldHandleUnauthorizedProfileAccess() throws Exception {
        when(userService.getProfile(anyString()))
                .thenThrow(new RuntimeException("Invalid token"));

        mockMvc.perform(get("/api/v1/users/profile")
                .header("Authorization", "Bearer invalid_token"))
                .andExpect(status().isUnauthorized());
    }

    @Test
    @DisplayName("Should update user profile successfully")
    void shouldUpdateUserProfileSuccessfully() throws Exception {
        UserProfileResponse updatedProfile = userProfile.toBuilder()
                .lastName("Smith")
                .updatedAt(LocalDateTime.now())
                .build();

        when(userService.updateProfile(anyString(), any(UpdateProfileRequest.class)))
                .thenReturn(updatedProfile);

        mockMvc.perform(put("/api/v1/users/profile")
                .header("Authorization", "Bearer valid_token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.lastName").value("Smith"));
    }

    @Test
    @DisplayName("Should handle profile update failure")
    void shouldHandleProfileUpdateFailure() throws Exception {
        when(userService.updateProfile(anyString(), any(UpdateProfileRequest.class)))
                .thenThrow(new RuntimeException("Validation failed"));

        mockMvc.perform(put("/api/v1/users/profile")
                .header("Authorization", "Bearer valid_token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(updateRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Should list users successfully (admin)")
    void shouldListUsersSuccessfully() throws Exception {
        List<UserSummary> users = Arrays.asList(
                UserSummary.builder()
                        .id("user_123")
                        .email("test1@example.com")
                        .firstName("John")
                        .lastName("Doe")
                        .role("USER")
                        .status("ACTIVE")
                        .build(),
                UserSummary.builder()
                        .id("user_456")
                        .email("test2@example.com")
                        .firstName("Jane")
                        .lastName("Smith")
                        .role("USER")
                        .status("ACTIVE")
                        .build()
        );

        when(userService.listUsers(anyString(), anyInt(), anyInt())).thenReturn(users);

        mockMvc.perform(get("/api/v1/users")
                .header("Authorization", "Bearer admin_token")
                .param("page", "0")
                .param("size", "20"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$").isArray())
                .andExpect(jsonPath("$.length()").value(2))
                .andExpect(jsonPath("$[0].email").value("test1@example.com"))
                .andExpect(jsonPath("$[1].email").value("test2@example.com"));
    }

    @Test
    @DisplayName("Should handle unauthorized user list access")
    void shouldHandleUnauthorizedUserListAccess() throws Exception {
        when(userService.listUsers(anyString(), anyInt(), anyInt()))
                .thenThrow(new RuntimeException("Insufficient permissions"));

        mockMvc.perform(get("/api/v1/users")
                .header("Authorization", "Bearer user_token"))
                .andExpect(status().isForbidden());
    }

    @Test
    @DisplayName("Should get user by ID successfully (admin)")
    void shouldGetUserByIdSuccessfully() throws Exception {
        when(userService.getUserById(anyString(), anyString())).thenReturn(userProfile);

        mockMvc.perform(get("/api/v1/users/user_123")
                .header("Authorization", "Bearer admin_token"))
                .andExpect(status().isOk())
                .andExpect(jsonPath("$.id").value("user_123"))
                .andExpect(jsonPath("$.email").value("test@example.com"));
    }

    @Test
    @DisplayName("Should handle user not found")
    void shouldHandleUserNotFound() throws Exception {
        when(userService.getUserById(anyString(), anyString()))
                .thenThrow(new RuntimeException("User not found"));

        mockMvc.perform(get("/api/v1/users/nonexistent")
                .header("Authorization", "Bearer admin_token"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Should delete user successfully (admin)")
    void shouldDeleteUserSuccessfully() throws Exception {
        mockMvc.perform(delete("/api/v1/users/user_123")
                .header("Authorization", "Bearer admin_token"))
                .andExpect(status().isNoContent());
    }

    @Test
    @DisplayName("Should handle delete user failure")
    void shouldHandleDeleteUserFailure() throws Exception {
        when(userService.deleteUser(anyString(), anyString()))
                .thenThrow(new RuntimeException("Cannot delete user"));

        mockMvc.perform(delete("/api/v1/users/user_123")
                .header("Authorization", "Bearer admin_token"))
                .andExpect(status().isNotFound());
    }

    @Test
    @DisplayName("Should validate phone number format")
    void shouldValidatePhoneNumberFormat() throws Exception {
        UpdateProfileRequest invalidRequest = updateRequest.toBuilder()
                .phoneNumber("invalid-phone")
                .build();

        mockMvc.perform(put("/api/v1/users/profile")
                .header("Authorization", "Bearer valid_token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(invalidRequest)))
                .andExpect(status().isBadRequest());
    }

    @Test
    @DisplayName("Should handle empty update request")
    void shouldHandleEmptyUpdateRequest() throws Exception {
        UpdateProfileRequest emptyRequest = UpdateProfileRequest.builder().build();

        when(userService.updateProfile(anyString(), any(UpdateProfileRequest.class)))
                .thenReturn(userProfile);

        mockMvc.perform(put("/api/v1/users/profile")
                .header("Authorization", "Bearer valid_token")
                .contentType(MediaType.APPLICATION_JSON)
                .content(objectMapper.writeValueAsString(emptyRequest)))
                .andExpect(status().isOk());
    }
}