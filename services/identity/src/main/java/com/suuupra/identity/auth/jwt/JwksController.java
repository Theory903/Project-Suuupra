package com.suuupra.identity.auth.jwt;

import com.nimbusds.jose.jwk.JWKSet;
import com.suuupra.identity.keys.SigningKeyService;
import jakarta.servlet.http.HttpServletRequest;
import org.springframework.http.CacheControl;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;
import io.micrometer.core.instrument.Gauge;
import io.micrometer.core.instrument.MeterRegistry;

import java.util.Map;

@RestController
@RequestMapping("/.well-known")
public class JwksController {

    private final SigningKeyService signingKeyService;
    private final MeterRegistry meterRegistry;

    public JwksController(SigningKeyService signingKeyService, MeterRegistry meterRegistry) {
        this.signingKeyService = signingKeyService;
        this.meterRegistry = meterRegistry;
    }

    @GetMapping("/jwks.json")
    public ResponseEntity<Map<String, Object>> jwks(HttpServletRequest request) {
        var jwks = new JWKSet(signingKeyService.getAllPublicJwks());
        var json = jwks.toPublicJWKSet().toJSONObject();
        String etag = Integer.toHexString(json.toString().hashCode());
        String ifNoneMatch = request.getHeader(HttpHeaders.IF_NONE_MATCH);
        if (etag.equals(ifNoneMatch)) {
            return ResponseEntity.status(HttpStatus.NOT_MODIFIED).eTag(etag).build();
        }
        long maxAgeSeconds = java.time.Duration.ofMinutes(5).getSeconds();
        Gauge.builder("jwks_cache_max_age_seconds", () -> maxAgeSeconds).register(meterRegistry);
        return ResponseEntity.ok()
            .cacheControl(CacheControl.maxAge(java.time.Duration.ofSeconds(maxAgeSeconds)))
            .eTag(etag)
            .body(json);
    }
}
