# 👤 Identity Service - Implementation Guide

## 📋 Service Overview

**Role**: Comprehensive identity and access management system handling user lifecycle, authentication flows, role-based access control (RBAC), and OAuth2 authorization server. Acts as the source of truth for all user identities and permissions across the Suuupra platform.

**Learning Objectives**: 
- Master OAuth2/OpenID Connect protocols and flows
- Implement sophisticated RBAC systems with hierarchical permissions
- Design secure user session management and multi-factor authentication
- Understand cryptographic techniques for password security
- Apply graph algorithms for permission inheritance

**System Requirements**:
- Handle 10k+ authentication requests per second
- Support OAuth2, OpenID Connect, and SAML protocols
- 99.99% availability with global user directory
- Sub-200ms authentication response times
- GDPR and SOC 2 compliance for user data

---

## 🏗️ Architecture & Design

### Core Components Architecture
```
┌─────────────────────────────────────────────────────────────┐
│                    Identity Service                         │
├─────────────────┬─────────────────┬─────────────────────────┤
│  User Management│    OAuth2/OIDC   │      RBAC Engine        │
│   - Registration│   - Auth Flows   │   - Permission Trees    │
│   - Profiles    │   - Tokens       │   - Role Hierarchies    │
│   - Preferences │   - Scopes       │   - Policy Evaluation   │
├─────────────────┼─────────────────┼─────────────────────────┤
│ Session Mgmt    │   Multi-Factor   │    User Directory       │
│   - Active Sess │   - TOTP/SMS     │   - LDAP Integration    │
│   - Device Track│   - Push Notify  │   - Social Login       │
│   - Concurrency │   - Recovery     │   - Profile Federation │
├─────────────────┼─────────────────┼─────────────────────────┤
│ Password Mgmt   │   Audit & Compl  │    Federation          │
│   - Policies    │   - Audit Logs   │   - SAML 2.0           │
│   - Breach Det  │   - GDPR Export  │   - OpenID Connect     │
│   - Encryption  │   - Compliance   │   - Social Providers   │
└─────────────────┴─────────────────┴─────────────────────────┘
```

### Technology Stack
- **Runtime**: Java 17+ with Spring Boot 3.0
- **Framework**: Spring Security 6, Spring Data JPA
- **Database**: PostgreSQL 15 (primary), Redis 7 (sessions)
- **Authentication**: Spring OAuth2 Authorization Server
- **Security**: Argon2 password hashing, TOTP for MFA
- **Search**: Elasticsearch 8 for user directory search

### Data Structures & Algorithms

**Graph Algorithms for RBAC**:
```java
public class RoleHierarchy {
    private final Map<Role, Set<Role>> parentRoles = new HashMap<>();
    private final Map<Role, Set<Permission>> rolePermissions = new HashMap<>();
    
    // Use DFS to compute transitive permissions
    public Set<Permission> getEffectivePermissions(User user) {
        Set<Permission> permissions = new HashSet<>();
        Set<Role> visited = new HashSet<>();
        
        for (Role role : user.getRoles()) {
            dfsPermissions(role, permissions, visited);
        }
        
        return permissions;
    }
    
    private void dfsPermissions(Role role, Set<Permission> permissions, Set<Role> visited) {
        if (visited.contains(role)) return;
        visited.add(role);
        
        permissions.addAll(rolePermissions.getOrDefault(role, Set.of()));
        
        for (Role parentRole : parentRoles.getOrDefault(role, Set.of())) {
            dfsPermissions(parentRole, permissions, visited);
        }
    }
}
```

**Hash Tables for Session Management**:
```java
public class SessionManager {
    private final RedisTemplate<String, Session> sessionStore;
    
    // O(1) session lookup and validation
    public Optional<Session> validateSession(String sessionId) {
        Session session = sessionStore.opsForValue().get(sessionId);
        
        if (session != null && !isExpired(session)) {
            // Update last accessed time
            session.setLastAccessedAt(Instant.now());
            sessionStore.opsForValue().set(sessionId, session, 
                Duration.ofHours(24));
            return Optional.of(session);
        }
        
        return Optional.empty();
    }
}
```

**Trie for Permission Matching**:
```java
public class PermissionTrie {
    private final TrieNode root = new TrieNode();
    
    public void insertPermission(String permission) {
        TrieNode current = root;
        for (String part : permission.split(":")) {
            current = current.children.computeIfAbsent(part, k -> new TrieNode());
        }
        current.isEndOfPermission = true;
    }
    
    public boolean hasPermission(String permission) {
        // Support wildcard matching: "user:*" matches "user:read", "user:write"
        return searchWithWildcard(root, permission.split(":"), 0);
    }
}
```

---

## 📅 Week-by-Week Implementation Plan

### Week 1: User Management & Authentication Foundation (Days 1-7)

#### Day 1-2: User Registration & Profile Management
**Learning Focus**: User lifecycle management, data validation, secure storage

**Tasks**:
- [ ] Design comprehensive user entity with audit fields
- [ ] Implement user registration with email verification
- [ ] Create profile management with field-level permissions
- [ ] Build user search and directory functionality
- [ ] Add user preference and setting management

**User Entity Design**:
```java
@Entity
@Table(name = "users")
@EntityListeners(AuditingEntityListener.class)
public class User {
    @Id
    @GeneratedValue(generator = "UUID")
    private UUID id;
    
    @Column(unique = true, nullable = false)
    @Email
    private String email;
    
    @Column(nullable = false)
    private String passwordHash;
    
    @Enumerated(EnumType.STRING)
    private UserStatus status;
    
    @ManyToMany(fetch = FetchType.LAZY)
    @JoinTable(name = "user_roles",
        joinColumns = @JoinColumn(name = "user_id"),
        inverseJoinColumns = @JoinColumn(name = "role_id"))
    private Set<Role> roles = new HashSet<>();
    
    @OneToOne(cascade = CascadeType.ALL)
    private UserProfile profile;
    
    @OneToMany(mappedBy = "user", cascade = CascadeType.ALL)
    private Set<UserDevice> devices = new HashSet<>();
    
    @CreatedDate
    private Instant createdAt;
    
    @LastModifiedDate
    private Instant updatedAt;
    
    // Password policy fields
    private Instant passwordChangedAt;
    private Integer failedLoginAttempts;
    private Instant lastFailedLoginAt;
    private Instant lockedUntil;
}

@Entity
public class UserProfile {
    @Id
    private UUID userId;
    
    private String firstName;
    private String lastName;
    private String displayName;
    private String avatarUrl;
    private String phoneNumber;
    private LocalDate dateOfBirth;
    private String timezone;
    private String locale;
    
    @Embedded
    private Address address;
    
    // GDPR compliance
    @JsonIgnore
    private boolean dataProcessingConsent;
    private Instant consentDate;
    
    // Encrypted PII fields using JPA AttributeConverter
    @Convert(converter = EncryptedStringConverter.class)
    private String encryptedSSN;
}
```

#### Day 3-4: Password Management & Security
**Learning Focus**: Cryptographic hashing, password policies, breach detection

**Tasks**:
- [ ] Implement Argon2 password hashing with salt
- [ ] Create password policy engine with complexity rules
- [ ] Build password breach detection using HaveIBeenPwned API
- [ ] Add password history tracking to prevent reuse
- [ ] Implement account lockout with exponential backoff

