package com.suuupra.identity.tenant;

import com.suuupra.identity.user.entity.Role;
import com.suuupra.identity.user.entity.User;
import com.suuupra.identity.user.repository.RoleRepository;
import com.suuupra.identity.user.repository.UserRepository;
import com.suuupra.identity.audit.AuditLogService;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@Tag(name = "Admin Tenants", description = "Admin endpoints to manage tenants and tenant-scoped roles")
@RequestMapping("/api/v1/admin/tenants")
public class TenantAdminController {

    private final TenantService tenantService;
    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final AuditLogService auditLogService;

    public TenantAdminController(TenantService tenantService, UserRepository userRepository, RoleRepository roleRepository, AuditLogService auditLogService) {
        this.tenantService = tenantService;
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.auditLogService = auditLogService;
    }

    @PostMapping
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    @Operation(summary = "Create a tenant")
    public ResponseEntity<Map<String, Object>> createTenant(@RequestBody Map<String, String> body,
                                                            @AuthenticationPrincipal UserDetails principal) {
        String name = body.get("name");
        UUID id = tenantService.createTenant(name);
        auditLogService.append(
            "TENANT_CREATE", null, principal != null ? principal.getUsername() : null, null, null,
            Map.of("name", name, "tenantId", id)
        );
        return ResponseEntity.ok(Map.of("id", id, "name", name));
    }

    @PostMapping("/{tenantId}/users/{userId}/roles/{roleName}")
    @PreAuthorize("hasPermission(#tenantId, 'rbac', 'write')")
    @Operation(summary = "Assign a tenant-scoped role to a user")
    public ResponseEntity<Void> assignTenantRole(@PathVariable UUID tenantId,
                                                 @PathVariable UUID userId,
                                                 @PathVariable String roleName,
                                                 @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findById(userId).orElseThrow();
        Role role = roleRepository.findByName(roleName).orElseThrow();
        tenantService.assignRole(user.getId(), role.getId(), tenantId);
        auditLogService.append(
            "TENANT_ASSIGN_ROLE", null, principal != null ? principal.getUsername() : null, user.getId(), tenantId.toString(),
            Map.of("role", roleName)
        );
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{tenantId}/users/{userId}/roles/{roleName}")
    @PreAuthorize("hasPermission(#tenantId, 'rbac', 'write')")
    @Operation(summary = "Remove a tenant-scoped role from a user")
    public ResponseEntity<Void> removeTenantRole(@PathVariable UUID tenantId,
                                                 @PathVariable UUID userId,
                                                 @PathVariable String roleName,
                                                 @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findById(userId).orElseThrow();
        Role role = roleRepository.findByName(roleName).orElseThrow();
        tenantService.removeRole(user.getId(), role.getId(), tenantId);
        auditLogService.append(
            "TENANT_REMOVE_ROLE", null, principal != null ? principal.getUsername() : null, user.getId(), tenantId.toString(),
            Map.of("role", roleName)
        );
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{tenantId}/users/{userId}/roles")
    @PreAuthorize("hasPermission(#tenantId, 'rbac', 'read')")
    @Operation(summary = "List a user's tenant-scoped roles")
    public ResponseEntity<List<String>> listTenantRoles(@PathVariable UUID tenantId,
                                                        @PathVariable UUID userId) {
        return ResponseEntity.ok(tenantService.listRoleNamesForUser(userId, tenantId));
    }
}
