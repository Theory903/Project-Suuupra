package com.suuupra.identity.user.controller;

import com.suuupra.identity.auth.entity.Session;
import com.suuupra.identity.auth.service.AccessTokenDenylistService;
import com.suuupra.identity.auth.service.SessionService;
import com.suuupra.identity.auth.jwt.JwtService;
import com.suuupra.identity.user.entity.User;
import com.suuupra.identity.user.repository.UserRepository;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.security.core.userdetails.UserDetails;
import org.springframework.web.bind.annotation.*;

import java.text.ParseException;
import java.util.List;
import java.util.Map;
import java.util.UUID;

@RestController
@RequestMapping("/api/v1/users")
public class UserController {

    private final UserRepository userRepository;
    private final SessionService sessionService;
    private final JwtService jwtService;
    private final AccessTokenDenylistService denylistService;

    public UserController(UserRepository userRepository, SessionService sessionService, JwtService jwtService, AccessTokenDenylistService denylistService) {
        this.userRepository = userRepository;
        this.sessionService = sessionService;
        this.jwtService = jwtService;
        this.denylistService = denylistService;
    }

    @GetMapping("/me")
    public Map<String, Object> me(@AuthenticationPrincipal UserDetails principal) {
        if (principal == null) return Map.of();
        User user = userRepository.findByEmail(principal.getUsername()).orElseThrow();
        return Map.of(
            "id", user.getId(),
            "email", user.getEmail(),
            "roles", user.getRoles().stream().map(r -> r.getName()).toArray()
        );
    }

    @GetMapping("/sessions")
    @PreAuthorize("hasPermission(null, 'session.read')")
    public List<Session> listSessions(@AuthenticationPrincipal UserDetails principal) {
        User user = userRepository.findByEmail(principal.getUsername()).orElseThrow();
        return sessionService.listUserSessions(user.getId());
    }

    @PostMapping("/sessions/{sid}/revoke")
    @PreAuthorize("hasPermission(null, 'session.revoke')")
    public ResponseEntity<Void> revokeSession(@PathVariable("sid") UUID sid, @AuthenticationPrincipal UserDetails principal) {
        // Ownership check: allow revoke only if session belongs to current user
        User user = userRepository.findByEmail(principal.getUsername()).orElseThrow();
        var sessions = sessionService.listUserSessions(user.getId());
        boolean owns = sessions.stream().anyMatch(s -> s.getId().equals(sid));
        if (!owns) return ResponseEntity.status(403).build();
        sessionService.revokeSession(sid);
        return ResponseEntity.noContent().build();
    }

    @PostMapping("/token/revoke")
    @PreAuthorize("hasPermission(null, 'session.revoke')")
    public ResponseEntity<Void> revokeCurrentAccessToken(@RequestHeader("Authorization") String authorization) throws ParseException {
        if (authorization == null || !authorization.startsWith("Bearer ")) return ResponseEntity.badRequest().build();
        String token = authorization.substring(7);
        String jti = jwtService.extractJti(token);
        long seconds = jwtService.secondsUntilExpiry(token);
        denylistService.revokeJti(jti, seconds);
        return ResponseEntity.noContent().build();
    }
}
