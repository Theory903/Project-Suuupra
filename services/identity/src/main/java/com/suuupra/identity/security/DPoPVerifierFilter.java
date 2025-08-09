package com.suuupra.identity.security;

import jakarta.servlet.FilterChain;
import jakarta.servlet.ServletException;
import jakarta.servlet.http.HttpServletRequest;
import jakarta.servlet.http.HttpServletResponse;
import io.micrometer.core.instrument.Counter;
import io.micrometer.core.instrument.MeterRegistry;
import org.springframework.lang.NonNull;
import org.springframework.core.annotation.AnnotatedElementUtils;
import org.springframework.stereotype.Component;
import org.springframework.web.filter.OncePerRequestFilter;

import java.io.IOException;
import java.security.MessageDigest;
import java.util.Base64;

@Component
public class DPoPVerifierFilter extends OncePerRequestFilter {

    private final DpopReplayService replayService;
    private final DpopNonceService nonceService;
    private final Counter dpopReplayErrors;
    private final Counter dpopCnfMismatch;
    private final Counter dpopNonceChallenges;

    public DPoPVerifierFilter(DpopReplayService replayService, DpopNonceService nonceService, MeterRegistry meterRegistry) {
        this.replayService = replayService;
        this.nonceService = nonceService;
        this.dpopReplayErrors = Counter.builder("dpop_replay_errors_total").register(meterRegistry);
        this.dpopCnfMismatch = Counter.builder("dpop_cnf_mismatch_total").register(meterRegistry);
        this.dpopNonceChallenges = Counter.builder("dpop_nonce_challenges_total").register(meterRegistry);
    }

    @Override
    protected void doFilterInternal(@NonNull HttpServletRequest request, @NonNull HttpServletResponse response, @NonNull FilterChain filterChain) throws ServletException, IOException {
        boolean tokenEndpoint = request.getRequestURI() != null && request.getRequestURI().startsWith("/oauth2/token");
        RequireDPoP ann = findAnnotation(request);
        if (ann == null && !tokenEndpoint) {
            filterChain.doFilter(request, response);
            return;
        }
        String dpop = request.getHeader("DPoP");
        if (dpop == null || dpop.isBlank()) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            // Issue a nonce challenge for client to include in DPoP JWT
            String key = request.getRemoteAddr();
            String nonce = nonceService.issue(key, java.time.Duration.ofMinutes(5));
            dpopNonceChallenges.increment();
            response.setHeader("DPoP-Nonce", nonce);
            response.setHeader("WWW-Authenticate", "DPoP error=use_dpop_nonce");
            return;
        }
        if (!DpopUtil.verifyDpopSignature(dpop)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setHeader("WWW-Authenticate", "DPoP error=invalid_token");
            return;
        }
        // Minimal scaffold: verify htm/htu hash presence + naive replay guard.
        // In production, parse DPoP JWT, validate signature against jkt in access token, check nonce, and enforce iat window.
        String htm = request.getMethod();
        String htu = request.getRequestURL().toString();
        String expected = b64sha256(htm + "|" + htu);
        if (!dpop.contains(expected)) {
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setHeader("WWW-Authenticate", "DPoP error=invalid_token");
            return;
        }
        // Naive replay (expect JTI present in header; replace with parsed JWT jti)
        String jti = request.getHeader("DPoP-JTI");
        if (replayService.isReplay(jti)) {
            dpopReplayErrors.increment();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setHeader("WWW-Authenticate", "DPoP error=replay");
            return;
        }
        replayService.mark(jti, 300);

        // Bind to access token cnf.jkt when present
        String auth = request.getHeader("Authorization");
        String access = bearer(auth);
        if (access != null) {
            try {
                String jkt = com.suuupra.identity.auth.jwt.SpringContextHolder.getBean(com.suuupra.identity.auth.jwt.JwtService.class).extractCnfJkt(access);
                String dpopJkt = DpopUtil.computeJktFromDpop(dpop);
                if (jkt != null && dpopJkt != null && !jkt.equals(dpopJkt)) {
                    dpopCnfMismatch.increment();
                    response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
                    response.setHeader("WWW-Authenticate", "DPoP error=cnf_mismatch");
                    return;
                }
            } catch (Exception ignored) {}
        }
        // Validate DPoP nonce inside JWT; if missing/invalid, challenge with a new nonce
        String jktForNonce = null;
        try { jktForNonce = DpopUtil.computeJktFromDpop(dpop); } catch (Exception ignored) {}
        String nonceClaim = extractNonceFromDpop(dpop);
        String key = jktForNonce != null ? ("jkt:" + jktForNonce) : ("ip:" + request.getRemoteAddr());
        if (nonceClaim == null || !nonceService.validate(key, nonceClaim)) {
            String nonce = nonceService.issue(key, java.time.Duration.ofMinutes(5));
            dpopNonceChallenges.increment();
            response.setStatus(HttpServletResponse.SC_UNAUTHORIZED);
            response.setHeader("DPoP-Nonce", nonce);
            response.setHeader("WWW-Authenticate", "DPoP error=use_dpop_nonce");
            return;
        }

        filterChain.doFilter(request, response);
    }

    private static String b64sha256(String s) {
        try {
            MessageDigest md = MessageDigest.getInstance("SHA-256");
            return Base64.getUrlEncoder().withoutPadding().encodeToString(md.digest(s.getBytes()));
        } catch (Exception e) {
            return "";
        }
    }

    private RequireDPoP findAnnotation(HttpServletRequest request) {
        Object handler = request.getAttribute("org.springframework.web.servlet.HandlerMapping.bestMatchingHandler");
        if (handler == null) return null;
        try {
            Class<?> handlerClass = handler.getClass();
            return AnnotatedElementUtils.findMergedAnnotation(handlerClass, RequireDPoP.class);
        } catch (Exception e) {
            return null;
        }
    }

    private static String bearer(String authorization) {
        if (authorization == null) return null;
        String prefix = "Bearer ";
        if (authorization.regionMatches(true, 0, prefix, 0, prefix.length())) {
            return authorization.substring(prefix.length()).trim();
        }
        return null;
    }

    private static String extractNonceFromDpop(String dpopJwt) {
        try {
            String[] parts = dpopJwt.split("\\.");
            if (parts.length < 2) return null;
            String payload = new String(java.util.Base64.getUrlDecoder().decode(parts[1]));
            int idx = payload.indexOf("\"nonce\"");
            if (idx < 0) return null;
            int colon = payload.indexOf(':', idx);
            if (colon < 0) return null;
            int start = payload.indexOf('"', colon + 1);
            int end = payload.indexOf('"', start + 1);
            if (start < 0 || end < 0) return null;
            return payload.substring(start + 1, end);
        } catch (Exception e) {
            return null;
        }
    }
}


