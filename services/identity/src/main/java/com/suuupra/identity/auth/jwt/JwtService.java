package com.suuupra.identity.auth.jwt;

import com.nimbusds.jose.*;
import com.nimbusds.jose.crypto.ECDSASigner;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jwt.JWTClaimsSet;
import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import jakarta.annotation.PostConstruct;
import java.security.*;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.text.ParseException;
import java.time.Instant;
import java.util.Base64;
import java.util.Date;
import java.util.Map;
import java.util.UUID;

@Service
public class JwtService {

    @Value("${security.jwt.issuer:suuupra-identity}")
    private String issuer;

    @Value("${security.jwt.audience:suuupra-api}")
    private String audience;

    @Value("${security.jwt.access-ttl-seconds:900}")
    private long accessTokenTtlSeconds;

    @Value("${security.jwt.ec.private-key-pem:}")
    private String ecPrivateKeyPem;

    @Value("${security.jwt.ec.public-key-pem:}")
    private String ecPublicKeyPem;

    private ECPrivateKey ecPrivateKey;
    private ECPublicKey ecPublicKey;
    private String currentKeyId;

    @PostConstruct
    public void initializeKeys() {
        try {
            if (isNonEmpty(ecPrivateKeyPem) && isNonEmpty(ecPublicKeyPem)) {
                this.ecPrivateKey = loadECPrivateKeyFromPem(ecPrivateKeyPem);
                this.ecPublicKey = loadECPublicKeyFromPem(ecPublicKeyPem);
            } else {
                KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
                kpg.initialize(256);
                KeyPair kp = kpg.generateKeyPair();
                this.ecPrivateKey = (ECPrivateKey) kp.getPrivate();
                this.ecPublicKey = (ECPublicKey) kp.getPublic();
            }
            // Derive a stable kid for this key pair (e.g., SHA-256 of public key bytes, truncated)
            MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
            byte[] digest = sha256.digest(ecPublicKey.getEncoded());
            this.currentKeyId = Base64.getUrlEncoder().withoutPadding().encodeToString(digest).substring(0, 16);
        } catch (Exception e) {
            throw new IllegalStateException("Failed to initialize EC keys for JWT", e);
        }
    }

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
                .keyID(currentKeyId)
                .build();
            SignedJWT signedJWT = new SignedJWT(header, claims);
            JWSSigner signer = new ECDSASigner(ecPrivateKey);
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
            JWSVerifier verifier = new ECDSAVerifier(ecPublicKey);
            return jwt.verify(verifier) && jwt.getJWTClaimsSet().getExpirationTime().after(new Date());
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

    public ECPublicKey getEcPublicKey() {
        return ecPublicKey;
    }

    public String getCurrentKeyId() {
        return currentKeyId;
    }

    public ECPrivateKey getEcPrivateKey() {
        return ecPrivateKey;
    }

    private static boolean isNonEmpty(String s) {
        return s != null && !s.isBlank();
    }

    private static ECPrivateKey loadECPrivateKeyFromPem(String pem) throws Exception {
        String content = pem.replace("-----BEGIN PRIVATE KEY-----", "")
            .replace("-----END PRIVATE KEY-----", "")
            .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(content);
        PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(der);
        KeyFactory kf = KeyFactory.getInstance("EC");
        PrivateKey key = kf.generatePrivate(keySpec);
        return (ECPrivateKey) key;
    }

    private static ECPublicKey loadECPublicKeyFromPem(String pem) throws Exception {
        String content = pem.replace("-----BEGIN PUBLIC KEY-----", "")
            .replace("-----END PUBLIC KEY-----", "")
            .replaceAll("\\s", "");
        byte[] der = Base64.getDecoder().decode(content);
        X509EncodedKeySpec keySpec = new X509EncodedKeySpec(der);
        KeyFactory kf = KeyFactory.getInstance("EC");
        PublicKey key = kf.generatePublic(keySpec);
        return (ECPublicKey) key;
    }
}
