package com.suuupra.identity.mfa;

import com.suuupra.identity.auth.service.AuthService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/mfa")
public class MfaController {

    private final MfaEnrollmentService enrollmentService;
    private final RecoveryCodeService recoveryCodeService;
    private final AuthService authService;

    private final MfaMetrics metrics;

    public MfaController(MfaEnrollmentService enrollmentService, RecoveryCodeService recoveryCodeService, AuthService authService, MfaMetrics metrics) {
        this.enrollmentService = enrollmentService;
        this.recoveryCodeService = recoveryCodeService;
        this.authService = authService;
        this.metrics = metrics;
    }

    @PostMapping("/enroll/init")
    public ResponseEntity<Map<String, Object>> init(@AuthenticationPrincipal UserDetails principal) {
        UUID userId = authService.getUserIdByEmail(principal.getUsername());
        Map<String, Object> body = enrollmentService.initEnrollment(userId, "Suuupra", principal.getUsername());
        metrics.incEnroll();
        return ResponseEntity.ok(body);
    }

    @PostMapping("/enroll/verify")
    public ResponseEntity<List<String>> verify(@AuthenticationPrincipal UserDetails principal, @RequestBody Map<String, Integer> payload) {
        UUID userId = authService.getUserIdByEmail(principal.getUsername());
        int code = payload.getOrDefault("code", 0);
        List<String> codes = enrollmentService.verifyAndEnable(userId, code);
        metrics.incVerify(true);
        // Mark step-up satisfied for current session if we can infer SID from token later; handled by StepUpService in secure endpoints
        return ResponseEntity.ok(codes);
    }

    @PostMapping("/backup/verify")
    public ResponseEntity<Void> verifyBackup(@AuthenticationPrincipal UserDetails principal, @RequestBody Map<String, String> payload) {
        UUID userId = authService.getUserIdByEmail(principal.getUsername());
        String code = payload.get("code");
        boolean ok = recoveryCodeService.consume(userId, code);
        metrics.incBackupUse(ok);
        return ok ? ResponseEntity.noContent().build() : ResponseEntity.badRequest().build();
    }
}


