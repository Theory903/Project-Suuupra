package com.suuupra.identity.tenant;

import com.suuupra.identity.security.RequireDPoP;
import com.suuupra.identity.security.RequireResources;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/tenants")
@RequireResources({"resource://identity.admin"})
@RequireDPoP
public class TenantDelegatedAdminController {

    private final JdbcTemplate jdbc;

    public TenantDelegatedAdminController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostMapping("/{tenantId}/admins/{userId}")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    public ResponseEntity<Void> addDelegatedAdmin(@PathVariable UUID tenantId, @PathVariable UUID userId) {
        jdbc.update("INSERT INTO tenant_admins(tenant_id, user_id) VALUES (?,?) ON CONFLICT DO NOTHING", tenantId, userId);
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/{tenantId}/admins/{userId}")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    public ResponseEntity<Void> removeDelegatedAdmin(@PathVariable UUID tenantId, @PathVariable UUID userId) {
        jdbc.update("DELETE FROM tenant_admins WHERE tenant_id=? AND user_id=?", tenantId, userId);
        return ResponseEntity.noContent().build();
    }

    @GetMapping("/{tenantId}/admins")
    @PreAuthorize("hasPermission(null, 'rbac.read')")
    public ResponseEntity<List<Map<String, Object>>> listDelegatedAdmins(@PathVariable UUID tenantId) {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT user_id, created_at FROM tenant_admins WHERE tenant_id=? ORDER BY created_at DESC", tenantId);
        return ResponseEntity.ok(rows);
    }
}


