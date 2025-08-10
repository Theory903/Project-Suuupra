package com.suuupra.identity.auth.controller;

import com.suuupra.identity.auth.dto.AuthResponse;
import com.suuupra.identity.auth.dto.LoginRequest;
import com.suuupra.identity.auth.dto.RegisterRequest;
import com.suuupra.identity.auth.service.AuthService;
import com.suuupra.identity.auth.dto.RefreshTokenRequest;
import com.suuupra.identity.auth.service.EmailVerificationService;
import com.suuupra.identity.notifications.EmailService;
import jakarta.validation.Valid;
import org.springframework.http.ResponseEntity;
import org.springframework.context.annotation.Lazy;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/auth")
public class AuthController {

    private final AuthService authService;
    private final EmailVerificationService emailVerificationService;
    private final EmailService emailService;

    public AuthController(@Lazy AuthService authService, EmailVerificationService emailVerificationService, EmailService emailService) {
        this.authService = authService;
        this.emailVerificationService = emailVerificationService;
        this.emailService = emailService;
    }

    @PostMapping("/register")
    public ResponseEntity<AuthResponse> register(@Valid @RequestBody RegisterRequest request) {
        return ResponseEntity.ok()
            .header("X-Auth-Deprecated", "true")
            .body(authService.register(request));
    }

    @PostMapping("/login")
    public ResponseEntity<AuthResponse> login(@Valid @RequestBody LoginRequest request) {
        return ResponseEntity.ok()
            .header("X-Auth-Deprecated", "true")
            .body(authService.login(request));
    }

    @PostMapping("/verify/email/request")
    public ResponseEntity<Map<String, String>> requestEmailVerification(@RequestBody Map<String, String> body) {
        String email = body.get("email");
        String token = emailVerificationService.createVerificationToken(email);
        emailService.send(email, "Verify your email", "Your verification token: " + token);
        return ResponseEntity.ok(Map.of("verificationToken", token));
    }

    @PostMapping("/verify/email/confirm")
    public ResponseEntity<Void> confirmEmailVerification(@RequestBody Map<String, String> body) {
        String token = body.get("token");
        String email = emailVerificationService.verifyToken(token);
        authService.markEmailVerified(email);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/token/refresh")
    public ResponseEntity<AuthResponse> refresh(@RequestBody @Valid RefreshTokenRequest body) {
        return ResponseEntity.status(410)
            .header("X-Auth-Deprecated", "true")
            .header("X-Alt-Endpoint", "/oauth2/token")
            .build();
    }

    @PostMapping("/logout")
    public ResponseEntity<Void> logout(@RequestBody @Valid RefreshTokenRequest body) {
        return ResponseEntity.status(410)
            .header("X-Auth-Deprecated", "true")
            .header("X-Alt-Endpoint", "/oauth2/revoke")
            .build();
    }

    @PostMapping("/token/introspect")
    public ResponseEntity<Map<String, Object>> introspect(@RequestBody Map<String, String> body) {
        return ResponseEntity.status(410)
            .header("X-Auth-Deprecated", "true")
            .header("X-Alt-Endpoint", "/oauth2/introspect")
            .build();
    }

    @PostMapping("/token/revoke")
    public ResponseEntity<Void> revoke(@RequestBody Map<String, String> body) {
        return ResponseEntity.status(410)
            .header("X-Auth-Deprecated", "true")
            .header("X-Alt-Endpoint", "/oauth2/revoke")
            .build();
    }
}
