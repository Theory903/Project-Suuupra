package com.suuupra.identity.audit;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import com.suuupra.identity.common.util.RequestContextProvider;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.Instant;
import java.util.Map;
import java.util.UUID;

@Service
public class AuditLogService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper mapper = new ObjectMapper();
    private final RequestContextProvider requestContextProvider;

    public AuditLogService(JdbcTemplate jdbc, RequestContextProvider requestContextProvider) {
        this.jdbc = jdbc;
        this.requestContextProvider = requestContextProvider;
    }

    public void append(String action, UUID actorUserId, String actorEmail, UUID targetUserId, String tenantId, Map<String, Object> details) {
        String ua = requestContextProvider.getUserAgent();
        String ip = requestContextProvider.getClientIp();
        Instant ts = Instant.now();
        String detailJson = toJson(details);
        String prevHash = lastHash();
        String hash = computeHash(prevHash, ts.toString(), action, actorUserId, actorEmail, targetUserId, tenantId, detailJson, ip, ua);
        jdbc.update(
            "INSERT INTO audit_logs (id, ts, action, actor_user_id, actor_email, target_user_id, tenant_id, detail_json, ip, ua, prev_hash, hash) VALUES (?,?,?,?,?,?,?,?,?,?,?,?)",
            UUID.randomUUID(), ts, action, actorUserId, actorEmail, targetUserId, tenantId, detailJson, ip, ua, prevHash, hash
        );
    }

    private String toJson(Map<String, Object> details) {
        try {
            return mapper.writeValueAsString(details == null ? Map.of() : details);
        } catch (JsonProcessingException e) {
            return "{}";
        }
    }

    private String lastHash() {
        return jdbc.query("SELECT hash FROM audit_logs ORDER BY ts DESC LIMIT 1", rs -> rs.next() ? rs.getString(1) : "");
    }

    private String computeHash(Object... parts) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            for (Object part : parts) {
                if (part == null) continue;
                md.update(part.toString().getBytes(StandardCharsets.UTF_8));
            }
            byte[] digest = md.digest();
            StringBuilder sb = new StringBuilder();
            for (byte b : digest) sb.append(String.format("%02x", b));
            return sb.toString();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
