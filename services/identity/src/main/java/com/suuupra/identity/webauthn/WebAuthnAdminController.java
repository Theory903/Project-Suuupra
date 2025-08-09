package com.suuupra.identity.webauthn;

import com.suuupra.identity.audit.AuditLogService;
import com.suuupra.identity.mfa.annotations.SensitiveAdmin;
import com.suuupra.identity.security.RequireDPoP;
import com.suuupra.identity.security.RequireResources;
import com.suuupra.identity.security.RequireMtls;
import com.suuupra.identity.webauthn.entity.WebAuthnCredential;
import com.suuupra.identity.webauthn.repository.WebAuthnCredentialRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.List;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/admin/webauthn")
@RequireResources({"resource://identity.admin"})
@RequireDPoP
@RequireMtls
@SensitiveAdmin
public class WebAuthnAdminController {

    private final WebAuthnCredentialRepository repo;
    private final AuditLogService audit;

    public WebAuthnAdminController(WebAuthnCredentialRepository repo, AuditLogService audit) {
        this.repo = repo;
        this.audit = audit;
    }

    @GetMapping("/users/{userId}/credentials")
    public ResponseEntity<List<WebAuthnCredential>> list(@PathVariable UUID userId,
                                                         @RequestParam(required = false) String aaguid) {
        List<WebAuthnCredential> creds = repo.findAllByUserId(userId);
        if (aaguid != null && !aaguid.isBlank()) {
            java.util.UUID filter = java.util.UUID.fromString(aaguid);
            creds = creds.stream().filter(c -> filter.equals(c.getAaguid())).toList();
        }
        return ResponseEntity.ok(creds);
    }

    @DeleteMapping("/credentials/{credentialId}")
    public ResponseEntity<Void> delete(@PathVariable String credentialId) {
        repo.findByCredentialId(credentialId).ifPresent(c -> {
            repo.delete(c);
            audit.append("webauthn.credential.deleted", null, null, c.getUserId(), null, java.util.Map.of("credentialId", credentialId));
        });
        return ResponseEntity.noContent().build();
    }

    @PatchMapping("/credentials/{credentialId}")
    public ResponseEntity<Void> rename(@PathVariable String credentialId, @RequestBody java.util.Map<String, String> body) {
        String name = body.get("friendlyName");
        repo.findByCredentialId(credentialId).ifPresent(c -> {
            c.setFriendlyName(name);
            repo.save(c);
            audit.append("webauthn.credential.renamed", null, null, c.getUserId(), null, java.util.Map.of("credentialId", credentialId, "friendlyName", name));
        });
        return ResponseEntity.noContent().build();
    }

    @DeleteMapping("/users/{userId}/credentials")
    public ResponseEntity<Void> deleteAll(@PathVariable UUID userId) {
        var creds = repo.findAllByUserId(userId);
        creds.forEach(c -> repo.delete(c));
        audit.append("webauthn.credentials.deleted_all", null, null, userId, null, java.util.Map.of("count", creds.size()));
        return ResponseEntity.noContent().build();
    }
}