**Password Security Implementation**:
```java
@Service
public class PasswordService {
    private final Argon2 argon2 = Argon2Factory.create(Argon2Types.ARGON2id);
    private final PasswordBreachService breachService;
    
    public String hashPassword(String password) {
        // Generate salt and hash with Argon2id
        return argon2.hash(4, 1024 * 1024, 8, password.toCharArray());
    }
    
    public boolean verifyPassword(String password, String hash) {
        return argon2.verify(hash, password.toCharArray());
    }
    
    public PasswordValidationResult validatePassword(String password, User user) {
        List<String> violations = new ArrayList<>();
        
        // Length check
        if (password.length() < 12) {
            violations.add("Password must be at least 12 characters long");
        }
        
        // Complexity check
        if (!hasRequiredComplexity(password)) {
            violations.add("Password must contain uppercase, lowercase, digits, and symbols");
        }
        
        // Breach check
        if (breachService.isPasswordBreached(password)) {
            violations.add("Password found in security breaches, choose a different one");
        }
        
        // History check
        if (isInPasswordHistory(password, user)) {
            violations.add("Cannot reuse previous 12 passwords");
        }
        
        return new PasswordValidationResult(violations.isEmpty(), violations);
    }
}

@Component
public class AccountLockoutService {
    private static final int MAX_FAILED_ATTEMPTS = 5;
    private static final Duration[] LOCKOUT_DURATIONS = {
        Duration.ofMinutes(5),
        Duration.ofMinutes(15),
        Duration.ofHours(1),
        Duration.ofHours(24)
    };
    
    public void recordFailedLogin(User user) {
        user.setFailedLoginAttempts(user.getFailedLoginAttempts() + 1);
        user.setLastFailedLoginAt(Instant.now());
        
        if (user.getFailedLoginAttempts() >= MAX_FAILED_ATTEMPTS) {
            int lockoutLevel = Math.min(user.getFailedLoginAttempts() - MAX_FAILED_ATTEMPTS, 
                                       LOCKOUT_DURATIONS.length - 1);
            user.setLockedUntil(Instant.now().plus(LOCKOUT_DURATIONS[lockoutLevel]));
        }
    }
}
```

#### Day 5-7: Multi-Factor Authentication
**Learning Focus**: TOTP algorithms, SMS integration, push notifications

**Tasks**:
- [ ] Implement TOTP (Time-based One-Time Password) with Google Authenticator
- [ ] Add SMS-based OTP with Twilio integration
- [ ] Create push notification MFA using Firebase
- [ ] Build MFA recovery codes and backup methods
- [ ] Add device trust and remember functionality

**TOTP Implementation**:
```java
@Service
public class TOTPService {
    private static final String ISSUER = "Suuupra";
    private static final int TIME_STEP = 30; // seconds
    private static final int WINDOW = 1; // Allow 1 time step variance
    
    public MFASetupResult setupTOTP(User user) {
        // Generate secret key
        SecretGenerator generator = new DefaultSecretGenerator();
        Secret secret = generator.generate();
        
        // Store encrypted secret
        MFACredential credential = new MFACredential();
        credential.setUser(user);
        credential.setType(MFAType.TOTP);
        credential.setSecret(encryptSecret(secret.getEncodedKey()));
        credential.setCreatedAt(Instant.now());
        
        mfaCredentialRepository.save(credential);
        
        // Generate QR code
        String qrCodeUrl = GoogleAuthenticatorQRGenerator.getOtpAuthURL(
            ISSUER, user.getEmail(), secret);
            
        return new MFASetupResult(credential.getId(), qrCodeUrl, 
                                 generateRecoveryCodes(user));
    }
    
    public boolean validateTOTP(User user, String code) {
        Optional<MFACredential> credential = findTOTPCredential(user);
        if (credential.isEmpty()) return false;
        
        String secret = decryptSecret(credential.get().getSecret());
        GoogleAuthenticator gAuth = new GoogleAuthenticator();
        
        return gAuth.authorize(secret, Integer.parseInt(code), 
                              System.currentTimeMillis() / 1000 / TIME_STEP);
    }
    
    private Set<String> generateRecoveryCodes(User user) {
        Set<String> codes = new HashSet<>();
        SecureRandom random = new SecureRandom();
        
        for (int i = 0; i < 10; i++) {
            String code = String.format("%08d", random.nextInt(100000000));
            codes.add(code);
            
            // Store hashed recovery code
            MFARecoveryCode recoveryCode = new MFARecoveryCode();
            recoveryCode.setUser(user);
            recoveryCode.setCodeHash(passwordEncoder.encode(code));
            recoveryCode.setCreatedAt(Instant.now());
            mfaRecoveryRepository.save(recoveryCode);
        }
        
        return codes;
    }
}
```

### Week 2: OAuth2 & OpenID Connect Implementation (Days 8-14)

#### Day 8-10: OAuth2 Authorization Server
**Learning Focus**: OAuth2 flows, token management, client registration

**Tasks**:
- [ ] Setup Spring Authorization Server with custom configuration
- [ ] Implement authorization code flow with PKCE support
- [ ] Create client registration and management system
- [ ] Build consent screen with scope descriptions
- [ ] Add token introspection and revocation endpoints

**OAuth2 Server Configuration**:
```java
@Configuration
@EnableAuthorizationServer
public class AuthorizationServerConfig {
    
    @Bean
    public RegisteredClientRepository registeredClientRepository() {
        return new JpaRegisteredClientRepository(clientRepository);
    }
    
    @Bean
    public AuthorizationServerSettings authorizationServerSettings() {
        return AuthorizationServerSettings.builder()
            .issuer("https://identity.suuupra.com")
            .authorizationEndpoint("/oauth2/authorize")
            .tokenEndpoint("/oauth2/token")
            .jwkSetEndpoint("/oauth2/jwks")
            .tokenRevocationEndpoint("/oauth2/revoke")
            .tokenIntrospectionEndpoint("/oauth2/introspect")
            .oidcClientRegistrationEndpoint("/connect/register")
            .oidcUserInfoEndpoint("/connect/userinfo")
            .build();
    }
    
    @Bean
    public TokenSettings tokenSettings() {
        return TokenSettings.builder()
            .accessTokenTimeToLive(Duration.ofMinutes(15))
            .refreshTokenTimeToLive(Duration.ofDays(7))
            .authorizationCodeTimeToLive(Duration.ofMinutes(10))
            .reuseRefreshTokens(false) // Rotate refresh tokens
            .build();
    }
}

@Entity
public class OAuth2Client {
    @Id
    private String clientId;
    
    @JsonIgnore
    private String clientSecret;
    
    @ElementCollection(fetch = FetchType.EAGER)
    @Enumerated(EnumType.STRING)
    private Set<AuthorizationGrantType> authorizedGrantTypes;
    
    @ElementCollection(fetch = FetchType.EAGER)
    private Set<String> redirectUris;
    
    @ElementCollection(fetch = FetchType.EAGER)
    private Set<String> scopes;
    
    private boolean requireAuthorizationConsent;
    private boolean requireProofKey; // PKCE required
    
    @Embedded
    private ClientSettings clientSettings;
    
    @Embedded
    private TokenSettings tokenSettings;
}
```

#### Day 11-12: OpenID Connect Implementation
**Learning Focus**: OIDC protocol, ID tokens, user info endpoint

**Tasks**:
- [ ] Implement OpenID Connect on top of OAuth2
- [ ] Create ID token generation with user claims
- [ ] Build UserInfo endpoint with claim mapping
- [ ] Add OIDC Discovery endpoint (.well-known/openid_configuration)
- [ ] Implement JWKS (JSON Web Key Set) endpoint

