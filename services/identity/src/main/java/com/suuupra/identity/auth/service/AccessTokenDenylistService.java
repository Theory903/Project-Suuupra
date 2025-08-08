package com.suuupra.identity.auth.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class AccessTokenDenylistService {

    private final StringRedisTemplate redis;

    public AccessTokenDenylistService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void revokeJti(String jti, long secondsUntilExpiry) {
        if (jti == null) return;
        String key = keyFor(jti);
        redis.opsForValue().set(key, "1", Duration.ofSeconds(Math.max(1, secondsUntilExpiry)));
    }

    public boolean isRevoked(String jti) {
        if (jti == null) return false;
        return Boolean.TRUE.equals(redis.hasKey(keyFor(jti)));
    }

    private String keyFor(String jti) {
        return "bl:jti:" + jti;
    }
}
