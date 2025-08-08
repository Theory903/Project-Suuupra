package com.suuupra.identity.auth.jwt;

import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWKSet;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.util.Map;

@RestController
@RequestMapping("/.well-known")
public class JwksController {

    private final JwtService jwtService;

    public JwksController(JwtService jwtService) {
        this.jwtService = jwtService;
    }

    @GetMapping("/jwks.json")
    public Map<String, Object> jwks() {
        ECKey ecJwk = new ECKey.Builder(Curve.P_256, jwtService.getEcPublicKey())
            .keyID(jwtService.getCurrentKeyId())
            .build();
        JWKSet jwkSet = new JWKSet(ecJwk);
        return jwkSet.toPublicJWKSet().toJSONObject();
    }
}
