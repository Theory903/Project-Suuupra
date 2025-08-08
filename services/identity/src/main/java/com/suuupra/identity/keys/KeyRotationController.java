package com.suuupra.identity.keys;

import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWKSet;
import com.suuupra.identity.auth.jwt.JwtService;
import org.springframework.http.ResponseEntity;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.util.Map;

@RestController
@RequestMapping("/api/v1/admin/keys")
public class KeyRotationController {

    private final JwtService jwtService;

    public KeyRotationController(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @PostMapping("/rotate")
    @PreAuthorize("hasPermission(null, 'keys.rotate')")
    public ResponseEntity<Map<String, String>> rotate() throws Exception {
        KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
        kpg.initialize(256);
        KeyPair kp = kpg.generateKeyPair();
        // In a full implementation, persist the new keypair and update JwtService atomically
        // Here we just report the new kid that would be used post-rotation
        ECPublicKey pub = (ECPublicKey) kp.getPublic();
        ECPrivateKey priv = (ECPrivateKey) kp.getPrivate();
        ECKey ecJwk = new ECKey.Builder(Curve.P_256, pub).privateKey(priv).build();
        String newKid = ecJwk.computeThumbprint().toString();
        return ResponseEntity.ok(Map.of("nextKid", newKid));
    }
}


