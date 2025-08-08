package com.suuupra.identity.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Service
public class RefreshTokenService {

    private final StringRedisTemplate redis;
    private final long refreshTtlSeconds;

    public RefreshTokenService(StringRedisTemplate redis,
                               @Value("${security.jwt.refresh-ttl-seconds:2592000}") long refreshTtlSeconds) {
        this.redis = redis;
        this.refreshTtlSeconds = refreshTtlSeconds;
    }

    public String issueRefreshToken(UUID userId, String sid) {
        String token = UUID.randomUUID().toString();
        String key = keyFor(token);
        redis.opsForValue().set(key, userId.toString() + ":" + sid, Duration.ofSeconds(refreshTtlSeconds));
        return token;
    }

    public ParsedRefresh validateAndRotateRefreshToken(String token) {
        String key = keyFor(token);
        String value = redis.opsForValue().get(key);
        if (value == null) {
            throw new IllegalArgumentException("Invalid or expired refresh token");
        }
        // Revoke old
        redis.delete(key);
        String[] parts = value.split(":", 2);
        return new ParsedRefresh(UUID.fromString(parts[0]), parts.length > 1 ? parts[1] : null);
    }

    public void revokeRefreshToken(String token) {
        redis.delete(keyFor(token));
    }

    private String keyFor(String token) {
        return "rt:" + token;
    }

    public record ParsedRefresh(UUID userId, String sid) {}
}
