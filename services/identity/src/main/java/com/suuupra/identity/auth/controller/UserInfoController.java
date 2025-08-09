package com.suuupra.identity.auth.controller;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/oidc")
public class UserInfoController {

    @GetMapping("/userinfo")
    public ResponseEntity<Map<String, String>> userinfoDeprecated() {
        return ResponseEntity.status(HttpStatus.GONE)
            .header("X-Auth-Deprecated", "true")
            .header("X-Alt-Endpoint", "/userinfo")
            .body(Map.of("message", "Deprecated. Use built-in OIDC userinfo endpoint."));
    }
}


