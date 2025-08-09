package com.suuupra.identity.auth.jwt;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import com.suuupra.identity.keys.SigningKeyService;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
 
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
 
import java.text.ParseException;
import java.time.Instant;
 
import java.util.Date;
import java.util.Map;
import java.util.UUID;
import java.util.Set;
import java.util.List;
import java.util.stream.Collectors;

@Service
public class JwtService {

    @Value("${security.jwt.issuer:suuupra-identity}")
    private String issuer;

    @Value("${security.jwt.audience:suuupra-api}")
    private String audience;

    @Value("${security.jwt.access-ttl-seconds:900}")
    private long accessTokenTtlSeconds;

    // legacy PEMs no longer used; keys are provided via SigningKeyService

    private final SigningKeyService signingKeyService;

    public JwtService(SigningKeyService signingKeyService) {
        this.signingKeyService = signingKeyService;
    }

    @PostConstruct
    public void initializeKeys() {}

    public String generateAccessToken(String subject, String[] roles, Map<String, Object> additionalClaims) {
        Instant now = Instant.now();
        Instant exp = now.plusSeconds(accessTokenTtlSeconds);

        JWTClaimsSet.Builder builder = new JWTClaimsSet.Builder()
            .jwtID(UUID.randomUUID().toString())
            .issuer(issuer)
            .audience(audience)
            .subject(subject)
            .issueTime(Date.from(now))
            .expirationTime(Date.from(exp))
            .claim("roles", roles);

        if (additionalClaims != null) {
            additionalClaims.forEach(builder::claim);
        }

        JWTClaimsSet claims = builder.build();
        try {
            JWSHeader header = new JWSHeader.Builder(JWSAlgorithm.ES256)
                .type(JOSEObjectType.JWT)
                .keyID(signingKeyService.getCurrentKid())
                .build();
            SignedJWT signedJWT = new SignedJWT(header, claims);
            JWSSigner signer = new ECDSASigner(signingKeyService.getCurrentPrivateKey());
            signedJWT.sign(signer);
            return signedJWT.serialize();
        } catch (JOSEException e) {
            throw new RuntimeException("Failed to sign JWT", e);
        }
    }

    public String extractJti(String token) throws ParseException {
        SignedJWT jwt = SignedJWT.parse(token);
        return jwt.getJWTClaimsSet().getJWTID();
    }

    public long secondsUntilExpiry(String token) throws ParseException {
        SignedJWT jwt = SignedJWT.parse(token);
        Date exp = jwt.getJWTClaimsSet().getExpirationTime();
        long seconds = (exp.getTime() - System.currentTimeMillis()) / 1000L;
        return Math.max(0L, seconds);
    }

    public boolean isTokenValid(String token) {
        try {
            SignedJWT jwt = SignedJWT.parse(token);
            JWSVerifier verifier = new ECDSAVerifier(signingKeyService.getCurrentPublicKey());
            boolean sigOk = jwt.verify(verifier);
            Date exp = jwt.getJWTClaimsSet().getExpirationTime();
            boolean notExpired = exp != null && exp.after(new Date());
            // Enforce audience
            var auds = jwt.getJWTClaimsSet().getAudience();
            boolean audOk = auds != null && auds.contains(audience);
            return sigOk && notExpired && audOk;
        } catch (Exception e) {
            return false;
        }
    }

    public String extractSubject(String token) throws ParseException {
        SignedJWT jwt = SignedJWT.parse(token);
        return jwt.getJWTClaimsSet().getSubject();
    }

    public String extractSessionId(String token) throws ParseException {
        SignedJWT jwt = SignedJWT.parse(token);
        Object sid = jwt.getJWTClaimsSet().getClaim("sid");
        return sid != null ? sid.toString() : null;
    }

    public int extractSessionVersion(String token) throws ParseException {
        SignedJWT jwt = SignedJWT.parse(token);
        Object sv = jwt.getJWTClaimsSet().getClaim("sv");
        if (sv == null) return 0;
        if (sv instanceof Number n) return n.intValue();
        try { return Integer.parseInt(sv.toString()); } catch (Exception e) { return 0; }
    }

    public String extractTenant(String token) throws ParseException {
        SignedJWT jwt = SignedJWT.parse(token);
        Object t = jwt.getJWTClaimsSet().getClaim("tenant");
        return t != null ? t.toString() : null;
    }

    public Set<String> extractScopes(String token) throws ParseException {
        SignedJWT jwt = SignedJWT.parse(token);
        Object scope = jwt.getJWTClaimsSet().getClaim("scope");
        if (scope == null) {
            return Set.of();
        }
        if (scope instanceof String s) {
            if (s.isBlank()) return Set.of();
            return Set.of(s.split(" "));
        }
        if (scope instanceof List<?> list) {
            return list.stream().map(Object::toString).collect(Collectors.toSet());
        }
        return Set.of();
    }

    public String extractCnfJkt(String token) throws ParseException {
        SignedJWT jwt = SignedJWT.parse(token);
        Object cnf = jwt.getJWTClaimsSet().getClaim("cnf");
        if (cnf instanceof Map<?, ?> map) {
            Object jkt = map.get("jkt");
            return jkt != null ? jkt.toString() : null;
        }
        return null;
    }

    public ECPublicKey getEcPublicKey() { return signingKeyService.getCurrentPublicKey(); }
    public String getCurrentKeyId() { return signingKeyService.getCurrentKid(); }
    public ECPrivateKey getEcPrivateKey() { return signingKeyService.getCurrentPrivateKey(); }

    
}
