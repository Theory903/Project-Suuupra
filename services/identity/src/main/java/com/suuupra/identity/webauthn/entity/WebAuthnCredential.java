package com.suuupra.identity.webauthn.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "webauthn_credentials")
@Getter
@Setter
public class WebAuthnCredential {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    @Lob
    @Column(nullable = false)
    private byte[] userHandle;

    // Credential ID (Base64URL)
    @Column(nullable = false, unique = true, length = 512)
    private String credentialId;

    // Public key in COSE (Base64URL)
    @Column(nullable = false, length = 2048)
    private String publicKeyCose;

    private Long signCount = 0L;

    private String attestationType;

    private String transports;

    private String friendlyName;

    @Column(columnDefinition = "uuid")
    private java.util.UUID aaguid;

    private Instant createdAt = Instant.now();
}


