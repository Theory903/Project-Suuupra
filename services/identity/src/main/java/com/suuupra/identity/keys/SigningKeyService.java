package com.suuupra.identity.keys;

import com.nimbusds.jose.jwk.Curve;
import com.nimbusds.jose.jwk.ECKey;
import com.nimbusds.jose.jwk.JWK;
import org.springframework.jdbc.core.JdbcTemplate;
import org.springframework.stereotype.Service;

import java.security.KeyFactory;
import java.security.KeyPair;
import java.security.KeyPairGenerator;
import java.security.MessageDigest;
import java.security.interfaces.ECPrivateKey;
import java.security.interfaces.ECPublicKey;
import java.security.spec.PKCS8EncodedKeySpec;
import java.security.spec.X509EncodedKeySpec;
import java.util.Base64;
import java.util.List;
import java.util.Map;

@Service
public class SigningKeyService {

    private final JdbcTemplate jdbc;
    private final KmsService kmsService;

    public SigningKeyService(JdbcTemplate jdbc, KmsService kmsService) {
        this.jdbc = jdbc;
        this.kmsService = kmsService;
    }

    public ECPublicKey getCurrentPublicKey() {
        Map<String, Object> row = jdbc.queryForMap("SELECT public_pem FROM signing_keys WHERE is_current=TRUE AND enabled=TRUE LIMIT 1");
        return parsePublic((String) row.get("public_pem"));
    }

    public ECPrivateKey getCurrentPrivateKey() {
        Map<String, Object> row = jdbc.queryForMap("SELECT private_pem_enc FROM signing_keys WHERE is_current=TRUE AND enabled=TRUE LIMIT 1");
        byte[] enc = (byte[]) row.get("private_pem_enc");
        byte[] pem = kmsService.unwrap(enc);
        return parsePrivate(new String(pem));
    }

    public String getCurrentKid() {
        Map<String, Object> row = jdbc.queryForMap("SELECT kid FROM signing_keys WHERE is_current=TRUE AND enabled=TRUE LIMIT 1");
        return (String) row.get("kid");
    }

    public List<JWK> getAllPublicJwks() {
        List<Map<String, Object>> rows = jdbc.queryForList("SELECT kid, public_pem FROM signing_keys WHERE enabled=TRUE");
        return rows.stream().map(r -> ecJwk((String) r.get("kid"), (String) r.get("public_pem"))).toList();
    }

    public String rotateCreateNext() {
        try {
            KeyPairGenerator kpg = KeyPairGenerator.getInstance("EC");
            kpg.initialize(256);
            KeyPair kp = kpg.generateKeyPair();
            ECPublicKey pub = (ECPublicKey) kp.getPublic();
            ECPrivateKey priv = (ECPrivateKey) kp.getPrivate();
            String kid = computeKid(pub);
            String pubPem = pemEncodePublic(pub);
            String privPem = pemEncodePrivate(priv);
            byte[] enc = kmsService.wrap(privPem.getBytes());
            jdbc.update("INSERT INTO signing_keys(kid, alg, public_pem, private_pem_enc, is_current, enabled) VALUES (?,?,?,?,FALSE,TRUE)",
                kid, "ES256", pubPem, enc);
            return kid;
        } catch (Exception e) {
            throw new IllegalStateException("rotate failed", e);
        }
    }

    public void promoteCurrent(String kid) {
        jdbc.update("UPDATE signing_keys SET is_current=FALSE WHERE is_current=TRUE");
        jdbc.update("UPDATE signing_keys SET is_current=TRUE WHERE kid=?", kid);
    }

    private static String computeKid(ECPublicKey pub) throws Exception {
        MessageDigest sha256 = MessageDigest.getInstance("SHA-256");
        byte[] digest = sha256.digest(pub.getEncoded());
        return Base64.getUrlEncoder().withoutPadding().encodeToString(digest).substring(0, 16);
    }

    private static String pemEncodePublic(ECPublicKey key) throws Exception {
        String b64 = Base64.getEncoder().encodeToString(key.getEncoded());
        return "-----BEGIN PUBLIC KEY-----\n" + b64 + "\n-----END PUBLIC KEY-----";
    }

    private static String pemEncodePrivate(ECPrivateKey key) throws Exception {
        String b64 = Base64.getEncoder().encodeToString(key.getEncoded());
        return "-----BEGIN PRIVATE KEY-----\n" + b64 + "\n-----END PRIVATE KEY-----";
    }

    private static ECPublicKey parsePublic(String pem) {
        try {
            String content = pem.replace("-----BEGIN PUBLIC KEY-----", "").replace("-----END PUBLIC KEY-----", "").replaceAll("\\s", "");
            byte[] der = Base64.getDecoder().decode(content);
            X509EncodedKeySpec keySpec = new X509EncodedKeySpec(der);
            KeyFactory kf = KeyFactory.getInstance("EC");
            return (ECPublicKey) kf.generatePublic(keySpec);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static ECPrivateKey parsePrivate(String pem) {
        try {
            String content = pem.replace("-----BEGIN PRIVATE KEY-----", "").replace("-----END PRIVATE KEY-----", "").replaceAll("\\s", "");
            byte[] der = Base64.getDecoder().decode(content);
            PKCS8EncodedKeySpec keySpec = new PKCS8EncodedKeySpec(der);
            KeyFactory kf = KeyFactory.getInstance("EC");
            return (ECPrivateKey) kf.generatePrivate(keySpec);
        } catch (Exception e) {
            throw new IllegalStateException(e);
        }
    }

    private static JWK ecJwk(String kid, String publicPem) {
        ECPublicKey pub = parsePublic(publicPem);
        return new ECKey.Builder(Curve.P_256, pub).keyID(kid).build();
    }
}


