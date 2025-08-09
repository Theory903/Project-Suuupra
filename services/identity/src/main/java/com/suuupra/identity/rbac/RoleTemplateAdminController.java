package com.suuupra.identity.rbac;

import com.suuupra.identity.security.RequireDPoP;
import com.suuupra.identity.security.RequireResources;
import com.suuupra.identity.user.entity.Permission;
import com.suuupra.identity.user.entity.Role;
import com.suuupra.identity.user.repository.PermissionRepository;
import com.suuupra.identity.user.repository.RoleRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.web.bind.annotation.*;

import java.util.*;
import java.util.stream.Collectors;

@RestController
@RequestMapping("/api/v1/admin/role-templates")
@RequireResources({"resource://identity.admin"})
@RequireDPoP
public class RoleTemplateAdminController {

    private final JdbcTemplate jdbc;
    private final PermissionRepository permissionRepository;
    private final RoleRepository roleRepository;

    public RoleTemplateAdminController(JdbcTemplate jdbc, PermissionRepository permissionRepository, RoleRepository roleRepository) {
        this.jdbc = jdbc;
        this.permissionRepository = permissionRepository;
        this.roleRepository = roleRepository;
    }

    @PostMapping
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    public ResponseEntity<Map<String, Object>> createTemplate(@RequestBody Map<String, String> body) {
        String name = Objects.requireNonNull(body.get("name"));
        String description = body.getOrDefault("description", "");
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO role_templates(id, name, description) VALUES (?,?,?)", id, name, description);
        return ResponseEntity.ok(Map.of("id", id, "name", name));
    }

    @PostMapping("/{templateId}/permissions")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    public ResponseEntity<Void> addPermissions(@PathVariable UUID templateId, @RequestBody Map<String, List<String>> body) {
        List<String> names = body.getOrDefault("permissions", List.of());
        if (names.isEmpty()) return ResponseEntity.noContent().build();
        List<Permission> perms = permissionRepository.findAll().stream().filter(p -> names.contains(p.getName())).collect(Collectors.toList());
        perms.forEach(p -> jdbc.update("INSERT INTO role_template_permissions(template_id, permission_id) VALUES (?,?) ON CONFLICT DO NOTHING", templateId, p.getId()));
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{templateId}/permissions")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    public ResponseEntity<Void> removePermissions(@PathVariable UUID templateId, @RequestBody Map<String, List<String>> body) {
        List<String> names = body.getOrDefault("permissions", List.of());
        if (names.isEmpty()) return ResponseEntity.noContent().build();
        List<Permission> perms = permissionRepository.findAll().stream().filter(p -> names.contains(p.getName())).collect(Collectors.toList());
        perms.forEach(p -> jdbc.update("DELETE FROM role_template_permissions WHERE template_id=? AND permission_id=?", templateId, p.getId()));
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/{templateId}/materialize-role")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    @Transactional
    public ResponseEntity<Map<String, Object>> materializeRole(@PathVariable UUID templateId, @RequestBody Map<String, String> body) {
        String roleName = Objects.requireNonNull(body.get("roleName"));
        Role role = roleRepository.findByName(roleName).orElseGet(() -> {
            Role r = new Role();
            r.setName(roleName);
            return roleRepository.save(r);
        });
        // Fetch template permissions
        List<UUID> permIds = jdbc.query("SELECT permission_id FROM role_template_permissions WHERE template_id=?", (rs, i) -> UUID.fromString(rs.getString(1)), templateId);
        if (!permIds.isEmpty()) {
            List<Permission> perms = permissionRepository.findAll().stream().filter(p -> permIds.contains(p.getId())).collect(Collectors.toList());
            role.getPermissions().addAll(perms);
            roleRepository.save(role);
        }
        return ResponseEntity.ok(Map.of("role", role.getName(), "permissions", role.getPermissions().stream().map(Permission::getName).collect(Collectors.toSet())));
    }

    @GetMapping
    @PreAuthorize("hasPermission(null, 'rbac.read')")
    public ResponseEntity<List<Map<String, Object>>> listTemplates() {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT id, name, description FROM role_templates ORDER BY name ASC");
        return ResponseEntity.ok(rows);
    }

    @DeleteMapping("/{templateId}")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    public ResponseEntity<Void> deleteTemplate(@PathVariable UUID templateId) {
        jdbc.update("DELETE FROM role_templates WHERE id=?", templateId);
        return ResponseEntity.noContent().build();
    }
}


