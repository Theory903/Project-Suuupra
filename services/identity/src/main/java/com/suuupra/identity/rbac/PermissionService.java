package com.suuupra.identity.rbac;

import com.suuupra.identity.common.util.TenantContext;
import com.suuupra.identity.tenant.TenantService;
import com.suuupra.identity.user.entity.Role;
import com.suuupra.identity.user.entity.User;
import com.suuupra.identity.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.cache.annotation.Cacheable;

@Service
public class PermissionService {

    private final UserRepository userRepository;
    private final TenantService tenantService;
    private final PermissionCacheIndex cacheIndex;

    public PermissionService(UserRepository userRepository, TenantService tenantService, PermissionCacheIndex cacheIndex) {
        this.userRepository = userRepository;
        this.tenantService = tenantService;
        this.cacheIndex = cacheIndex;
    }

    @Transactional(readOnly = true)
    @Cacheable(value = "permChecks", key = "#email + '|' + T(java.util.Objects).toString(#permissionName) + '|' + T(com.suuupra.identity.common.util.TenantContext).getTenant()")
    public boolean userHasPermissionByEmail(String email, String permissionName) {
        User user = userRepository.findByEmail(email).orElse(null);
        if (user == null) return false;
        // If tenant-aware, ensure user has membership in current tenant
        String tenant = TenantContext.getTenant();
        cacheIndex.recordKey(email, permissionName, tenant);
        if (tenant != null) {
            // tenant-aware lookup via user_roles_tenant
            // if user has any role in this tenant, evaluate its permissions
            // For simplicity, reuse global role->permission mapping
            var roleNames = tenantService.listRoleNamesForUser(user.getId(), UUID.fromString(tenant));
            for (String roleName : roleNames) {
                for (Role role : user.getRoles()) {
                    if (role.getName().equalsIgnoreCase(roleName)) {
                        boolean match = role.getPermissions().stream().anyMatch(p -> p.getName().equalsIgnoreCase(permissionName));
                        if (match) return true;
                    }
                }
            }
            return false;
        }
        for (Role role : user.getRoles()) {
            // lazy load permissions within transaction
            boolean match = role.getPermissions().stream().anyMatch(p -> p.getName().equalsIgnoreCase(permissionName));
            if (match) return true;
        }
        return false;
    }
}
