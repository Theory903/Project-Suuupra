package com.suuupra.identity.rbac;

import org.springframework.cache.Cache;
import org.springframework.cache.CacheManager;
import org.springframework.stereotype.Component;

@Component
public class PermissionCacheEvictor {

    private final CacheManager cacheManager;
    private final PermissionCacheIndex cacheIndex;

    public PermissionCacheEvictor(CacheManager cacheManager, PermissionCacheIndex cacheIndex) {
        this.cacheManager = cacheManager;
        this.cacheIndex = cacheIndex;
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
}
