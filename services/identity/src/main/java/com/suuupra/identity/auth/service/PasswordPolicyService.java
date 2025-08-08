package com.suuupra.identity.auth.service;

import org.springframework.stereotype.Service;

@Service
public class PasswordPolicyService {

    public void validatePassword(String password) {
        if (password == null || password.length() < 8) {
            throw new IllegalArgumentException("Password too short");
        }
        boolean hasLetter = password.chars().anyMatch(Character::isLetter);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        if (!hasLetter || !hasDigit) {
            throw new IllegalArgumentException("Password must contain letters and digits");
        }
        // TODO: integrate HIBP or denylist; for now just a simple placeholder
        if (password.equalsIgnoreCase("Password123")) {
            throw new IllegalArgumentException("Password is on denylist");
        }
    }
}
