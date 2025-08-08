package com.suuupra.identity.user.entity;

import jakarta.persistence.*;
import lombok.Getter;
import lombok.Setter;

import java.time.Instant;
import java.util.HashSet;
import java.util.Set;
import java.util.UUID;

@Entity
@Table(name = "users")
@Getter
@Setter
public class User {

    @Id
    @GeneratedValue
    private UUID id;

    @Column(nullable = false, unique = true, length = 255)
    private String email;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(nullable = false, length = 20)
    private String status = "ACTIVE";

    private boolean emailVerified = false;

    private String phoneNumber;

    private boolean phoneVerified = false;

    private Instant passwordChangedAt = Instant.now();

    private Integer failedLoginAttempts = 0;

    private Instant lastFailedLoginAt;

    private Instant lockedUntil;

    private Instant createdAt = Instant.now();

    private Instant updatedAt = Instant.now();

    private UUID createdBy;

    private UUID updatedBy;

    private Integer version = 1;

    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(
        name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id")
    )
    private Set<Role> roles = new HashSet<>();
}
