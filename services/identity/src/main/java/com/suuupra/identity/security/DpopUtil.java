package com.suuupra.identity.security;

import com.nimbusds.jose.JWSVerifier;
import com.nimbusds.jose.crypto.ECDSAVerifier;
import com.nimbusds.jose.crypto.RSASSAVerifier;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWK;
import com.nimbusds.jose.jwk.RSAKey;
import com.nimbusds.jwt.SignedJWT;

import java.security.interfaces.ECPublicKey;
import java.security.interfaces.RSAPublicKey;

public final class DpopUtil {
    private DpopUtil() {}

    public static String computeJktFromDpop(String dpopJwt) {
        try {
            SignedJWT jwt = SignedJWT.parse(dpopJwt);
            JWK jwk = jwt.getHeader().getJWK();
            if (jwk == null) return null;
            return jwk.computeThumbprint().toString();
        } catch (Exception e) {
            return null;
        }
    }

    public static boolean verifyDpopSignature(String dpopJwt) {
        try {
            SignedJWT jwt = SignedJWT.parse(dpopJwt);
            JWK jwk = jwt.getHeader().getJWK();
            if (jwk == null) return false;
            JWSVerifier verifier;
            if (jwk instanceof ECKey ec) {
                ECPublicKey pub = ec.toECPublicKey();
                verifier = new ECDSAVerifier(pub);
            } else if (jwk instanceof RSAKey rsa) {
                RSAPublicKey pub = rsa.toRSAPublicKey();
                verifier = new RSASSAVerifier(pub);
            } else {
                return false;
            }
            return jwt.verify(verifier);
        } catch (Exception e) {
            return false;
        }
    }
}


