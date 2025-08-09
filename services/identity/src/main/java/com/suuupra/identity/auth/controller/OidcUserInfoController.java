package com.suuupra.identity.auth.controller;

import com.suuupra.identity.auth.jwt.JwtService;
import com.suuupra.identity.user.entity.Role;
import com.suuupra.identity.user.entity.User;
import com.suuupra.identity.user.repository.UserRepository;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestHeader;
import org.springframework.web.bind.annotation.RestController;

import java.text.ParseException;
import java.util.HashMap;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@RestController
public class OidcUserInfoController {

    private final JwtService jwtService;
    private final UserRepository userRepository;

    public OidcUserInfoController(JwtService jwtService, UserRepository userRepository) {
        this.jwtService = jwtService;
        this.userRepository = userRepository;
    }

    @GetMapping(value = "/userinfo", produces = MediaType.APPLICATION_JSON_VALUE)
    public ResponseEntity<Map<String, Object>> userInfo(@RequestHeader HttpHeaders headers) {
        String auth = headers.getFirst(HttpHeaders.AUTHORIZATION);
        String token = extractBearer(auth);
        if (token == null || !jwtService.isTokenValid(token)) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
        try {
            var scopes = jwtService.extractScopes(token);
            String sub = jwtService.extractSubject(token);
            Map<String, Object> body = new HashMap<>();
            body.put("sub", sub);

            User user = userRepository.findByEmail(sub).orElse(null);
            if (user != null) {
                body.put("preferred_username", user.getEmail());
                if (scopes.isEmpty() || scopes.contains("email")) {
                    body.put("email", user.getEmail());
                    body.put("email_verified", user.isEmailVerified());
                }
                if (scopes.isEmpty() || scopes.contains("profile")) {
                    body.put("name", user.getEmail());
                    Set<String> roles = user.getRoles().stream().map(Role::getName).collect(Collectors.toSet());
                    body.put("roles", roles);
                }
            }
            return ResponseEntity.ok(body);
        } catch (ParseException e) {
            return ResponseEntity.status(HttpStatus.UNAUTHORIZED).build();
        }
    }

    private static String extractBearer(String authorization) {
        if (authorization == null) return null;
        String prefix = "Bearer ";
        if (authorization.regionMatches(true, 0, prefix, 0, prefix.length())) {
            return authorization.substring(prefix.length()).trim();
        }
        return null;
    }
}


