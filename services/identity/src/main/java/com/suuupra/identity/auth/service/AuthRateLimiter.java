package com.suuupra.identity.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class AuthRateLimiter {

    private final StringRedisTemplate redis;
    private final int maxPerMinute;

    public AuthRateLimiter(StringRedisTemplate redis,
                           @Value("${security.auth.rate-limit-per-minute:60}") int maxPerMinute) {
        this.redis = redis;
        this.maxPerMinute = maxPerMinute;
    }

    public boolean allow(String key) {
        String redisKey = "rl:" + key + ":" + (System.currentTimeMillis() / 60000L);
        Long count = redis.opsForValue().increment(redisKey);
        if (count != null && count == 1L) {
            redis.expire(redisKey, Duration.ofMinutes(1));
        }
        return count != null && count <= maxPerMinute;
    }
}


