package com.suuupra.identity.keys;

import org.springframework.stereotype.Component;

import javax.crypto.Cipher;
import javax.crypto.KeyGenerator;
import javax.crypto.SecretKey;
import javax.crypto.spec.GCMParameterSpec;
import java.security.SecureRandom;

@Component
public class LocalKmsService implements KmsService {
    private final SecretKey kek;
    private final SecureRandom random = new SecureRandom();

    public LocalKmsService() {
        try {
            KeyGenerator kg = KeyGenerator.getInstance("AES");
            kg.init(256);
            
            // For local development, use a deterministic key to avoid Tag mismatch errors
            // In production, this should be replaced with proper KMS or externally managed keys
            SecureRandom deterministicRandom = new SecureRandom();
            deterministicRandom.setSeed("suuupra-local-dev-key".getBytes());
            kg.init(256, deterministicRandom);
            this.kek = kg.generateKey();
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    @Override
    public byte[] wrap(byte[] plaintext) {
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

    @Override
    public byte[] unwrap(byte[] ciphertext) {
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


