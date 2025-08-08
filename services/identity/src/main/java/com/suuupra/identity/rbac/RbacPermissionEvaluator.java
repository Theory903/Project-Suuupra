package com.suuupra.identity.rbac;

import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.io.Serializable;

@Component
public class RbacPermissionEvaluator implements PermissionEvaluator {

    private final PermissionService permissionService;

    public RbacPermissionEvaluator(PermissionService permissionService) {
        this.permissionService = permissionService;
    }

    @Override
    public boolean hasPermission(Authentication authentication, Object targetDomainObject, Object permission) {
        if (authentication == null || permission == null) return false;
        String username = authentication.getName();
        String perm = permission.toString();
        return permissionService.userHasPermissionByEmail(username, perm);
    }

    @Override
    public boolean hasPermission(Authentication authentication, Serializable targetId, String targetType, Object permission) {
        return hasPermission(authentication, (Object) targetType, permission);
    }
}
