package com.suuupra.identity.abac;

import jakarta.annotation.PostConstruct;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Component;

@Component
public class PolicyInvalidationSubscriber {
    private final StringRedisTemplate redis;
    private final PolicyService policyService;

    public PolicyInvalidationSubscriber(StringRedisTemplate redis, PolicyService policyService) {
        this.redis = redis;
        this.policyService = policyService;
    }

    @PostConstruct
    void init() {
        var cf = redis.getConnectionFactory();
        if (cf == null) return;
        var conn = cf.getConnection();
        conn.subscribe((message, channel) -> {
            String tenantKey = new String(message.getBody());
            policyService.evictTenant("GLOBAL".equals(tenantKey) ? null : tenantKey);
        }, "policy:evict".getBytes());
    }
}


