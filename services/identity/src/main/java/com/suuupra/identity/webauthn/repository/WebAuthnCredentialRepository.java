package com.suuupra.identity.webauthn.repository;

import com.suuupra.identity.webauthn.entity.WebAuthnCredential;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.List;
import java.util.Optional;
import java.util.UUID;

public interface WebAuthnCredentialRepository extends JpaRepository<WebAuthnCredential, UUID> {
    Optional<WebAuthnCredential> findByCredentialId(String credentialId);
    List<WebAuthnCredential> findAllByUserId(UUID userId);
    List<WebAuthnCredential> findAllByUserHandle(byte[] userHandle);
}


