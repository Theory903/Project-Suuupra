package com.suuupra.identity.security;

import com.suuupra.identity.common.util.TenantContext;
import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.lang.NonNull;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.time.Duration;

@Component
public class RateLimiterFilter extends OncePerRequestFilter {

    private final StringRedisTemplate redis;
    private final int defaultPerMinute;

    public RateLimiterFilter(StringRedisTemplate redis,
                             @Value("${security.ratelimit.per-minute:120}") int defaultPerMinute) {
        this.redis = redis;
        this.defaultPerMinute = defaultPerMinute;
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain) throws ServletException, IOException {
        String ip = clientIp(request);
        String route = request.getRequestURI();
        String tenant = TenantContext.getTenant();
        String key = String.format("rl:%s:%s:%s", route, tenant == null ? "_" : tenant, ip);
        try {
            Long v = redis.opsForValue().increment(key);
            if (v != null && v == 1L) {
                redis.expire(key, Duration.ofMinutes(1));
            }
            if (v != null && v > defaultPerMinute) {
                response.setStatus(429);
                response.setHeader("Retry-After", "60");
                return;
            }
        } catch (Exception ignored) {}
        filterChain.doFilter(request, response);
    }

    private static String clientIp(HttpServletRequest req) {
        String xff = req.getHeader("X-Forwarded-For");
        if (xff != null && !xff.isBlank()) return xff.split(",")[0].trim();
        String xri = req.getHeader("X-Real-IP");
        if (xri != null && !xri.isBlank()) return xri;
        return req.getRemoteAddr();
    }
}


