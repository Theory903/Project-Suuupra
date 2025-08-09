package com.suuupra.identity.security;

import com.suuupra.identity.auth.jwt.ResourceIndicatorValidator;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.lang.NonNull;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.util.Arrays;
import java.util.List;

@Component
public class ResourceIndicatorFilter extends OncePerRequestFilter {

    private final ResourceIndicatorValidator validator;

    public ResourceIndicatorFilter(ResourceIndicatorValidator validator) {
        this.validator = validator;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain) throws ServletException, IOException {
        RequireResources ann = findAnnotation(request);
        if (ann == null) {
            filterChain.doFilter(request, response);
            return;
        }
        String auth = request.getHeader("Authorization");
        String token = extractBearer(auth);
        if (token == null) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            return;
        }
        List<String> required = Arrays.asList(ann.value());
        if (!validator.validateResources(token, required)) {
            response.setStatus(HttpServletResponse.SC_FORBIDDEN);
            return;
        }
        filterChain.doFilter(request, response);
    }

    private static String extractBearer(String authorization) {
        if (authorization == null) return null;
        String prefix = "Bearer ";
        if (authorization.regionMatches(true, 0, prefix, 0, prefix.length())) {
            return authorization.substring(prefix.length()).trim();
        }
        return null;
    }

    private RequireResources findAnnotation(HttpServletRequest request) {
        Object handler = request.getAttribute("org.springframework.web.servlet.HandlerMapping.bestMatchingHandler");
        if (handler == null) return null;
        try {
            Class<?> handlerClass = handler.getClass();
            return AnnotatedElementUtils.findMergedAnnotation(handlerClass, RequireResources.class);
        } catch (Exception e) {
            return null;
        }
    }
}


