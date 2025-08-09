package com.suuupra.identity.mfa;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class StepUpService {

    private final StringRedisTemplate redis;

    public StepUpService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void markSatisfied(String sessionId, long ttlSeconds) {
        if (sessionId == null) return;
        redis.opsForValue().set(key(sessionId), "1", Duration.ofSeconds(ttlSeconds));
    }

    public boolean isSatisfied(String sessionId) {
        if (sessionId == null) return false;
        Boolean exists = redis.hasKey(key(sessionId));
        return Boolean.TRUE.equals(exists);
    }

    private String key(String sessionId) { return "stepup:" + sessionId; }
}


