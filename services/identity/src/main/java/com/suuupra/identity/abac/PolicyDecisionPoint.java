package com.suuupra.identity.abac;

import org.springframework.security.core.Authentication;

public interface PolicyDecisionPoint {
    boolean allow(Authentication authentication, String tenantId, String resource, String action);
}


