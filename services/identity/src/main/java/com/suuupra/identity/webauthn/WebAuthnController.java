package com.suuupra.identity.webauthn;

import com.suuupra.identity.auth.service.AuthService;
import com.yubico.webauthn.data.PublicKeyCredentialCreationOptions;
import com.yubico.webauthn.data.PublicKeyCredentialRequestOptions;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/webauthn")
public class WebAuthnController {

    private final WebAuthnService webAuthnService;
    private final AuthService authService;

    public WebAuthnController(WebAuthnService webAuthnService, AuthService authService) {
        this.webAuthnService = webAuthnService;
        this.authService = authService;
    }

    @PostMapping("/register/start")
    public ResponseEntity<PublicKeyCredentialCreationOptions> startRegistration(@AuthenticationPrincipal UserDetails principal) {
        UUID userId = authService.getUserIdByEmail(principal.getUsername());
        PublicKeyCredentialCreationOptions options = webAuthnService.startRegistration(userId, principal.getUsername(), principal.getUsername());
        return ResponseEntity.ok(options);
    }

    @PostMapping("/register/finish")
    public ResponseEntity<Map<String, Object>> finishRegistration(@AuthenticationPrincipal UserDetails principal,
                                                                  @RequestBody Map<String, Object> body) {
        UUID userId = authService.getUserIdByEmail(principal.getUsername());
        // Expect the browser's JSON from navigator.credentials.create()
        String credentialJson = (String) body.get("credential");
        webAuthnService.finishRegistration(userId, credentialJson);
        return ResponseEntity.ok(Map.of("status", "registered"));
    }

    @PostMapping("/assert/start")
    public ResponseEntity<PublicKeyCredentialRequestOptions> startAssertion(@RequestParam String username) {
        return ResponseEntity.ok(webAuthnService.startAssertion(username));
    }

    @PostMapping("/assert/finish")
    public ResponseEntity<Map<String, Object>> finishAssertion(@RequestBody Map<String, Object> body) {
        String username = (String) body.get("username");
        String credentialJson = (String) body.get("credential");
        var result = webAuthnService.finishAssertion(username, credentialJson);
        if (!result.isSuccess()) {
            return ResponseEntity.status(401).body(Map.of("verified", false));
        }
        return ResponseEntity.ok(Map.of("verified", true));
    }
}


