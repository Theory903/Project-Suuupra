package com.suuupra.identity.rbac;

import com.suuupra.identity.rbac.dto.AssignRoleRequest;
import com.suuupra.identity.audit.AuditLogService;
import com.suuupra.identity.common.util.TenantContext;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import com.suuupra.identity.user.entity.Role;
import com.suuupra.identity.user.entity.User;
import com.suuupra.identity.user.repository.RoleRepository;
import com.suuupra.identity.user.repository.UserRepository;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.Set;
import java.util.UUID;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/rbac")
public class AdminRbacController {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final AuditLogService auditLogService;

    public AdminRbacController(UserRepository userRepository, RoleRepository roleRepository, AuditLogService auditLogService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.auditLogService = auditLogService;
    }

    @GetMapping("/users/{userId}/roles")
    @PreAuthorize("hasPermission(null, 'rbac.read')")
    public ResponseEntity<Set<String>> getUserRoles(@PathVariable UUID userId) {
        User user = userRepository.findById(userId).orElseThrow();
        Set<String> roles = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        return ResponseEntity.ok(roles);
    }

    @PostMapping("/users/assign-roles")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    public ResponseEntity<Map<String, Object>> assignRoles(@RequestBody @Valid AssignRoleRequest request,
                                                           @AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findById(request.getUserId()).orElseThrow();
        Set<Role> newRoles = request.getRoles().stream()
            .map(name -> roleRepository.findByName(name).orElseThrow(() -> new IllegalArgumentException("Unknown role: " + name)))
            .collect(Collectors.toSet());
        Set<String> old = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
        user.setRoles(newRoles);
        userRepository.save(user);
        String tenant = TenantContext.getTenant();
        // Actor lookup is light here; for stronger identity use the auth principal id if embedded
        auditLogService.append(
            "RBAC_ASSIGN_ROLES",
            null,
            principal != null ? principal.getUsername() : null,
            user.getId(),
            tenant,
            Map.of("oldRoles", old, "newRoles", newRoles.stream().map(Role::getName).collect(Collectors.toSet()))
        );
        return ResponseEntity.ok(Map.of(
            "userId", user.getId(),
            "roles", newRoles.stream().map(Role::getName).toArray()
        ));
    }
}
