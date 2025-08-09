package com.suuupra.identity.rbac;

import com.suuupra.identity.security.RequireDPoP;
import com.suuupra.identity.security.RequireResources;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.BatchPreparedStatementSetter;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.sql.PreparedStatement;
import java.sql.SQLException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/memberships")
@RequireResources({"resource://identity.admin"})
@RequireDPoP
public class BulkMembershipAdminController {

    private final JdbcTemplate jdbc;

    public BulkMembershipAdminController(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    @PostMapping("/tenant/{tenantId}/assign")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    public ResponseEntity<Void> bulkAssign(@PathVariable UUID tenantId, @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked") List<String> userIds = (List<String>) body.getOrDefault("userIds", List.of());
        @SuppressWarnings("unchecked") List<String> roleIds = (List<String>) body.getOrDefault("roleIds", List.of());
        if (userIds.isEmpty() || roleIds.isEmpty()) return ResponseEntity.noContent().build();
        jdbc.batchUpdate("INSERT INTO user_roles_tenant(user_id, role_id, tenant_id) VALUES (?,?,?) ON CONFLICT DO NOTHING",
            new BatchPreparedStatementSetter() {
                @Override public void setValues(PreparedStatement ps, int i) throws SQLException {
                    int userIndex = i / roleIds.size();
                    int roleIndex = i % roleIds.size();
                    UUID user = UUID.fromString(userIds.get(userIndex));
                    UUID role = UUID.fromString(roleIds.get(roleIndex));
                    ps.setObject(1, user);
                    ps.setObject(2, role);
                    ps.setObject(3, tenantId);
                }
                @Override public int getBatchSize() { return userIds.size() * roleIds.size(); }
            });
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/tenant/{tenantId}/revoke")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    public ResponseEntity<Void> bulkRevoke(@PathVariable UUID tenantId, @RequestBody Map<String, Object> body) {
        @SuppressWarnings("unchecked") List<String> userIds = (List<String>) body.getOrDefault("userIds", List.of());
        @SuppressWarnings("unchecked") List<String> roleIds = (List<String>) body.getOrDefault("roleIds", List.of());
        if (userIds.isEmpty() || roleIds.isEmpty()) return ResponseEntity.noContent().build();
        for (String u : userIds) {
            for (String r : roleIds) {
                jdbc.update("DELETE FROM user_roles_tenant WHERE user_id=? AND role_id=? AND tenant_id=?", UUID.fromString(u), UUID.fromString(r), tenantId);
            }
        }
        return ResponseEntity.noContent().build();
    }
}


