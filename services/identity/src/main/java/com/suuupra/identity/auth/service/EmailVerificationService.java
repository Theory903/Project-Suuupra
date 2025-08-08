package com.suuupra.identity.auth.service;

import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.util.UUID;

@Service
public class EmailVerificationService {

    private final StringRedisTemplate redis;

    public EmailVerificationService(StringRedisTemplate redis) {
        this.redis = redis;
    }

    public String createVerificationToken(String email) {
        String token = UUID.randomUUID().toString();
        redis.opsForValue().set(keyFor(token), email, Duration.ofHours(24));
        return token;
    }

    public String verifyToken(String token) {
        String email = redis.opsForValue().get(keyFor(token));
        if (email == null) throw new IllegalArgumentException("Invalid or expired verification token");
        redis.delete(keyFor(token));
        return email;
    }

    private String keyFor(String token) {
        return "ev:" + token;
    }
}
