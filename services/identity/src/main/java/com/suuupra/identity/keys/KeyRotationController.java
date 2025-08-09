package com.suuupra.identity.keys;

import com.suuupra.identity.audit.AuditLogService;
import com.suuupra.identity.auth.service.AuthService;
import com.suuupra.identity.mfa.StepUpProtected;
import com.suuupra.identity.security.RequireResources;
import com.suuupra.identity.security.RequireDPoP;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/keys")
@RequireResources({"resource://identity.admin"})
public class KeyRotationController {

    private final SigningKeyService signingKeyService;
    private final AuditLogService auditLogService;
    private final AuthService authService;

    public KeyRotationController(SigningKeyService signingKeyService, AuditLogService auditLogService, AuthService authService) {
        this.signingKeyService = signingKeyService;
        this.auditLogService = auditLogService;
        this.authService = authService;
    }

    @PostMapping("/rotate")
    @PreAuthorize("hasPermission(null, 'keys.rotate')")
    @StepUpProtected(ttlSeconds = 900)
    @RequireDPoP
    public ResponseEntity<Map<String, String>> rotate(@AuthenticationPrincipal UserDetails principal) {
        String nextKid = signingKeyService.rotateCreateNext();
        // audit
        java.util.UUID actorId = authService.getUserIdByEmail(principal.getUsername());
        auditLogService.append("KEY_ROTATE_NEXT", actorId, principal.getUsername(), null, null, java.util.Map.of("nextKid", nextKid));
        return ResponseEntity.ok(Map.of("nextKid", nextKid));
    }

    @PostMapping("/promote")
    @PreAuthorize("hasPermission(null, 'keys.rotate')")
    @StepUpProtected(ttlSeconds = 900)
    @RequireDPoP
    public ResponseEntity<Map<String, String>> promote(@AuthenticationPrincipal UserDetails principal, @org.springframework.web.bind.annotation.RequestParam("kid") String kid) {
        signingKeyService.promoteCurrent(kid);
        java.util.UUID actorId = authService.getUserIdByEmail(principal.getUsername());
        auditLogService.append("KEY_PROMOTE", actorId, principal.getUsername(), null, null, java.util.Map.of("currentKid", kid));
        return ResponseEntity.ok(Map.of("currentKid", kid));
    }
}


