package com.suuupra.identity.mfa;

import javax.crypto.Mac;
import javax.crypto.spec.SecretKeySpec;
import java.nio.ByteBuffer;
import java.security.GeneralSecurityException;
import java.time.Instant;

public final class TotpGenerator {

    private TotpGenerator() {}

    public static int generateCode(byte[] secret, int digits, long periodSeconds, Instant timestamp) {
        long counter = timestamp.getEpochSecond() / periodSeconds;
        byte[] counterBytes = ByteBuffer.allocate(8).putLong(counter).array();
        try {
            Mac mac = Mac.getInstance("HmacSHA1");
            mac.init(new SecretKeySpec(secret, "HmacSHA1"));
            byte[] hash = mac.doFinal(counterBytes);

            int offset = hash[hash.length - 1] & 0x0f;
            int binary = ((hash[offset] & 0x7f) << 24) |
                ((hash[offset + 1] & 0xff) << 16) |
                ((hash[offset + 2] & 0xff) << 8) |
                (hash[offset + 3] & 0xff);
            int otp = binary % pow10(digits);
            return otp;
        } catch (GeneralSecurityException e) {
            throw new IllegalStateException(e);
        }
    }

    public static boolean verifyWithinWindow(byte[] secret, int code, int digits, long periodSeconds, int driftWindow) {
        Instant now = Instant.now();
        for (int w = -driftWindow; w <= driftWindow; w++) {
            Instant t = now.plusSeconds(w * periodSeconds);
            int expected = generateCode(secret, digits, periodSeconds, t);
            if (expected == code) return true;
        }
        return false;
    }

    private static int pow10(int n) {
        int p = 1;
        for (int i = 0; i < n; i++) p *= 10;
        return p;
    }
}


