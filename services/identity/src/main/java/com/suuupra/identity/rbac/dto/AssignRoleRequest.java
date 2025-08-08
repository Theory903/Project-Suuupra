package com.suuupra.identity.rbac.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Set;
import java.util.UUID;

@Data
public class AssignRoleRequest {
    @NotNull
    private UUID userId;

    @NotNull
    private Set<@NotBlank String> roles; // role names
}
