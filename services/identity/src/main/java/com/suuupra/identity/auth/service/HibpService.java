package com.suuupra.identity.auth.service;

import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;

import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;

@Service
public class HibpService {

    private final boolean enabled;
    private final HttpClient client = HttpClient.newHttpClient();

    public HibpService(@Value("${security.password.hibp.enabled:true}") boolean enabled) {
        this.enabled = enabled;
    }

    public boolean isLikelyCompromised(String password) {
        if (!enabled) return false;
        try {
            MessageDigest sha1 = MessageDigest.getInstance("SHA-1");
            String hex = bytesToHex(sha1.digest(password.getBytes(StandardCharsets.UTF_8))).toUpperCase();
            String prefix = hex.substring(0, 5);
            String suffix = hex.substring(5);
            HttpRequest req = HttpRequest.newBuilder()
                .uri(URI.create("https://api.pwnedpasswords.com/range/" + prefix))
                .header("Add-Padding", "true")
                .GET()
                .build();
            HttpResponse<String> resp = client.send(req, HttpResponse.BodyHandlers.ofString());
            if (resp.statusCode() != 200) return false;
            for (String line : resp.body().split("\r?\n")) {
                String[] parts = line.split(":");
                if (parts.length >= 2 && parts[0].equalsIgnoreCase(suffix)) {
                    return true;
                }
            }
            return false;
        } catch (Exception e) {
            return false;
        }
    }

    private static String bytesToHex(byte[] bytes) {
        StringBuilder sb = new StringBuilder();
        for (byte b : bytes) sb.append(String.format("%02x", b));
        return sb.toString();
    }
}


