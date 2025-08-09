package com.suuupra.identity.mfa;

import com.suuupra.identity.mfa.repository.MfaSecretRepository;
import com.suuupra.identity.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.*;

import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/mfa")
public class AdminMfaController {

    private final MfaSecretRepository mfaSecretRepository;
    private final UserRepository userRepository;

    public AdminMfaController(MfaSecretRepository mfaSecretRepository, UserRepository userRepository) {
        this.mfaSecretRepository = mfaSecretRepository;
        this.userRepository = userRepository;
    }

    @PostMapping("/users/{userId}/reset")
    @PreAuthorize("hasPermission(null, 'rbac.write')")
    public ResponseEntity<Void> reset(@PathVariable UUID userId) {
        mfaSecretRepository.findByUserId(userId).ifPresent(mfaSecretRepository::delete);
        userRepository.findById(userId).ifPresent(u -> { u.setMfaEnabled(false); u.setMfaEnrolledAt(null); userRepository.save(u); });
        return ResponseEntity.noContent().build();
    }
}


