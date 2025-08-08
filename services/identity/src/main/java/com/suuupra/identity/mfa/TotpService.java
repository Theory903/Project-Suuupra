package com.suuupra.identity.mfa;

import com.eatthepath.otp.TimeBasedOneTimePasswordGenerator;
import com.suuupra.identity.mfa.entity.MfaSecret;
import com.suuupra.identity.mfa.repository.MfaSecretRepository;
import org.apache.commons.codec.binary.Base32;
import org.springframework.stereotype.Service;

import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.security.NoSuchAlgorithmException;
import java.time.Duration;
import java.util.List;
import java.util.UUID;

@Service
public class TotpService {

    private final MfaSecretRepository repo;

    public TotpService(MfaSecretRepository repo) {
        this.repo = repo;
    }

    public String enroll(UUID userId, String issuer, String accountName) {
        SecretKey key = generateSecretKey();
        String base32 = new Base32().encodeToString(key.getEncoded());
        MfaSecret e = new MfaSecret();
        e.setUserId(userId);
        e.setSecret(base32);
        repo.save(e);
        String label = URLEncoder.encode(issuer + ":" + accountName, StandardCharsets.UTF_8);
        String issuerEnc = URLEncoder.encode(issuer, StandardCharsets.UTF_8);
        return "otpauth://totp/" + label + "?secret=" + base32 + "&issuer=" + issuerEnc + "&algorithm=SHA1&digits=6&period=30";
    }

    public boolean verify(UUID userId, int code) {
        String secret = repo.findByUserId(userId).map(MfaSecret::getSecret).orElse(null);
        if (secret == null) return false;
        try {
            TimeBasedOneTimePasswordGenerator totp = new TimeBasedOneTimePasswordGenerator(Duration.ofSeconds(30));
            SecretKey key = new javax.crypto.spec.SecretKeySpec(new Base32().decode(secret), "HmacSHA1");
            int current = totp.generateOneTimePassword(key, java.time.Instant.now());
            return current == code;
        } catch (Exception e) {
            return false;
        }
    }

    private SecretKey generateSecretKey() {
        try {
            KeyGenerator keyGenerator = KeyGenerator.getInstance("HmacSHA1");
            keyGenerator.init(160);
            return keyGenerator.generateKey();
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException(e);
        }
    }
}
