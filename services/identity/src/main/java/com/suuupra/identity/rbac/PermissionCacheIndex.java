package com.suuupra.identity.rbac;

import org.springframework.stereotype.Component;

import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@Component
public class PermissionCacheIndex {

    private final ConcurrentHashMap<String, Set<String>> keysByUser = new ConcurrentHashMap<>();
    private final ConcurrentHashMap<String, Set<String>> keysByTenant = new ConcurrentHashMap<>();

    public void recordKey(String email, String permissionName, String tenant) {
        String key = composeKey(email, permissionName, tenant);
        keysByUser.computeIfAbsent(email, e -> ConcurrentHashMap.newKeySet()).add(key);
        if (tenant != null) {
            keysByTenant.computeIfAbsent(tenant, t -> ConcurrentHashMap.newKeySet()).add(key);
        }
    }

    public Set<String> keysForUser(String email) {
        return keysByUser.getOrDefault(email, Set.of());
    }

    public Set<String> keysForTenant(String tenant) {
        return keysByTenant.getOrDefault(tenant, Set.of());
    }

    public void removeKeysForUser(String email) {
        keysByUser.remove(email);
    }

    public void removeKeysForTenant(String tenant) {
        keysByTenant.remove(tenant);
    }

    public static String composeKey(String email, String permissionName, String tenant) {
        // Must match @Cacheable SpEL key in PermissionService
        return email + "|" + String.valueOf(permissionName) + "|" + tenant;
    }
}
