package com.suuupra.identity.security;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.cert.X509Certificate;

@Component
public class MtlsEnforcementFilter extends OncePerRequestFilter {

    private final Counter mtlsFailures;

    public MtlsEnforcementFilter(MeterRegistry meterRegistry) {
        this.mtlsFailures = Counter.builder("mtls_enforcement_failures_total").register(meterRegistry);
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain) throws ServletException, IOException {
        RequireMtls ann = findAnnotation(request);
        if (ann == null) {
            filterChain.doFilter(request, response);
            return;
        }
        X509Certificate[] certs = (X509Certificate[]) request.getAttribute("jakarta.servlet.request.X509Certificate");
        if (certs == null || certs.length == 0) {
            mtlsFailures.increment();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setHeader("WWW-Authenticate", "MutualTLS");
            return;
        }
        filterChain.doFilter(request, response);
    }

    private RequireMtls findAnnotation(HttpServletRequest request) {
        Object handler = request.getAttribute("org.springframework.web.servlet.HandlerMapping.bestMatchingHandler");
        if (handler == null) return null;
        try {
            Class<?> handlerClass = handler.getClass();
            return AnnotatedElementUtils.findMergedAnnotation(handlerClass, RequireMtls.class);
        } catch (Exception e) {
            return null;
        }
    }
}


