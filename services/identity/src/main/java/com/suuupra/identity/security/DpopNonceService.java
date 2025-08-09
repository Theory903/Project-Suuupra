package com.suuupra.identity.security;

import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.time.Duration;
import java.util.Base64;

@Service
public class DpopNonceService {
    private final StringRedisTemplate redis;
    private final SecureRandom random = new SecureRandom();
    private final Counter issuedCounter;

    public DpopNonceService(StringRedisTemplate redis, MeterRegistry meterRegistry) {
        this.redis = redis;
        this.issuedCounter = Counter.builder("dpop_nonces_issued_total").register(meterRegistry);
    }

    public String issue(String key, Duration ttl) {
        byte[] buf = new byte[24];
        random.nextBytes(buf);
        String nonce = Base64.getUrlEncoder().withoutPadding().encodeToString(buf);
        redis.opsForValue().set("dpop:nonce:" + key + ":" + nonce, "1", ttl);
        issuedCounter.increment();
        return nonce;
    }

    public boolean validate(String key, String nonce) {
        if (nonce == null || nonce.isBlank()) return false;
        String redisKey = "dpop:nonce:" + key + ":" + nonce;
        Boolean exists = redis.hasKey(redisKey);
        if (Boolean.TRUE.equals(exists)) {
            redis.delete(redisKey);
            return true;
        }
        return false;
    }
}


