package com.suuupra.identity.auth.service;

import com.suuupra.identity.auth.entity.Session;
import com.suuupra.identity.auth.repository.SessionRepository;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.data.redis.core.StringRedisTemplate;
import org.springframework.stereotype.Service;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Service
public class SessionService {

    private final StringRedisTemplate redis;
    private final long sessionTtlSeconds;
    private final SessionRepository sessionRepository;

    public SessionService(StringRedisTemplate redis,
                          SessionRepository sessionRepository,
                          @Value("${security.jwt.refresh-ttl-seconds:2592000}") long sessionTtlSeconds) {
        this.redis = redis;
        this.sessionRepository = sessionRepository;
        this.sessionTtlSeconds = sessionTtlSeconds;
    }

    public String createSession() {
        String sid = java.util.UUID.randomUUID().toString();
        setVersion(sid, 1);
        return sid;
    }

    public void setVersion(String sid, int version) {
        redis.opsForValue().set(keyFor(sid), Integer.toString(version), Duration.ofSeconds(sessionTtlSeconds));
    }

    public int getCurrentVersion(String sid) {
        String v = redis.opsForValue().get(keyFor(sid));
        if (v == null) return 0;
        return Integer.parseInt(v);
    }

    public int incrementVersion(String sid) {
        Long val = redis.opsForValue().increment(keyFor(sid));
        if (val == null) return 0;
        redis.expire(keyFor(sid), Duration.ofSeconds(sessionTtlSeconds));
        return val.intValue();
    }

    public List<Session> listUserSessions(UUID userId) {
        return sessionRepository.findByUserId(userId);
    }

    public void persistSession(UUID sid, UUID userId, UUID jti, Instant expiresAt, String userAgent, String ipAddress) {
        Session s = new Session();
        s.setId(sid);
        s.setUserId(userId);
        s.setJti(jti);
        s.setExpiresAt(expiresAt);
        s.setUserAgent(userAgent);
        s.setIpAddress(ipAddress);
        sessionRepository.save(s);
    }

    public void revokeSession(UUID sid) {
        sessionRepository.findById(sid).ifPresent(s -> {
            s.setRevokedAt(Instant.now());
            sessionRepository.save(s);
            incrementVersion(sid.toString());
        });
    }

    private String keyFor(String sid) {
        return "sv:" + sid;
    }
}
