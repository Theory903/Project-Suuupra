package com.suuupra.identity.mfa;

import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.security.SecureRandom;
import java.util.ArrayList;
import java.util.List;
import java.util.UUID;

@Service
public class RecoveryCodeService {

    private final JdbcTemplate jdbc;
    private final PasswordEncoder passwordEncoder;
    private final SecureRandom random = new SecureRandom();

    public RecoveryCodeService(JdbcTemplate jdbc, PasswordEncoder passwordEncoder) {
        this.jdbc = jdbc;
        this.passwordEncoder = passwordEncoder;
    }

    public List<String> generate(UUID userId, int count) {
        // Invalidate old
        jdbc.update("DELETE FROM recovery_codes WHERE user_id=?", userId);
        List<String> plain = new ArrayList<>(count);
        for (int i = 0; i < count; i++) {
            String code = randomCode();
            plain.add(code);
            jdbc.update("INSERT INTO recovery_codes(user_id, code_hash) VALUES (?,?)",
                userId, passwordEncoder.encode(code));
        }
        return plain;
    }

    public boolean consume(UUID userId, String code) {
        var hashes = jdbc.queryForList("SELECT id, code_hash FROM recovery_codes WHERE user_id=? AND used_at IS NULL", userId);
        for (var row : hashes) {
            String hash = (String) row.get("code_hash");
            if (passwordEncoder.matches(code, hash)) {
                UUID id = (UUID) row.get("id");
                jdbc.update("UPDATE recovery_codes SET used_at=NOW() WHERE id=?", id);
                return true;
            }
        }
        return false;
    }

    private String randomCode() {
        // 10 digits alphanumeric without ambiguous chars
        final String alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
        StringBuilder sb = new StringBuilder(10);
        for (int i = 0; i < 10; i++) {
            sb.append(alphabet.charAt(random.nextInt(alphabet.length())));
        }
        return sb.toString();
    }
}


