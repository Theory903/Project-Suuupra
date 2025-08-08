package com.suuupra.identity.mfa.repository;

import com.suuupra.identity.mfa.entity.MfaSecret;
import org.springframework.data.jpa.repository.JpaRepository;

import java.util.Optional;
import java.util.UUID;

public interface MfaSecretRepository extends JpaRepository<MfaSecret, UUID> {
    Optional<MfaSecret> findByUserId(UUID userId);
}
