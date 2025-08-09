package com.suuupra.identity.abac;

import com.fasterxml.jackson.databind.JsonNode;
import com.fasterxml.jackson.databind.ObjectMapper;
import io.micrometer.core.instrument.MeterRegistry;
import io.micrometer.core.instrument.Timer;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.concurrent.ConcurrentHashMap;
import java.util.stream.Collectors;

@Service
public class PolicyService {

    private final JdbcTemplate jdbc;
    private final ObjectMapper objectMapper;
    private final MeterRegistry meterRegistry;
    private final StringRedisTemplate redis;

    // Cache compiled policies per tenantKey (tenantId or "GLOBAL")
    private final ConcurrentHashMap<String, CachedPolicies> cache = new ConcurrentHashMap<>();

    public PolicyService(JdbcTemplate jdbc, ObjectMapper objectMapper, MeterRegistry meterRegistry, StringRedisTemplate redis) {
        this.jdbc = jdbc;
        this.objectMapper = objectMapper;
        this.meterRegistry = meterRegistry;
        this.redis = redis;
    }

    public List<JsonNode> loadEnabledPoliciesForTenant(String tenantId) {
        String key = tenantId == null ? "GLOBAL" : tenantId;
        CachedPolicies cached = cache.get(key);
        if (cached != null && !cached.isStale()) {
            return cached.policies();
        }
        List<JsonNode> globals = queryPolicies(null);
        List<JsonNode> tenant = tenantId == null ? List.of() : queryPolicies(tenantId);
        List<JsonNode> merged = new ArrayList<>(globals.size() + tenant.size());
        merged.addAll(globals);
        merged.addAll(tenant);
        cache.put(key, new CachedPolicies(merged, Instant.now()));
        meterRegistry.counter("abac_policy_cache_loads_total").increment();
        return merged;
    }

    public void evictTenant(String tenantId) {
        cache.remove(tenantId == null ? "GLOBAL" : tenantId);
        // Notify other nodes
        String key = tenantId == null ? "GLOBAL" : tenantId;
        try { redis.convertAndSend("policy:evict", key); } catch (Exception ignored) {}
    }

    private List<JsonNode> queryPolicies(String tenantId) {
        String sql = "SELECT definition, mode FROM policies WHERE is_enabled=TRUE AND (tenant_id %s) ORDER BY version DESC, updated_at DESC";
        String predicate = tenantId == null ? "IS NULL" : "= ?";
        List<Map<String, Object>> rows = tenantId == null
            ? jdbc.queryForList(String.format(sql, predicate))
            : jdbc.queryForList(String.format(sql, predicate), java.util.UUID.fromString(tenantId));
        return rows.stream().map(m -> {
            try {
                JsonNode node = objectMapper.readTree((String) m.get("definition"));
                ((com.fasterxml.jackson.databind.node.ObjectNode) node).put("__mode", String.valueOf(m.get("mode")));
                return node;
            } catch (Exception e) { return null; }
        }).filter(Objects::nonNull).collect(Collectors.toList());
    }

    private record CachedPolicies(List<JsonNode> policies, Instant loadedAt) {
        boolean isStale() {
            // Simple TTL: 10 seconds
            return Instant.now().isAfter(loadedAt.plusSeconds(10));
        }
    }
}


