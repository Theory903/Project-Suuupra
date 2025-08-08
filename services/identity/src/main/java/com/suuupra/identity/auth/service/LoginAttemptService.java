package com.suuupra.identity.auth.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;

@Service
public class LoginAttemptService {

    private final StringRedisTemplate redis;

    public LoginAttemptService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public void recordFailure(String email) {
        String key = key(email);
        Long failures = redis.opsForValue().increment(key);
        if (failures != null && failures == 1) {
            redis.expire(key, Duration.ofMinutes(30));
        }
    }

    public long failures(String email) {
        String v = redis.opsForValue().get(key(email));
        return v == null ? 0 : Long.parseLong(v);
    }

    public long backoffSeconds(String email) {
        long f = failures(email);
        if (f <= 3) return 0;
        long exp = (long) Math.min(300, Math.pow(2, f - 3));
        return exp;
    }

    public void reset(String email) {
        redis.delete(key(email));
    }

    private String key(String email) { return "la:" + email; }
}


