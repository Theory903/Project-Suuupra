package com.suuupra.identity.rbac.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import lombok.Data;

import java.util.Set;

public class RoleCrudDtos {

    @Data
    public static class CreateRoleRequest {
        @NotBlank private String name;
        private String description;
    }

    @Data
    public static class UpdateRolePermissionsRequest {
        @NotNull private Set<@NotBlank String> addPermissions;
        @NotNull private Set<@NotBlank String> removePermissions;
    }
}
