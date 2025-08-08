package com.suuupra.identity.auth.controller;

import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/oidc")
public class OidcController {

    @GetMapping("/links")
    public ResponseEntity<Map<String, String>> links() {
        return ResponseEntity.ok(Map.of(
            "authorize", "/oauth2/authorize",
            "token", "/oauth2/token",
            "jwks", "/oauth2/jwks",
            "discovery", "/.well-known/openid-configuration"
        ));
    }
}


