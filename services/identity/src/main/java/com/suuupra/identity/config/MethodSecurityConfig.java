package com.suuupra.identity.config;

import com.suuupra.identity.rbac.CompositePermissionEvaluator;
import org.springframework.context.annotation.Configuration;
import org.springframework.security.access.expression.method.DefaultMethodSecurityExpressionHandler;
import org.springframework.security.config.annotation.method.configuration.EnableMethodSecurity;
import org.springframework.context.annotation.Bean;

// Optional explicit wiring if needed in your Spring version
@Configuration
@EnableMethodSecurity
public class MethodSecurityConfig {
    private final CompositePermissionEvaluator evaluator;
    public MethodSecurityConfig(CompositePermissionEvaluator evaluator) {
        this.evaluator = evaluator;
    }

    @Bean
    public DefaultMethodSecurityExpressionHandler methodSecurityExpressionHandler() {
        DefaultMethodSecurityExpressionHandler handler = new DefaultMethodSecurityExpressionHandler();
        handler.setPermissionEvaluator(evaluator);
        return handler;
    }
}


