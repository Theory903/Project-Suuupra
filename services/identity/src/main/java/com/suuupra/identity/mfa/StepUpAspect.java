package com.suuupra.identity.mfa;

import com.suuupra.identity.auth.jwt.JwtService;
import org.aspectj.lang.ProceedingJoinPoint;
import org.aspectj.lang.annotation.Around;
import org.aspectj.lang.annotation.Aspect;
import org.springframework.http.ResponseEntity;
import org.springframework.stereotype.Component;

import java.text.ParseException;

@Aspect
@Component
public class StepUpAspect {

    private final StepUpService stepUpService;
    private final JwtService jwtService;

    public StepUpAspect(StepUpService stepUpService, JwtService jwtService) {
        this.stepUpService = stepUpService;
        this.jwtService = jwtService;
    }

    @Around("@annotation(ann)")
    public Object enforce(ProceedingJoinPoint pjp, StepUpProtected ann) throws Throwable {
        Object[] args = pjp.getArgs();
        String bearer = null;
        for (Object a : args) {
            if (a instanceof org.springframework.http.HttpHeaders headers) {
                String auth = headers.getFirst("Authorization");
                bearer = extract(auth);
                break;
            }
        }
        if (bearer == null) return unauthorized();
        String sid = null;
        try {
            sid = jwtService.extractSessionId(bearer);
        } catch (ParseException ignored) {}
        if (sid == null || !stepUpService.isSatisfied(sid)) {
            return ResponseEntity.status(401).header("WWW-Authenticate", "step-up").build();
        }
        return pjp.proceed();
    }

    private static String extract(String authorization) {
        if (authorization == null) return null;
        String prefix = "Bearer ";
        if (authorization.regionMatches(true, 0, prefix, 0, prefix.length())) {
            return authorization.substring(prefix.length()).trim();
        }
        return null;
    }

    private static ResponseEntity<Void> unauthorized() {
        return ResponseEntity.status(401).header("WWW-Authenticate", "step-up").build();
    }
}


