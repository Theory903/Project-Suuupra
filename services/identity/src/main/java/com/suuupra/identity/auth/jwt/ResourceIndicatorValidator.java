package com.suuupra.identity.auth.jwt;

import com.nimbusds.jwt.SignedJWT;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Component;

import java.text.ParseException;
import java.util.List;

@Component
public class ResourceIndicatorValidator {

    @Value("${security.jwt.audience:suuupra-api}")
    private String defaultAudience;

    public boolean validateResources(String jwtString, List<String> requiredResources) {
        try {
            SignedJWT jwt = SignedJWT.parse(jwtString);
            var claims = jwt.getJWTClaimsSet();
            // Accept both audience and "resources" custom claim
            var auds = claims.getAudience();
            var resClaim = claims.getStringListClaim("resources");
            for (String req : requiredResources) {
                boolean inAud = auds != null && auds.contains(req);
                boolean inRes = resClaim != null && resClaim.contains(req);
                if (!(inAud || inRes || defaultAudience.equals(req))) {
                    return false;
                }
            }
            return true;
        } catch (ParseException e) {
            return false;
        }
    }
}