**OIDC Implementation**:
```java
@Service
public class OIDCService {
    
    @EventListener
    public void onTokenGeneration(TokenGenerationEvent event) {
        if (event.getTokenType() == TokenType.ID_TOKEN) {
            OAuth2TokenContext context = event.getContext();
            UserPrincipal principal = context.getPrincipal();
            
            JwtClaimsSet.Builder claims = JwtClaimsSet.builder(event.getClaims());
            
            // Add standard OIDC claims
            User user = userService.findById(principal.getUserId());
            claims.claim("email", user.getEmail());
            claims.claim("email_verified", user.isEmailVerified());
            claims.claim("name", user.getProfile().getDisplayName());
            claims.claim("given_name", user.getProfile().getFirstName());
            claims.claim("family_name", user.getProfile().getLastName());
            claims.claim("picture", user.getProfile().getAvatarUrl());
            claims.claim("locale", user.getProfile().getLocale());
            claims.claim("zoneinfo", user.getProfile().getTimezone());
            
            // Add custom claims based on scopes
            Set<String> scopes = context.getAuthorizedScopes();
            if (scopes.contains("profile")) {
                addProfileClaims(claims, user);
            }
            if (scopes.contains("roles")) {
                addRoleClaims(claims, user);
            }
            
            event.setClaims(claims.build());
        }
    }
    
    @GetMapping("/connect/userinfo")
    public ResponseEntity<Map<String, Object>> userInfo(
            @AuthenticationPrincipal JwtAuthenticationToken jwt) {
        
        String userId = jwt.getToken().getSubject();
        User user = userService.findById(UUID.fromString(userId));
        
        Map<String, Object> userInfo = new HashMap<>();
        userInfo.put("sub", userId);
        userInfo.put("email", user.getEmail());
        userInfo.put("email_verified", user.isEmailVerified());
        
        // Add claims based on token scopes
        Set<String> scopes = jwt.getToken().getClaimAsStringList("scope")
                                .stream().collect(Collectors.toSet());
        
        if (scopes.contains("profile")) {
            userInfo.put("name", user.getProfile().getDisplayName());
            userInfo.put("given_name", user.getProfile().getFirstName());
            userInfo.put("family_name", user.getProfile().getLastName());
        }
        
        return ResponseEntity.ok(userInfo);
    }
}
```

#### Day 13-14: Advanced OAuth2 Features
**Learning Focus**: Token exchange, dynamic client registration, custom flows

**Tasks**:
- [ ] Implement token exchange (RFC 8693) for service-to-service auth
- [ ] Add dynamic client registration (RFC 7591)
- [ ] Create device authorization flow (RFC 8628) for IoT devices
- [ ] Build custom grant types for specific use cases
- [ ] Add OAuth2 resource server validation

### Week 3: RBAC & Permission System (Days 15-21)

#### Day 15-17: Role-Based Access Control Engine
**Learning Focus**: RBAC models, permission hierarchies, policy evaluation

**Tasks**:
- [ ] Design hierarchical role system with inheritance
- [ ] Implement fine-grained permission model
- [ ] Create policy evaluation engine with context-aware decisions
- [ ] Build permission caching for performance
- [ ] Add dynamic role assignment based on attributes

**RBAC Implementation**:
```java
@Entity
public class Role {
    @Id
    @GeneratedValue(generator = "UUID")
    private UUID id;
    
    @Column(unique = true)
    private String name;
    
    private String description;
    
    @ManyToMany
    @JoinTable(name = "role_permissions",
        joinColumns = @JoinColumn(name = "role_id"),
        inverseJoinColumns = @JoinColumn(name = "permission_id"))
    private Set<Permission> permissions = new HashSet<>();
    
    @ManyToMany
    @JoinTable(name = "role_hierarchy",
        joinColumns = @JoinColumn(name = "child_role_id"),
        inverseJoinColumns = @JoinColumn(name = "parent_role_id"))
    private Set<Role> parentRoles = new HashSet<>();
    
    @JsonIgnore
    @ManyToMany(mappedBy = "parentRoles")
    private Set<Role> childRoles = new HashSet<>();
}

@Entity
public class Permission {
    @Id
    @GeneratedValue(generator = "UUID")
    private UUID id;
    
    @Column(unique = true)
    private String name; // e.g., "course:read", "payment:process"
    
    private String resource;
    private String action;
    
    @Enumerated(EnumType.STRING)
    private PermissionType type; // ALLOW, DENY
    
    // Conditions for context-aware permissions
    @OneToMany(mappedBy = "permission", cascade = CascadeType.ALL)
    private Set<PermissionCondition> conditions = new HashSet<>();
}

@Service
public class RBACService {
    private final PermissionCache permissionCache;
    
    @Cacheable("user-permissions")
    public Set<Permission> getUserPermissions(UUID userId) {
        User user = userRepository.findById(userId)
            .orElseThrow(() -> new UserNotFoundException(userId));
        
        Set<Permission> allPermissions = new HashSet<>();
        
        // Collect permissions from all roles (including inherited)
        for (Role role : user.getRoles()) {
            allPermissions.addAll(collectRolePermissions(role, new HashSet<>()));
        }
        
        return allPermissions;
    }
    
    private Set<Permission> collectRolePermissions(Role role, Set<Role> visited) {
        if (visited.contains(role)) return new HashSet<>();
        visited.add(role);
        
        Set<Permission> permissions = new HashSet<>(role.getPermissions());
        
        // Recursively collect parent role permissions
        for (Role parentRole : role.getParentRoles()) {
            permissions.addAll(collectRolePermissions(parentRole, visited));
        }
        
        return permissions;
    }
    
    public boolean hasPermission(UUID userId, String resource, String action, 
                               Map<String, Object> context) {
        Set<Permission> userPermissions = getUserPermissions(userId);
        
        return userPermissions.stream()
            .anyMatch(permission -> 
                matchesResourceAction(permission, resource, action) &&
                evaluateConditions(permission, context));
    }
    
    private boolean evaluateConditions(Permission permission, Map<String, Object> context) {
        return permission.getConditions().stream()
            .allMatch(condition -> evaluateCondition(condition, context));
    }
}
```

#### Day 18-19: Attribute-Based Access Control (ABAC)
**Learning Focus**: ABAC model, policy languages, dynamic evaluation

**Tasks**:
- [ ] Design attribute-based permission system
- [ ] Implement policy evaluation with XACML-like rules
- [ ] Create dynamic role assignment based on user attributes
- [ ] Build policy decision point (PDP) with caching
- [ ] Add time-based and location-based access controls

