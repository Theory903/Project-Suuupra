package com.suuupra.identity.rbac;

import com.suuupra.identity.audit.AuditLogService;
import com.suuupra.identity.rbac.dto.RoleCrudDtos.CreateRoleRequest;
import com.suuupra.identity.rbac.dto.RoleCrudDtos.UpdateRolePermissionsRequest;
import com.suuupra.identity.user.entity.Permission;
import com.suuupra.identity.user.entity.Role;
import com.suuupra.identity.user.repository.PermissionRepository;
import com.suuupra.identity.user.repository.RoleRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;
import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.tags.Tag;

import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
@Tag(name = "Admin Roles", description = "Admin endpoints to manage roles and permissions")
@RequestMapping("/api/v1/admin/roles")
public class AdminRoleController {

    private final RoleRepository roleRepository;
    private final PermissionRepository permissionRepository;
    private final AuditLogService auditLogService;
    private final PermissionCacheEvictor cacheEvictor;

    public AdminRoleController(RoleRepository roleRepository, PermissionRepository permissionRepository, AuditLogService auditLogService, PermissionCacheEvictor cacheEvictor) {
        this.roleRepository = roleRepository;
        this.permissionRepository = permissionRepository;
        this.auditLogService = auditLogService;
        this.cacheEvictor = cacheEvictor;
    }

    @PostMapping
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    @Operation(summary = "Create a role")
    public ResponseEntity<Map<String, Object>> createRole(@RequestBody @Valid CreateRoleRequest req,
                                                          @AuthenticationPrincipal UserDetails principal) {
        Role role = new Role();
        role.setName(req.getName());
        role.setDescription(req.getDescription());
        roleRepository.save(role);
        auditLogService.append("ROLE_CREATE", null, principal != null ? principal.getUsername() : null, null, null,
            Map.of("role", req.getName()));
        cacheEvictor.evictAll();
        return ResponseEntity.ok(Map.of("id", role.getId(), "name", role.getName()));
    }

    @PostMapping("/{roleName}/permissions")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    @Operation(summary = "Add/remove permissions for a role")
    public ResponseEntity<Map<String, Object>> updateRolePermissions(@PathVariable String roleName,
                                                                     @RequestBody @Valid UpdateRolePermissionsRequest req,
                                                                     @AuthenticationPrincipal UserDetails principal) {
        Role role = roleRepository.findByName(roleName).orElseThrow();
        Set<Permission> current = role.getPermissions();
        Set<Permission> add = req.getAddPermissions().stream()
            .map(name -> permissionRepository.findByName(name).orElseThrow())
            .collect(Collectors.toSet());
        Set<Permission> remove = req.getRemovePermissions().stream()
            .map(name -> permissionRepository.findByName(name).orElseThrow())
            .collect(Collectors.toSet());
        current.addAll(add);
        current.removeAll(remove);
        role.setPermissions(current);
        roleRepository.save(role);
        auditLogService.append("ROLE_PERMS_UPDATE", null, principal != null ? principal.getUsername() : null, null, null,
            Map.of("role", roleName, "add", req.getAddPermissions(), "remove", req.getRemovePermissions()));
        cacheEvictor.evictAll();
        return ResponseEntity.ok(Map.of("role", roleName, "permissions", current.stream().map(Permission::getName).toArray()));
    }

    @DeleteMapping("/{roleName}")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    @Operation(summary = "Delete a role")
    public ResponseEntity<Void> deleteRole(@PathVariable String roleName,
                                           @AuthenticationPrincipal UserDetails principal) {
        Role role = roleRepository.findByName(roleName).orElseThrow();
        roleRepository.delete(role);
        auditLogService.append("ROLE_DELETE", null, principal != null ? principal.getUsername() : null, null, null,
            Map.of("role", roleName));
        cacheEvictor.evictAll();
        return ResponseEntity.noContent().build();
    }
}
