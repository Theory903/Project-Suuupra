package com.suuupra.identity.auth.service;

import com.suuupra.identity.auth.dto.AuthResponse;
import com.suuupra.identity.auth.dto.LoginRequest;
import com.suuupra.identity.auth.dto.RegisterRequest;
import com.suuupra.identity.auth.jwt.JwtService;
import com.suuupra.identity.user.entity.Role;
import com.suuupra.identity.user.entity.User;
import com.suuupra.identity.user.repository.RoleRepository;
import com.suuupra.identity.user.repository.UserRepository;
import org.springframework.security.authentication.AuthenticationManager;
import org.springframework.security.authentication.UsernamePasswordAuthenticationToken;
import org.springframework.security.core.Authentication;
import org.springframework.security.core.GrantedAuthority;
import org.springframework.security.core.authority.SimpleGrantedAuthority;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.security.core.userdetails.UserDetailsService;
import org.springframework.security.core.userdetails.UsernameNotFoundException;
import org.springframework.security.crypto.password.PasswordEncoder;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.context.annotation.Lazy;

import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.UUID;

@Service
public class AuthService implements UserDetailsService {

    private final UserRepository userRepository;
    private final RoleRepository roleRepository;
    private final PasswordEncoder passwordEncoder;
    private final AuthenticationManager authenticationManager;
    private final JwtService jwtService;
    private final RefreshTokenService refreshTokenService;
    private final SessionService sessionService;
    private final AccessTokenDenylistService denylistService;
    private final PasswordPolicyService passwordPolicyService;
    private final com.suuupra.identity.common.util.RequestContextProvider requestContextProvider;
    private final AuthRateLimiter authRateLimiter;
    private final LoginAttemptService loginAttemptService;
    private final HibpService hibpService;

    public AuthService(UserRepository userRepository,
                       RoleRepository roleRepository,
                       PasswordEncoder passwordEncoder,
                       @Lazy AuthenticationManager authenticationManager,
                       JwtService jwtService,
                       RefreshTokenService refreshTokenService,
                       SessionService sessionService,
                       AccessTokenDenylistService denylistService,
                       PasswordPolicyService passwordPolicyService,
                       com.suuupra.identity.common.util.RequestContextProvider requestContextProvider,
                       AuthRateLimiter authRateLimiter,
                       LoginAttemptService loginAttemptService,
                       HibpService hibpService) {
        this.userRepository = userRepository;
        this.roleRepository = roleRepository;
        this.passwordEncoder = passwordEncoder;
        this.authenticationManager = authenticationManager;
        this.jwtService = jwtService;
        this.refreshTokenService = refreshTokenService;
        this.sessionService = sessionService;
        this.denylistService = denylistService;
        this.passwordPolicyService = passwordPolicyService;
        this.requestContextProvider = requestContextProvider;
        this.authRateLimiter = authRateLimiter;
        this.loginAttemptService = loginAttemptService;
        this.hibpService = hibpService;
    }

    @Transactional
    public AuthResponse register(RegisterRequest request) {
        Optional<User> existing = userRepository.findByEmail(request.getEmail());
        if (existing.isPresent()) {
            throw new IllegalArgumentException("Email already registered");
        }
        passwordPolicyService.validatePassword(request.getPassword());
        if (hibpService.isLikelyCompromised(request.getPassword())) {
            throw new IllegalArgumentException("Password found in breach list");
        }
        User user = new User();
        user.setEmail(request.getEmail());
        user.setPasswordHash(passwordEncoder.encode(request.getPassword()));

        // Assign default role if exists
        roleRepository.findByName("USER").ifPresent(role -> user.getRoles().add(role));

        User saved = userRepository.save(user);
        String[] roles = saved.getRoles().stream().map(Role::getName).toArray(String[]::new);
        String sid = sessionService.createSession();
        String accessToken = jwtService.generateAccessToken(saved.getEmail(), roles, Map.of("sid", sid, "sv", 1));
        String refreshToken = refreshTokenService.issueRefreshToken(saved.getId(), sid);
        // Persist session metadata (optional user-agent/IP could be captured via a request-scoped provider)
        sessionService.persistSession(
            UUID.fromString(sid),
            saved.getId(),
            null,
            null,
            requestContextProvider.getUserAgent(),
            requestContextProvider.getClientIp()
        );
        return new AuthResponse(accessToken, refreshToken, 0, new String[]{"pwd"});
    }