**ABAC Policy Engine**:
```java
@Entity
public class AccessPolicy {
    @Id
    @GeneratedValue(generator = "UUID")
    private UUID id;
    
    private String name;
    
    @Column(columnDefinition = "json")
    private String policyDocument; // JSON policy definition
    
    @Enumerated(EnumType.STRING)
    private PolicyEffect effect; // PERMIT, DENY
    
    private boolean enabled;
    
    // Policy evaluation order
    private Integer priority;
}

public interface PolicyEvaluationEngine {
    PolicyDecision evaluate(PolicyEvaluationRequest request);
}

@Component
public class XACMLPolicyEngine implements PolicyEvaluationEngine {
    
    public PolicyDecision evaluate(PolicyEvaluationRequest request) {
        PolicyDecision decision = PolicyDecision.INDETERMINATE;
        
        List<AccessPolicy> applicablePolicies = findApplicablePolicies(request);
        
        for (AccessPolicy policy : applicablePolicies) {
            PolicyDocument doc = parsePolicy(policy.getPolicyDocument());
            
            if (evaluateTarget(doc.getTarget(), request)) {
                PolicyDecision ruleDecision = evaluateRules(doc.getRules(), request);
                decision = combineDecisions(decision, ruleDecision);
            }
        }
        
        return decision;
    }
    
    private boolean evaluateTarget(Target target, PolicyEvaluationRequest request) {
        return target.getSubjects().stream().anyMatch(subject -> 
            matchesAttributes(subject.getAttributes(), request.getSubjectAttributes())) &&
        target.getResources().stream().anyMatch(resource ->
            matchesAttributes(resource.getAttributes(), request.getResourceAttributes())) &&
        target.getActions().stream().anyMatch(action ->
            matchesAttributes(action.getAttributes(), request.getActionAttributes()));
    }
}
```

#### Day 20-21: Session Management & Device Tracking
**Learning Focus**: Session lifecycle, concurrent sessions, device fingerprinting

**Tasks**:
- [ ] Implement distributed session storage with Redis
- [ ] Create device registration and trust system
- [ ] Build concurrent session management with limits
- [ ] Add session analytics and monitoring
- [ ] Implement session invalidation across services

### Week 4: Federation & Advanced Features (Days 22-28)

#### Day 22-24: SAML 2.0 Implementation
**Learning Focus**: SAML protocol, XML signatures, identity federation

**Tasks**:
- [ ] Implement SAML 2.0 Identity Provider (IdP)
- [ ] Create SAML Service Provider (SP) integration
- [ ] Build SAML assertion generation and validation
- [ ] Add XML signature verification
- [ ] Implement single logout (SLO) functionality

**SAML Implementation**:
```java
@Service
public class SAMLService {
    private final SAMLObjectBuilder samlBuilder;
    private final SignatureValidator signatureValidator;
    
    public Response generateSAMLResponse(AuthenticationRequest request, User user) {
        Response response = samlBuilder.buildObject(Response.class);
        response.setID(generateId());
        response.setVersion(SAMLVersion.VERSION_20);
        response.setIssueInstant(Instant.now());
        response.setIssuer(buildIssuer());
        
        // Create assertion
        Assertion assertion = buildAssertion(user, request);
        response.getAssertions().add(assertion);
        
        // Sign the response
        signSAMLObject(response);
        
        return response;
    }
    
    private Assertion buildAssertion(User user, AuthenticationRequest request) {
        Assertion assertion = samlBuilder.buildObject(Assertion.class);
        assertion.setID(generateId());
        assertion.setIssueInstant(Instant.now());
        assertion.setIssuer(buildIssuer());
        
        // Subject
        Subject subject = buildSubject(user.getId().toString(), request);
        assertion.setSubject(subject);
        
        // Attribute statement
        AttributeStatement attrStatement = buildAttributeStatement(user);
        assertion.getAttributeStatements().add(attrStatement);
        
        // Authentication statement
        AuthnStatement authnStatement = buildAuthnStatement();
        assertion.getAuthnStatements().add(authnStatement);
        
        return assertion;
    }
}
```

#### Day 25-26: Social Login Integration
**Learning Focus**: OAuth2 client implementation, provider-specific flows

**Tasks**:
- [ ] Integrate Google, Facebook, GitHub OAuth2 providers
- [ ] Implement LinkedIn, Microsoft Azure AD integration
- [ ] Create social account linking and unlinking
- [ ] Build profile synchronization from social providers
- [ ] Add social login analytics and conversion tracking

#### Day 27-28: Advanced Security Features
**Learning Focus**: Risk-based authentication, behavioral analysis

**Tasks**:
- [ ] Implement risk-based authentication scoring
- [ ] Create behavioral biometrics for user verification
- [ ] Build anomaly detection for suspicious activities
- [ ] Add geolocation-based access controls
- [ ] Implement continuous authentication

---

## 📊 Database Schema Design

### PostgreSQL Schema
```sql
-- Users table with comprehensive fields
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'ACTIVE',
    email_verified BOOLEAN DEFAULT FALSE,
    phone_number VARCHAR(20),
    phone_verified BOOLEAN DEFAULT FALSE,
    
    -- Password policy fields
    password_changed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    failed_login_attempts INTEGER DEFAULT 0,
    last_failed_login_at TIMESTAMP,
    locked_until TIMESTAMP,
    
    -- Audit fields
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    created_by UUID,
    updated_by UUID,
    version INTEGER DEFAULT 1
);

-- User profiles with encrypted PII
CREATE TABLE user_profiles (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    first_name VARCHAR(100),
    last_name VARCHAR(100),
    display_name VARCHAR(200),
    avatar_url TEXT,
    date_of_birth DATE,
    timezone VARCHAR(50) DEFAULT 'UTC',
    locale VARCHAR(10) DEFAULT 'en_US',
    
    -- Address information
    address_line1 TEXT,
    address_line2 TEXT,
    city VARCHAR(100),
    state_province VARCHAR(100),
    postal_code VARCHAR(20),
    country_code CHAR(2),
    
    -- GDPR compliance
    data_processing_consent BOOLEAN DEFAULT FALSE,
    consent_date TIMESTAMP,
    
    -- Encrypted fields (using application-level encryption)
    encrypted_ssn TEXT,
    
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Hierarchical role system
CREATE TABLE roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(100) UNIQUE NOT NULL,
    description TEXT,
    is_system BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role hierarchy (many-to-many self-reference)
CREATE TABLE role_hierarchy (
    parent_role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    child_role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    PRIMARY KEY (parent_role_id, child_role_id)
);

-- Granular permissions
CREATE TABLE permissions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) UNIQUE NOT NULL,
    resource VARCHAR(100) NOT NULL,
    action VARCHAR(100) NOT NULL,
    type VARCHAR(10) DEFAULT 'ALLOW',
    description TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Role-permission mapping
CREATE TABLE role_permissions (
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    permission_id UUID REFERENCES permissions(id) ON DELETE CASCADE,
    PRIMARY KEY (role_id, permission_id)
);

-- User-role assignments with temporal constraints
CREATE TABLE user_roles (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role_id UUID REFERENCES roles(id) ON DELETE CASCADE,
    granted_by UUID REFERENCES users(id),
    granted_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    expires_at TIMESTAMP,
    is_active BOOLEAN DEFAULT TRUE,
    UNIQUE(user_id, role_id)
);

-- OAuth2 registered clients
CREATE TABLE oauth2_registered_clients (
    id VARCHAR(100) PRIMARY KEY,
    client_id VARCHAR(100) UNIQUE NOT NULL,
    client_secret VARCHAR(200),
    client_name VARCHAR(200) NOT NULL,
    client_authentication_methods TEXT NOT NULL,
    authorization_grant_types TEXT NOT NULL,
    redirect_uris TEXT,
    scopes TEXT NOT NULL,
    client_settings TEXT NOT NULL,
    token_settings TEXT NOT NULL,
    post_logout_redirect_uris TEXT,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- OAuth2 authorizations (consent and tokens)
CREATE TABLE oauth2_authorizations (
    id VARCHAR(100) PRIMARY KEY,
    registered_client_id VARCHAR(100) NOT NULL,
    principal_name VARCHAR(200) NOT NULL,
    authorization_grant_type VARCHAR(100) NOT NULL,
    authorized_scopes TEXT,
    attributes TEXT,
    state VARCHAR(500),
    authorization_code_value TEXT,
    authorization_code_issued_at TIMESTAMP,
    authorization_code_expires_at TIMESTAMP,
    authorization_code_metadata TEXT,
    access_token_value TEXT,
    access_token_issued_at TIMESTAMP,
    access_token_expires_at TIMESTAMP,
    access_token_metadata TEXT,
    access_token_type VARCHAR(100),
    access_token_scopes TEXT,
    oidc_id_token_value TEXT,
    oidc_id_token_issued_at TIMESTAMP,
    oidc_id_token_expires_at TIMESTAMP,
    oidc_id_token_metadata TEXT,
    refresh_token_value TEXT,
    refresh_token_issued_at TIMESTAMP,
    refresh_token_expires_at TIMESTAMP,
    refresh_token_metadata TEXT,
    user_code_value TEXT,
    user_code_issued_at TIMESTAMP,
    user_code_expires_at TIMESTAMP,
    user_code_metadata TEXT,
    device_code_value TEXT,
    device_code_issued_at TIMESTAMP,
    device_code_expires_at TIMESTAMP,
    device_code_metadata TEXT
);

-- Multi-factor authentication credentials
CREATE TABLE mfa_credentials (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL, -- TOTP, SMS, PUSH, WEBAUTHN
    encrypted_secret TEXT,
    backup_codes TEXT[], -- Encrypted backup codes
    is_primary BOOLEAN DEFAULT FALSE,
    is_verified BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_used_at TIMESTAMP
);

-- Device registration and trust
CREATE TABLE user_devices (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    device_fingerprint VARCHAR(255) UNIQUE NOT NULL,
    device_name VARCHAR(200),
    device_type VARCHAR(50), -- MOBILE, DESKTOP, TABLET
    operating_system VARCHAR(100),
    browser VARCHAR(100),
    is_trusted BOOLEAN DEFAULT FALSE,
    last_seen_ip INET,
    last_seen_location JSONB,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    last_accessed_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Password history for reuse prevention
CREATE TABLE password_history (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Audit log for security events
CREATE TABLE security_audit_log (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id),
    event_type VARCHAR(100) NOT NULL,
    event_details JSONB NOT NULL,
    ip_address INET,
    user_agent TEXT,
    session_id VARCHAR(255),
    risk_score INTEGER,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for performance
CREATE INDEX idx_users_email ON users(email);
CREATE INDEX idx_users_status ON users(status);
CREATE INDEX idx_user_roles_user_id ON user_roles(user_id);
CREATE INDEX idx_user_roles_role_id ON user_roles(role_id);
CREATE INDEX idx_oauth2_auth_client_principal ON oauth2_authorizations(registered_client_id, principal_name);
CREATE INDEX idx_mfa_credentials_user_type ON mfa_credentials(user_id, type);
CREATE INDEX idx_user_devices_user_fingerprint ON user_devices(user_id, device_fingerprint);
CREATE INDEX idx_audit_log_user_event ON security_audit_log(user_id, event_type, created_at);
```

