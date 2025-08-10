package com.suuupra.identity.mfa;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.security.SecureRandom;

@Component
public class KeyManager {

    private final SecretKey kek; // Simulated KEK; replace with KMS/Vault
    private final SecureRandom random = new SecureRandom();

    public KeyManager(@Value("${security.mfa.kekBase64:}") String kekBase64) {
        try {
            if (kekBase64 != null && !kekBase64.isBlank()) {
                byte[] keyBytes = java.util.Base64.getDecoder().decode(kekBase64);
                this.kek = new javax.crypto.spec.SecretKeySpec(keyBytes, "AES");
            } else {
                // Deterministic dev key if no KEK provided
                KeyGenerator kg = KeyGenerator.getInstance("AES");
                SecureRandom deterministicRandom = new SecureRandom();
                deterministicRandom.setSeed("suuupra-mfa-local-key".getBytes());
                kg.init(256, deterministicRandom);
                this.kek = kg.generateKey();
            }
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    public byte[] encrypt(byte[] plaintext) {
        try {
            byte[] iv = new byte[12];
            random.nextBytes(iv);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.ENCRYPT_MODE, kek, new GCMParameterSpec(128, iv));
            byte[] ct = cipher.doFinal(plaintext);
            byte[] out = new byte[iv.length + ct.length];
            System.arraycopy(iv, 0, out, 0, iv.length);
            System.arraycopy(ct, 0, out, iv.length, ct.length);
            return out;
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }

    public byte[] decrypt(byte[] ciphertext) {
        try {
            byte[] iv = new byte[12];
            System.arraycopy(ciphertext, 0, iv, 0, 12);
            byte[] ct = new byte[ciphertext.length - 12];
            System.arraycopy(ciphertext, 12, ct, 0, ct.length);
            Cipher cipher = Cipher.getInstance("AES/GCM/NoPadding");
            cipher.init(Cipher.DECRYPT_MODE, kek, new GCMParameterSpec(128, iv));
            return cipher.doFinal(ct);
        } catch (Exception e) {
            throw new RuntimeException(e);
        }
    }
}


