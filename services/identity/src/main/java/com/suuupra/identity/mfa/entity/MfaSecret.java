package com.suuupra.identity.mfa.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.UUID;

@Entity
@Table(name = "mfa_secrets")
@Getter
@Setter
public class MfaSecret {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false)
    private UUID userId;

    // Legacy plaintext TOTP secret (to be removed after migration)
    private String secret;

    private Instant createdAt = Instant.now();

    @Column(columnDefinition = "bytea")
    private byte[] secretEnc;
}