### Redis Schema for Sessions & Caching
```redis
# User sessions
HSET session:${sessionId} 
    "userId" "${userId}"
    "roles" "${roles}"
    "permissions" "${permissions}"
    "deviceFingerprint" "${fingerprint}"
    "ipAddress" "${ip}"
    "createdAt" "${timestamp}"
    "lastAccessedAt" "${timestamp}"
    "expiresAt" "${timestamp}"

# Permission cache (TTL: 15 minutes)
SETEX user_permissions:${userId} 900 "${permissionSet}"

# Failed login attempts (sliding window)
ZADD failed_logins:${userId} ${timestamp} "${timestamp}-${ip}"

# Rate limiting for authentication
SET auth_rate_limit:${ip} 1 EX 60  # 1 attempt per minute per IP

# Device trust cache
SETEX trusted_device:${userId}:${fingerprint} 86400 "true"

# OAuth2 authorization codes (short-lived)
SETEX oauth2_code:${authCode} 600 "${clientId}:${userId}:${codeChallenge}"

# TOTP rate limiting (prevent brute force)
SET totp_attempts:${userId} 1 EX 30  # 1 attempt per 30 seconds
```

---

## 🔌 API Design & Specifications

### OpenAPI 3.0 Specification
```yaml
openapi: 3.0.3
info:
  title: Suuupra Identity Service API
  version: 1.0.0
  description: Comprehensive identity and access management service

paths:
  # User Management
  /api/v1/users:
    post:
      summary: Register new user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/UserRegistrationRequest'
      responses:
        '201':
          description: User created successfully
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'
        '400':
          description: Validation error
        '409':
          description: User already exists

    get:
      summary: List users (admin only)
      security:
        - bearerAuth: []
      parameters:
        - name: page
          in: query
          schema:
            type: integer
            default: 0
        - name: size
          in: query
          schema:
            type: integer
            default: 20
        - name: search
          in: query
          schema:
            type: string
      responses:
        '200':
          description: User list retrieved
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PagedUserResponse'

  /api/v1/users/{userId}:
    get:
      summary: Get user by ID
      security:
        - bearerAuth: []
      parameters:
        - name: userId
          in: path
          required: true
          schema:
            type: string
            format: uuid
      responses:
        '200':
          description: User details
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/UserResponse'

  /api/v1/auth/login:
    post:
      summary: Authenticate user
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/LoginRequest'
      responses:
        '200':
          description: Authentication successful
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/AuthenticationResponse'
        '401':
          description: Invalid credentials
        '423':
          description: Account locked

  /api/v1/auth/mfa/setup:
    post:
      summary: Setup multi-factor authentication
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/MFASetupRequest'
      responses:
        '200':
          description: MFA setup initiated
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/MFASetupResponse'

  # OAuth2 Endpoints
  /oauth2/authorize:
    get:
      summary: OAuth2 authorization endpoint
      parameters:
        - name: response_type
          in: query
          required: true
          schema:
            type: string
            enum: [code, token]
        - name: client_id
          in: query
          required: true
          schema:
            type: string
        - name: redirect_uri
          in: query
          required: true
          schema:
            type: string
        - name: scope
          in: query
          schema:
            type: string
        - name: state
          in: query
          schema:
            type: string

  /oauth2/token:
    post:
      summary: OAuth2 token endpoint
      requestBody:
        required: true
        content:
          application/x-www-form-urlencoded:
            schema:
              $ref: '#/components/schemas/TokenRequest'
      responses:
        '200':
          description: Token issued
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/TokenResponse'

  # RBAC Endpoints
  /api/v1/roles:
    get:
      summary: List all roles
      security:
        - bearerAuth: []
      responses:
        '200':
          description: Roles list
          content:
            application/json:
              schema:
                type: array
                items:
                  $ref: '#/components/schemas/Role'

    post:
      summary: Create new role
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/CreateRoleRequest'
      responses:
        '201':
          description: Role created

  /api/v1/permissions/check:
    post:
      summary: Check user permissions
      security:
        - bearerAuth: []
      requestBody:
        required: true
        content:
          application/json:
            schema:
              $ref: '#/components/schemas/PermissionCheckRequest'
      responses:
        '200':
          description: Permission check result
          content:
            application/json:
              schema:
                $ref: '#/components/schemas/PermissionCheckResponse'

components:
  schemas:
    UserRegistrationRequest:
      type: object
      required: [email, password, firstName, lastName]
      properties:
        email:
          type: string
          format: email
          maxLength: 255
        password:
          type: string
          minLength: 12
          maxLength: 128
        firstName:
          type: string
          maxLength: 100
        lastName:
          type: string
          maxLength: 100
        phoneNumber:
          type: string
          pattern: '^[+]?[1-9]\d{1,14}$'
        dateOfBirth:
          type: string
          format: date
        timezone:
          type: string
          default: UTC

    UserResponse:
      type: object
      properties:
        id:
          type: string
          format: uuid
        email:
          type: string
          format: email
        status:
          type: string
          enum: [ACTIVE, INACTIVE, SUSPENDED, PENDING_VERIFICATION]
        profile:
          $ref: '#/components/schemas/UserProfile'
        roles:
          type: array
          items:
            $ref: '#/components/schemas/Role'
        createdAt:
          type: string
          format: date-time
        lastLoginAt:
          type: string
          format: date-time

    LoginRequest:
      type: object
      required: [email, password]
      properties:
        email:
          type: string
          format: email
        password:
          type: string
        mfaCode:
          type: string
          pattern: '^\d{6}$'
        deviceFingerprint:
          type: string
        rememberDevice:
          type: boolean
          default: false

    AuthenticationResponse:
      type: object
      properties:
        accessToken:
          type: string
          description: JWT access token
        refreshToken:
          type: string
          description: Refresh token
        tokenType:
          type: string
          default: Bearer
        expiresIn:
          type: integer
          description: Token expiry in seconds
        user:
          $ref: '#/components/schemas/UserResponse'
        mfaRequired:
          type: boolean
          description: Whether MFA is required
        trustedDevice:
          type: boolean
          description: Whether device is trusted

  securitySchemes:
    bearerAuth:
      type: http
      scheme: bearer
      bearerFormat: JWT
```

