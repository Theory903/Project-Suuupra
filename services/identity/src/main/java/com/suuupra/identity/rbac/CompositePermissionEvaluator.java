package com.suuupra.identity.rbac;

import com.suuupra.identity.abac.PolicyDecisionPoint;
import com.suuupra.identity.common.util.TenantContext;
import org.springframework.security.access.PermissionEvaluator;
import org.springframework.security.core.Authentication;
import org.springframework.stereotype.Component;

import java.io.Serializable;

@Component
public class CompositePermissionEvaluator implements PermissionEvaluator {

    private final PermissionService rbacService;
    private final PolicyDecisionPoint pdp;

    public CompositePermissionEvaluator(PermissionService rbacService, PolicyDecisionPoint pdp) {
        this.rbacService = rbacService;
        this.pdp = pdp;
    }

    @Override
    public boolean hasPermission(Authentication authentication, Object targetDomainObject, Object permission) {
        if (authentication == null || permission == null) return false;
        String email = authentication.getName();
        String perm = permission.toString();
        String tenant = TenantContext.getTenant();

        boolean rbac = rbacService.userHasPermissionByEmail(email, perm);
        if (!rbac) return false;

        return pdp.allow(authentication, tenant, String.valueOf(targetDomainObject), perm);
    }

    @Override
    public boolean hasPermission(Authentication authentication, Serializable targetId, String targetType, Object permission) {
        return hasPermission(authentication, (Object) targetType, permission);
    }
}


