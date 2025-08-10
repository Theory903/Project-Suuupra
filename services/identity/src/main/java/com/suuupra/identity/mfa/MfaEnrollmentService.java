package com.suuupra.identity.mfa;

import com.suuupra.identity.mfa.entity.MfaSecret;
import com.suuupra.identity.mfa.repository.MfaSecretRepository;
import com.suuupra.identity.user.entity.User;
import com.suuupra.identity.user.repository.UserRepository;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import java.net.URLEncoder;
import java.nio.charset.StandardCharsets;
import java.time.Instant;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@Service
public class MfaEnrollmentService {

    private final MfaSecretRepository mfaRepo;
    private final UserRepository userRepository;
    private final KeyManager keyManager;
    private final RecoveryCodeService recoveryCodeService;

    public MfaEnrollmentService(MfaSecretRepository mfaRepo, UserRepository userRepository, KeyManager keyManager, RecoveryCodeService recoveryCodeService) {
        this.mfaRepo = mfaRepo;
        this.userRepository = userRepository;
        this.keyManager = keyManager;
        this.recoveryCodeService = recoveryCodeService;
    }

    @Transactional
    public Map<String, Object> initEnrollment(UUID userId, String issuer, String accountName) {
        // generate secret
        byte[] raw = generateHmacSha1Secret();
        String base32 = new org.apache.commons.codec.binary.Base32().encodeToString(raw);
        byte[] enc = keyManager.encrypt(raw);

        MfaSecret e = mfaRepo.findByUserId(userId).orElse(new MfaSecret());
        e.setUserId(userId);
        // Stop persisting plaintext secret; only store encrypted going forward
        e.setSecretEnc(enc);
        mfaRepo.save(e);

        String label = URLEncoder.encode(issuer + ":" + accountName, StandardCharsets.UTF_8);
        String issuerEnc = URLEncoder.encode(issuer, StandardCharsets.UTF_8);
        String otpauth = "otpauth://totp/" + label + "?secret=" + base32 + "&issuer=" + issuerEnc + "&algorithm=SHA1&digits=6&period=30";
        String qr = generateQrPngBase64(otpauth);
        return Map.of("otpauth", otpauth, "qrPngBase64", qr);
    }

    @Transactional
    public List<String> verifyAndEnable(UUID userId, int code) {
        if (!verify(userId, code)) throw new IllegalArgumentException("Invalid code");
        User user = userRepository.findById(userId).orElseThrow();
        user.setMfaEnabled(true);
        user.setMfaEnrolledAt(Instant.now());
        userRepository.save(user);
        return recoveryCodeService.generate(userId, 10);
    }

    public boolean verify(UUID userId, int code) {
        var secret = mfaRepo.findByUserId(userId).orElse(null);
        if (secret == null) return false;
        byte[] raw = secret.getSecretEnc() != null ? keyManager.decrypt(secret.getSecretEnc()) : new org.apache.commons.codec.binary.Base32().decode(secret.getSecret());
        return TotpGenerator.verifyWithinWindow(raw, code, 6, 30, 1);
    }

    private byte[] generateHmacSha1Secret() {
        try {
            KeyGenerator keyGenerator = KeyGenerator.getInstance("HmacSHA1");
            keyGenerator.init(160);
            SecretKey key = keyGenerator.generateKey();
            return key.getEncoded();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private String generateQrPngBase64(String otpauth) {
        try {
            com.google.zxing.Writer writer = new com.google.zxing.qrcode.QRCodeWriter();
            java.util.Map<com.google.zxing.EncodeHintType, Object> hints = new java.util.EnumMap<>(com.google.zxing.EncodeHintType.class);
            hints.put(com.google.zxing.EncodeHintType.MARGIN, 1);
            var matrix = writer.encode(otpauth, com.google.zxing.BarcodeFormat.QR_CODE, 256, 256, hints);
            java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(256, 256, java.awt.image.BufferedImage.TYPE_INT_RGB);
            for (int y = 0; y < 256; y++) {
                for (int x = 0; x < 256; x++) {
                    int val = matrix.get(x, y) ? 0x000000 : 0xFFFFFF;
                    image.setRGB(x, y, val);
                }
            }
            java.io.ByteArrayOutputStream baos = new java.io.ByteArrayOutputStream();
            javax.imageio.ImageIO.write(image, "png", baos);
            return java.util.Base64.getEncoder().encodeToString(baos.toByteArray());
        } catch (Exception e) {
            return null;
        }
    }
}