---

## 🧪 Testing Strategy

### Unit Tests (Target: 95% Coverage)
```java
@ExtendWith(MockitoExtension.class)
class UserServiceTest {
    
    @Mock
    private UserRepository userRepository;
    
    @Mock
    private PasswordService passwordService;
    
    @Mock
    private EmailService emailService;
    
    @InjectMocks
    private UserService userService;
    
    @Test
    void shouldCreateUserWithValidData() {
        // Given
        CreateUserRequest request = CreateUserRequest.builder()
            .email("test@example.com")
            .password("StrongPassword123!")
            .firstName("John")
            .lastName("Doe")
            .build();
            
        when(userRepository.existsByEmail(request.getEmail())).thenReturn(false);
        when(passwordService.hashPassword(request.getPassword())).thenReturn("hashedPassword");
        
        User savedUser = User.builder()
            .id(UUID.randomUUID())
            .email(request.getEmail())
            .passwordHash("hashedPassword")
            .status(UserStatus.PENDING_VERIFICATION)
            .build();
            
        when(userRepository.save(any(User.class))).thenReturn(savedUser);
        
        // When
        UserResponse response = userService.createUser(request);
        
        // Then
        assertThat(response).isNotNull();
        assertThat(response.getEmail()).isEqualTo(request.getEmail());
        assertThat(response.getStatus()).isEqualTo(UserStatus.PENDING_VERIFICATION);
        
        verify(emailService).sendVerificationEmail(savedUser);
    }
    
    @Test
    void shouldThrowExceptionWhenEmailAlreadyExists() {
        // Given
        CreateUserRequest request = CreateUserRequest.builder()
            .email("existing@example.com")
            .password("StrongPassword123!")
            .build();
            
        when(userRepository.existsByEmail(request.getEmail())).thenReturn(true);
        
        // When & Then
        assertThrows(UserAlreadyExistsException.class, 
                   () -> userService.createUser(request));
    }
}

@SpringBootTest
@Transactional
class RBACServiceIntegrationTest {
    
    @Autowired
    private RBACService rbacService;
    
    @Autowired
    private TestEntityManager entityManager;
    
    @Test
    void shouldInheritPermissionsFromParentRoles() {
        // Given - Create role hierarchy
        Role adminRole = createRole("ADMIN");
        Role managerRole = createRole("MANAGER");
        Role userRole = createRole("USER");
        
        Permission readPermission = createPermission("user:read");
        Permission writePermission = createPermission("user:write");
        Permission deletePermission = createPermission("user:delete");
        
        // Setup hierarchy: ADMIN -> MANAGER -> USER
        managerRole.getParentRoles().add(adminRole);
        userRole.getParentRoles().add(managerRole);
        
        // Assign permissions
        userRole.getPermissions().add(readPermission);
        managerRole.getPermissions().add(writePermission);
        adminRole.getPermissions().add(deletePermission);
        
        entityManager.persistAndFlush(userRole);
        
        User testUser = createUser("test@example.com");
        testUser.getRoles().add(userRole);
        entityManager.persistAndFlush(testUser);
        
        // When
        Set<Permission> effectivePermissions = rbacService.getUserPermissions(testUser.getId());
        
        // Then
        assertThat(effectivePermissions).hasSize(3);
        assertThat(effectivePermissions.stream().map(Permission::getName))
            .containsExactlyInAnyOrder("user:read", "user:write", "user:delete");
    }
}
```

### Integration Tests
```java
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Testcontainers
class OAuth2IntegrationTest {
    
    @Container
    static PostgreSQLContainer<?> postgres = new PostgreSQLContainer<>("postgres:15")
            .withDatabaseName("identity_test")
            .withUsername("test")
            .withPassword("test");
            
    @Container
    static GenericContainer<?> redis = new GenericContainer<>("redis:7-alpine")
            .withExposedPorts(6379);
    
    @Autowired
    private TestRestTemplate restTemplate;
    
    @Autowired
    private RegisteredClientRepository clientRepository;
    
    @Test
    void shouldCompleteAuthorizationCodeFlow() {
        // Given - Register OAuth2 client
        RegisteredClient client = RegisteredClient.withId(UUID.randomUUID().toString())
            .clientId("test-client")
            .clientSecret("{noop}test-secret")
            .authorizationGrantType(AuthorizationGrantType.AUTHORIZATION_CODE)
            .redirectUri("http://localhost:8080/callback")
            .scope("read", "write")
            .build();
            
        clientRepository.save(client);
        
        // When - Request authorization
        String authUrl = "/oauth2/authorize?response_type=code&client_id=test-client" +
                        "&redirect_uri=http://localhost:8080/callback&scope=read&state=xyz";
        
        ResponseEntity<String> authResponse = restTemplate.getForEntity(authUrl, String.class);
        
        // Then - Should redirect to login
        assertThat(authResponse.getStatusCode()).isEqualTo(HttpStatus.FOUND);
        assertThat(authResponse.getHeaders().getLocation().getPath()).isEqualTo("/login");
    }
}
```

