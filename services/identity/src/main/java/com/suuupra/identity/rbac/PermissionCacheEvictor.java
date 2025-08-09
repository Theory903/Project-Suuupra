package com.suuupra.identity.rbac;

import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;
import org.springframework.data.redis.core.StringRedisTemplate;
import jakarta.annotation.PostConstruct;

@Component
public class PermissionCacheEvictor {

    private final CacheManager cacheManager;
    private final PermissionCacheIndex cacheIndex;
    private final StringRedisTemplate redis;

    public PermissionCacheEvictor(CacheManager cacheManager, PermissionCacheIndex cacheIndex, StringRedisTemplate redis) {
        this.cacheManager = cacheManager;
        this.cacheIndex = cacheIndex;
        this.redis = redis;
    }

    public void evictAll() {
        Cache cache = cacheManager.getCache("permChecks");
        if (cache != null) {
            cache.clear();
        }
    }

    public void evictForUser(String email) {
        Cache cache = cacheManager.getCache("permChecks");
        if (cache == null) return;
        for (String key : cacheIndex.keysForUser(email)) {
            cache.evict(key);
        }
        cacheIndex.removeKeysForUser(email);
    }

    public void evictForTenant(String tenantId) {
        Cache cache = cacheManager.getCache("permChecks");
        if (cache == null) return;
        for (String key : cacheIndex.keysForTenant(tenantId)) {
            cache.evict(key);
        }
        cacheIndex.removeKeysForTenant(tenantId);
    }

    @PostConstruct
    void subscribeInvalidations() {
        var connectionFactory = redis.getConnectionFactory();
        if (connectionFactory == null) return;
        var connection = connectionFactory.getConnection();
        connection.subscribe((message, channel) -> {
            String ch = new String(channel);
            String payload = new String(message.getBody());
            Cache cache = cacheManager.getCache("permChecks");
            if (cache == null) return;
            if (ch.endsWith("authz:evict:user")) {
                for (String key : cacheIndex.keysForUser(payload)) {
                    cache.evict(key);
                }
                cacheIndex.removeKeysForUser(payload);
            }
            if (ch.endsWith("authz:evict:tenant")) {
                for (String key : cacheIndex.keysForTenant(payload)) {
                    cache.evict(key);
                }
                cacheIndex.removeKeysForTenant(payload);
            }
        }, "authz:evict:user".getBytes(), "authz:evict:tenant".getBytes());
    }
}
