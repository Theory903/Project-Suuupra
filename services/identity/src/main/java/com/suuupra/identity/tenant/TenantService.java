package com.suuupra.identity.tenant;

import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.util.List;
import java.util.UUID;

@Service
public class TenantService {

    private final JdbcTemplate jdbc;

    public TenantService(JdbcTemplate jdbc) {
        this.jdbc = jdbc;
    }

    public UUID createTenant(String name) {
        UUID id = UUID.randomUUID();
        jdbc.update("INSERT INTO tenants (id, name) VALUES (?, ?) ON CONFLICT (name) DO NOTHING", id, name);
        return id;
    }

    public void assignRole(UUID userId, UUID roleId, UUID tenantId) {
        jdbc.update(
            "INSERT INTO user_roles_tenant (user_id, role_id, tenant_id) VALUES (?,?,?) ON CONFLICT DO NOTHING",
            userId, roleId, tenantId
        );
    }

    public void removeRole(UUID userId, UUID roleId, UUID tenantId) {
        jdbc.update(
            "DELETE FROM user_roles_tenant WHERE user_id=? AND role_id=? AND tenant_id=?",
            userId, roleId, tenantId
        );
    }

    public List<String> listRoleNamesForUser(UUID userId, UUID tenantId) {
        return jdbc.query(
            "SELECT r.name FROM user_roles_tenant urt JOIN roles r ON urt.role_id = r.id WHERE urt.user_id=? AND urt.tenant_id=?",
            (rs, i) -> rs.getString(1), userId, tenantId
        );
    }
}
