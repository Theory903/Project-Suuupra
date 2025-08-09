package com.suuupra.identity.security;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class DpopReplayService {
    private final StringRedisTemplate redis;

    public DpopReplayService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public boolean isReplay(String jti) {
        if (jti == null || jti.isBlank()) return true;
        return Boolean.TRUE.equals(redis.hasKey(key(jti)));
    }

    public void mark(String jti, long secondsTtl) {
        if (jti == null || jti.isBlank()) return;
        redis.opsForValue().set(key(jti), "1", Duration.ofSeconds(Math.max(1, secondsTtl)));
    }

    private static String key(String jti) { return "dpop:jti:" + jti; }
}


