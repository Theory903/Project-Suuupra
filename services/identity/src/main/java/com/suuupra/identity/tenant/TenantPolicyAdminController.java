package com.suuupra.identity.tenant;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.suuupra.identity.abac.PolicyService;
import org.springframework.http.ResponseEntity;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.security.access.prepost.PreAuthorize;
import com.suuupra.identity.security.RequireDPoP;
import com.suuupra.identity.security.RequireResources;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/policies")
@RequireResources({"resource://identity.admin"})
public class TenantPolicyAdminController {

    private final JdbcTemplate jdbc;
    private final PolicyService policyService;
    private final ObjectMapper objectMapper;

    public TenantPolicyAdminController(JdbcTemplate jdbc, PolicyService policyService, ObjectMapper objectMapper) {
        this.jdbc = jdbc;
        this.policyService = policyService;
        this.objectMapper = objectMapper;
    }

    @PostMapping
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    @RequireDPoP
    public ResponseEntity<Map<String, Object>> create(@RequestBody Map<String, Object> body) throws Exception {
        String tenantId = (String) body.getOrDefault("tenantId", null);
        String name = (String) body.get("name");
        Object def = body.get("definition");
        boolean enabled = body.getOrDefault("enabled", Boolean.TRUE).equals(Boolean.TRUE);
        String mode = (String) body.getOrDefault("mode", "enforce");
        JsonNode json = objectMapper.valueToTree(def);
        UUID id = UUID.randomUUID();
        if (tenantId == null || tenantId.isBlank()) {
            jdbc.update("INSERT INTO policies(id, tenant_id, name, definition, is_enabled, mode) VALUES (?,?,?,?,?,?)",
                id, null, name, json.toString(), enabled, mode);
        } else {
            jdbc.update("INSERT INTO policies(id, tenant_id, name, definition, is_enabled, mode) VALUES (?,?,?,?,?,?)",
                id, UUID.fromString(tenantId), name, json.toString(), enabled, mode);
        }
        policyService.evictTenant(tenantId);
        return ResponseEntity.ok(Map.of("id", id, "name", name, "tenantId", tenantId));
    }

    @PutMapping("/{id}")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    @RequireDPoP
    public ResponseEntity<Void> update(@PathVariable UUID id, @RequestBody Map<String, Object> body) throws Exception {
        String tenantId = (String) body.getOrDefault("tenantId", null);
        Object def = body.get("definition");
        Boolean enabled = (Boolean) body.get("enabled");
        String set = "";
        if (def != null) set += "definition='" + objectMapper.valueToTree(def).toString().replace("'", "''") + "',";
        if (enabled != null) set += "is_enabled=" + (enabled ? "TRUE" : "FALSE") + ",";
        if (body.containsKey("mode")) set += "mode='" + ((String) body.get("mode")).replace("'", "''") + "',";
        if (set.endsWith(",")) set = set.substring(0, set.length()-1);
        if (!set.isEmpty()) {
            jdbc.update("UPDATE policies SET " + set + ", updated_at=NOW() WHERE id=?", id);
            policyService.evictTenant(tenantId);
        }
        return ResponseEntity.noContent().build();
    }
}