    public AuthResponse login(LoginRequest request) {
        // Rate limit logins per email/IP
        String ip = requestContextProvider.getClientIp();
        if (!authRateLimiter.allow("login:" + request.getEmail())) {
            throw new IllegalArgumentException("Too many attempts");
        }
        if (ip != null && !authRateLimiter.allow("login-ip:" + ip)) {
            throw new IllegalArgumentException("Too many attempts from IP");
        }
        long backoff = loginAttemptService.backoffSeconds(request.getEmail());
        if (backoff > 0) {
            throw new IllegalArgumentException("Account temporarily locked. Retry in " + backoff + "s");
        }
        Authentication authentication;
        try {
            authentication = authenticationManager.authenticate(
                new UsernamePasswordAuthenticationToken(request.getEmail(), request.getPassword())
            );
            loginAttemptService.reset(request.getEmail());
        } catch (Exception e) {
            loginAttemptService.recordFailure(request.getEmail());
            throw e;
        }
        org.springframework.security.core.userdetails.User principal = (org.springframework.security.core.userdetails.User) authentication.getPrincipal();
        String[] roles = principal.getAuthorities().stream().map(GrantedAuthority::getAuthority).toArray(String[]::new);
        User user = userRepository.findByEmail(principal.getUsername()).orElseThrow();
        String sid = sessionService.createSession();
        String token = jwtService.generateAccessToken(principal.getUsername(), roles, Map.of("sid", sid, "sv", 1, "amr", new String[]{"pwd"}, "mfa_level", 0));
        String refreshToken = refreshTokenService.issueRefreshToken(user.getId(), sid);
        sessionService.persistSession(
            UUID.fromString(sid),
            user.getId(),
            null,
            null,
            requestContextProvider.getUserAgent(),
            requestContextProvider.getClientIp()
        );
        return new AuthResponse(token, refreshToken, 0, new String[]{"pwd"});
    }

    @Override
    public UserDetails loadUserByUsername(String username) throws UsernameNotFoundException {
        User user = userRepository.findByEmail(username)
            .orElseThrow(() -> new UsernameNotFoundException("User not found"));
        Set<GrantedAuthority> authorities = user.getRoles().stream()
            .map(role -> new SimpleGrantedAuthority(role.getName()))
            .collect(Collectors.toSet());
        return new org.springframework.security.core.userdetails.User(
            user.getEmail(),
            user.getPasswordHash(),
            authorities
        );
    }

    public AuthResponse refresh(String refreshToken) {
        var parsed = refreshTokenService.validateAndRotateRefreshToken(refreshToken);
        User user = userRepository.findById(parsed.userId()).orElseThrow(() -> new UsernameNotFoundException("User not found"));
        String sid = parsed.sid() != null ? parsed.sid() : sessionService.createSession();
        int newVersion = sessionService.incrementVersion(sid);
        String[] roles = user.getRoles().stream().map(Role::getName).toArray(String[]::new);
        String access = jwtService.generateAccessToken(user.getEmail(), roles, Map.of("sid", sid, "sv", newVersion, "amr", new String[]{"pwd"}, "mfa_level", 0));
        String newRefresh = refreshTokenService.issueRefreshToken(user.getId(), sid);
        return new AuthResponse(access, newRefresh, 0, new String[]{"pwd"});
    }

    public void logout(String refreshToken) {
        var parsed = refreshTokenService.validateAndRotateRefreshToken(refreshToken);
        refreshTokenService.revokeRefreshToken(refreshToken);
        if (parsed.sid() != null) {
            sessionService.incrementVersion(parsed.sid());
        }
    }

    public Map<String, Object> introspect(String token) {
        boolean active = jwtService.isTokenValid(token);
        if (!active) return Map.of("active", false);
        try {
            String sub = jwtService.extractSubject(token);
            String jti = jwtService.extractJti(token);
            String sid = jwtService.extractSessionId(token);
            int sv = jwtService.extractSessionVersion(token);
            Integer current = sid != null ? sessionService.getCurrentVersion(sid) : null;
            boolean validSession = current == null || current == 0 || sv == current;
            boolean notRevoked = !denylistService.isRevoked(jti);
            return Map.of(
                "active", validSession && notRevoked,
                "sub", sub,
                "jti", jti,
                "sid", sid,
                "sv", sv
            );
        } catch (Exception e) {
            return Map.of("active", false);
        }
    }

    public void revokeAccessToken(String token) {
        try {
            if (!jwtService.isTokenValid(token)) {
                return;
            }
            String jti = jwtService.extractJti(token);
            long ttl = jwtService.secondsUntilExpiry(token);
            denylistService.revokeJti(jti, ttl);
        } catch (Exception ignored) {
        }
    }

    public void markEmailVerified(String email) {
        userRepository.findByEmail(email).ifPresent(user -> {
            user.setEmailVerified(true);
            userRepository.save(user);
        });
    }

    public UUID getUserIdByEmail(String email) {
        return userRepository.findByEmail(email).map(User::getId).orElseThrow(() -> new UsernameNotFoundException("User not found"));
    }

    public String loadUserByUsernameById(UUID userId) {
        return userRepository.findById(userId).map(User::getEmail).orElse(null);
    }
}
