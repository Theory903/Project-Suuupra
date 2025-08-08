package com.suuupra.identity.config;

import com.suuupra.identity.rbac.RbacPermissionEvaluator;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.config.annotation.method.configuration.GlobalMethodSecurityConfiguration;

// Optional explicit wiring if needed in your Spring version
@Configuration
public class MethodSecurityConfig extends GlobalMethodSecurityConfiguration {
    private final RbacPermissionEvaluator evaluator;
    public MethodSecurityConfig(RbacPermissionEvaluator evaluator) {
        this.evaluator = evaluator;
    }

    @Override
    protected DefaultMethodSecurityExpressionHandler createExpressionHandler() {
        DefaultMethodSecurityExpressionHandler handler = new DefaultMethodSecurityExpressionHandler();
        handler.setPermissionEvaluator(evaluator);
        return handler;
    }
}