### Load Tests (K6)
```javascript
import http from 'k6/http';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

export let options = {
  stages: [
    { duration: '5m', target: 100 },
    { duration: '10m', target: 500 },
    { duration: '5m', target: 0 },
  ],
  thresholds: {
    http_req_duration: ['p(99)<200'],
    http_req_failed: ['rate<0.01'],
  },
};

let errorRate = new Rate('errors');

export default function () {
  // Test user authentication
  let loginPayload = JSON.stringify({
    email: 'loadtest@example.com',
    password: 'LoadTest123!'
  });
  
  let params = {
    headers: {
      'Content-Type': 'application/json',
    },
  };
  
  let response = http.post('http://localhost:8080/api/v1/auth/login', loginPayload, params);
  
  let success = check(response, {
    'login status is 200': (r) => r.status === 200,
    'login response has token': (r) => JSON.parse(r.body).accessToken !== undefined,
    'response time < 200ms': (r) => r.timings.duration < 200,
  });
  
  if (!success) {
    errorRate.add(1);
  }
  
  if (response.status === 200) {
    let token = JSON.parse(response.body).accessToken;
    
    // Test protected endpoint
    let profileResponse = http.get('http://localhost:8080/api/v1/users/me', {
      headers: {
        'Authorization': `Bearer ${token}`,
      },
    });
    
    check(profileResponse, {
      'profile status is 200': (r) => r.status === 200,
      'profile has user data': (r) => JSON.parse(r.body).email !== undefined,
    });
  }
  
  sleep(1);
}
```

---

## 🚀 Performance Targets & Optimization

### Performance Requirements
- **Authentication Latency**: p99 < 200ms for login operations
- **Token Validation**: p99 < 50ms for JWT validation
- **Permission Checks**: p99 < 100ms for RBAC evaluation
- **Throughput**: 10,000+ authentication requests per second
- **Memory**: < 2GB RAM under peak load

### Optimization Techniques

#### 1. Permission Caching
```java
@Component
public class PermissionCache {
    private final Cache<String, Set<Permission>> cache;
    
    public PermissionCache() {
        this.cache = Caffeine.newBuilder()
            .maximumSize(10_000)
            .expireAfterWrite(Duration.ofMinutes(15))
            .recordStats()
            .build();
    }
    
    public Set<Permission> getUserPermissions(UUID userId) {
        return cache.get(userId.toString(), this::loadUserPermissions);
    }
    
    private Set<Permission> loadUserPermissions(String userId) {
        // Load from database with role hierarchy traversal
        return rbacService.computeUserPermissions(UUID.fromString(userId));
    }
    
    public void evictUserPermissions(UUID userId) {
        cache.invalidate(userId.toString());
    }
}
```

#### 2. Database Connection Pooling
```yaml
spring:
  datasource:
    hikari:
      maximum-pool-size: 50
      minimum-idle: 10
      idle-timeout: 600000
      max-lifetime: 1800000
      connection-timeout: 30000
      validation-timeout: 5000
      leak-detection-threshold: 60000
```

#### 3. JWT Processing Optimization
```java
@Component
public class JWTProcessor {
    private final Cache<String, RSAPublicKey> keyCache;
    private final JWTParser jwtParser;
    
    public JWTClaimsSet validateToken(String token) throws JOSEException, ParseException {
        SignedJWT signedJWT = SignedJWT.parse(token);
        
        // Cache public keys for signature verification
        String keyId = signedJWT.getHeader().getKeyID();
        RSAPublicKey publicKey = keyCache.get(keyId, this::loadPublicKey);
        
        JWSVerifier verifier = new RSASSAVerifier(publicKey);
        
        if (!signedJWT.verify(verifier)) {
            throw new JWTVerificationException("Invalid signature");
        }
        
        JWTClaimsSet claimsSet = signedJWT.getJWTClaimsSet();
        
        // Validate expiration
        if (claimsSet.getExpirationTime().before(new Date())) {
            throw new JWTExpiredException("Token expired");
        }
        
        return claimsSet;
    }
}
```

---

## 🔒 Security Considerations

### Security Requirements
- OWASP Top 10 compliance
- PCI DSS Level 1 compliance for payment-related identity data
- GDPR compliance for EU users
- SOC 2 Type II compliance

### Security Implementation

#### 1. Password Security
```java
@Service
public class SecurePasswordService {
    private final Argon2 argon2;
    private final HibpClient hibpClient; // Have I Been Pwned API
    
    public PasswordValidationResult validatePasswordStrength(String password, User user) {
        List<String> violations = new ArrayList<>();
        
        // Entropy calculation
        double entropy = calculateEntropy(password);
        if (entropy < 50) { // bits of entropy
            violations.add("Password entropy too low");
        }
        
        // Dictionary attack prevention
        if (isCommonPassword(password)) {
            violations.add("Password is commonly used");
        }
        
        // Personal information check
        if (containsPersonalInfo(password, user)) {
            violations.add("Password contains personal information");
        }
        
        // Breach database check
        if (hibpClient.isPasswordBreached(password)) {
            violations.add("Password found in data breaches");
        }
        
        return new PasswordValidationResult(violations.isEmpty(), violations);
    }
    
    private double calculateEntropy(String password) {
        Map<Character, Integer> frequency = new HashMap<>();
        for (char c : password.toCharArray()) {
            frequency.merge(c, 1, Integer::sum);
        }
        
        double entropy = 0;
        int length = password.length();
        
        for (int count : frequency.values()) {
            double probability = (double) count / length;
            entropy -= probability * (Math.log(probability) / Math.log(2));
        }
        
        return entropy * length;
    }
}
```

#### 2. Session Security
```java
@Component
public class SecureSessionManager {
    private final RedisTemplate<String, String> redisTemplate;
    private final AESUtil aesUtil;
    
    public String createSecureSession(User user, HttpServletRequest request) {
        String sessionId = generateSecureSessionId();
        
        SessionData sessionData = SessionData.builder()
            .userId(user.getId())
            .userAgent(request.getHeader("User-Agent"))
            .ipAddress(getClientIP(request))
            .deviceFingerprint(generateDeviceFingerprint(request))
            .createdAt(Instant.now())
            .lastAccessedAt(Instant.now())
            .build();
        
        // Encrypt session data
        String encryptedData = aesUtil.encrypt(sessionData.toJson());
        
        // Store with expiration
        redisTemplate.opsForValue().set(
            "session:" + sessionId, 
            encryptedData, 
            Duration.ofHours(24)
        );
        
        // Track concurrent sessions
        redisTemplate.opsForSet().add("user_sessions:" + user.getId(), sessionId);
        
        return sessionId;
    }
    
    public boolean validateSession(String sessionId, HttpServletRequest request) {
        String encryptedData = redisTemplate.opsForValue().get("session:" + sessionId);
        if (encryptedData == null) return false;
        
        SessionData sessionData = SessionData.fromJson(aesUtil.decrypt(encryptedData));
        
        // Validate IP address (with some tolerance for mobile networks)
        String currentIP = getClientIP(request);
        if (!isSameNetwork(sessionData.getIpAddress(), currentIP)) {
            logSecurityEvent("IP_ADDRESS_CHANGE", sessionData.getUserId(), request);
            return false;
        }
        
        // Validate device fingerprint
        String currentFingerprint = generateDeviceFingerprint(request);
        if (!sessionData.getDeviceFingerprint().equals(currentFingerprint)) {
            logSecurityEvent("DEVICE_FINGERPRINT_CHANGE", sessionData.getUserId(), request);
            return false;
        }
        
        return true;
    }
}
```

#### 3. Cryptographic Key Management
```java
@Configuration
public class CryptographicConfig {
    
    @Bean
    public JWKSet jwkSet() throws NoSuchAlgorithmException {
        KeyPairGenerator generator = KeyPairGenerator.getInstance("RSA");
        generator.initialize(2048);
        KeyPair keyPair = generator.generateKeyPair();
        
        RSAKey rsaKey = new RSAKey.Builder((RSAPublicKey) keyPair.getPublic())
            .privateKey((RSAPrivateKey) keyPair.getPrivate())
            .keyID(UUID.randomUUID().toString())
            .keyUse(KeyUse.SIGNATURE)
            .algorithm(JWSAlgorithm.RS256)
            .build();
            
        return new JWKSet(rsaKey);
    }
    
    @Bean
    public PasswordEncoder passwordEncoder() {
        return new Argon2PasswordEncoder(16, 32, 1, 4096, 3);
    }
    
    @Bean
    public AESUtil aesEncryption(@Value("${app.encryption.key}") String encryptionKey) {
        return new AESUtil(encryptionKey);
    }
}
```

---

## 📊 Monitoring & Observability

### Metrics Collection
```java
@Component
public class IdentityMetrics {
    private final MeterRegistry meterRegistry;
    
    private final Counter loginAttempts;
    private final Counter loginSuccesses;
    private final Counter loginFailures;
    private final Timer authenticationDuration;
    private final Gauge activeSessions;
    
    public IdentityMetrics(MeterRegistry meterRegistry) {
        this.meterRegistry = meterRegistry;
        
        this.loginAttempts = Counter.builder("identity_login_attempts_total")
            .description("Total number of login attempts")
            .tag("service", "identity")
            .register(meterRegistry);
            
        this.loginSuccesses = Counter.builder("identity_login_success_total")
            .description("Total number of successful logins")
            .register(meterRegistry);
            
        this.authenticationDuration = Timer.builder("identity_authentication_duration")
            .description("Time spent authenticating users")
            .register(meterRegistry);
            
        this.activeSessions = Gauge.builder("identity_active_sessions")
            .description("Number of active user sessions")
            .register(meterRegistry, this, IdentityMetrics::getActiveSessionCount);
    }
    
    public void recordLoginAttempt(String method, String result) {
        loginAttempts.increment(Tags.of("method", method, "result", result));
    }
    
    public Timer.Sample startAuthenticationTimer() {
        return Timer.start(meterRegistry);
    }
    
    private double getActiveSessionCount() {
        return sessionManager.getActiveSessionCount();
    }
}
```

### Health Checks
```java
@Component
public class IdentityHealthIndicator implements HealthIndicator {
    
    private final UserRepository userRepository;
    private final RedisTemplate<String, String> redisTemplate;
    private final JWKSet jwkSet;
    
    @Override
    public Health health() {
        Health.Builder builder = Health.up();
        
        try {
            // Database connectivity
            long userCount = userRepository.count();
            builder.withDetail("database", Map.of(
                "status", "UP",
                "userCount", userCount
            ));
            
            // Redis connectivity
            String redisResult = redisTemplate.opsForValue().get("health_check");
            builder.withDetail("redis", Map.of(
                "status", "UP",
                "connection", "active"
            ));
            
            // JWT keys availability
            builder.withDetail("jwt", Map.of(
                "status", "UP",
                "keyCount", jwkSet.getKeys().size()
            ));
            
        } catch (Exception e) {
            builder.down().withException(e);
        }
        
        return builder.build();
    }
}
```

---

## 🎯 Learning Milestones & CS Concepts

### Week 1 Milestones
- [ ] **User Lifecycle Management**: Master user registration, verification, and profile management patterns
- [ ] **Cryptographic Hashing**: Understand Argon2, salt generation, and password security best practices
- [ ] **Hash Table Applications**: Apply hash tables for O(1) user lookups and session storage

### Week 2 Milestones
- [ ] **OAuth2 Protocol Mastery**: Deep understanding of authorization flows, token lifecycle, and security considerations
- [ ] **State Machine Design**: Implement OAuth2 flows as state machines with proper transition handling
- [ ] **Distributed Token Management**: Handle token storage, validation, and revocation across services

### Week 3 Milestones
- [ ] **Graph Algorithms**: Apply DFS for role hierarchy traversal and permission inheritance
- [ ] **Tree Structures**: Use tries for efficient permission matching and wildcard support
- [ ] **Caching Strategies**: Implement multi-level caching for permission evaluation performance

### Week 4 Milestones
- [ ] **Protocol Implementation**: Master SAML 2.0, OpenID Connect, and federation protocols
- [ ] **Security Engineering**: Apply defense-in-depth, risk-based authentication, and behavioral analysis
- [ ] **Compliance Engineering**: Implement GDPR, SOC 2, and PCI DSS compliance requirements

### Computer Science Concepts Applied

**Data Structures**:
- Hash Tables: User directory, session storage, permission caching
- Graphs: Role hierarchies, permission inheritance, social connections
- Trees: Permission trees, organizational hierarchies, trie-based matching
- Heaps: Priority queues for authentication attempts, rate limiting

**Algorithms**:
- Graph Traversal: DFS/BFS for role inheritance and permission computation
- String Matching: Efficient permission pattern matching with wildcards
- Cryptographic Algorithms: Argon2, PBKDF2, AES encryption, RSA signatures
- Probabilistic Algorithms: Bloom filters for breach detection, HyperLogLog for analytics

**Security & Cryptography**:
- Digital Signatures: JWT RS256 signing and verification
- Hash Functions: Password hashing, integrity verification, HMAC
- Symmetric/Asymmetric Encryption: Session data protection, key exchange
- Zero-Knowledge Proofs: Advanced authentication without password transmission

---

## ✅ Completion Checklist

### Core Functionality
- [ ] User registration and lifecycle management
- [ ] Multi-factor authentication (TOTP, SMS, Push)
- [ ] OAuth2 authorization server with PKCE support
- [ ] OpenID Connect implementation with ID tokens
- [ ] RBAC system with hierarchical permissions
- [ ] Session management with device tracking
- [ ] Password policies and breach detection
- [ ] Social login integration

### Advanced Features
- [ ] SAML 2.0 Identity Provider implementation
- [ ] Attribute-based access control (ABAC)
- [ ] Risk-based authentication scoring
- [ ] Behavioral biometrics and anomaly detection
- [ ] Federation with external identity providers
- [ ] Dynamic client registration for OAuth2
- [ ] Device authorization flow for IoT devices

### Performance & Scale
- [ ] Achieve <200ms p99 latency for authentication
- [ ] Handle 10k+ concurrent authentication requests
- [ ] Permission caching reduces database load by 90%
- [ ] Session validation under 50ms p99
- [ ] Memory usage optimized with connection pooling

### Security & Compliance
- [ ] OWASP Top 10 vulnerabilities addressed
- [ ] PCI DSS compliance for payment-related identity data
- [ ] GDPR compliance with data export and deletion
- [ ] SOC 2 audit controls implemented
- [ ] Comprehensive security event logging

### Monitoring & Operations
- [ ] Comprehensive metrics collection and dashboards
- [ ] Distributed tracing for authentication flows
- [ ] Health checks for all dependencies
- [ ] Automated alerting for security events
- [ ] Performance monitoring and capacity planning

### Documentation & Testing
- [ ] OpenAPI specification with all endpoints
- [ ] Unit test coverage >95%
- [ ] Integration tests for OAuth2 flows
- [ ] Load tests validating performance requirements
- [ ] Security testing and penetration testing results

**Next Service**: Move to `services/content/TODO.md` for content management and search implementation.

---

*This Identity Service forms the security foundation for the entire Suuupra platform. Master these identity and access management patterns before proceeding to domain-specific services.*