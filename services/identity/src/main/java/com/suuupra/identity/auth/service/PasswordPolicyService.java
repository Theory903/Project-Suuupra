package com.suuupra.identity.auth.service;

import org.springframework.stereotype.Service;

@Service
public class PasswordPolicyService {

    public void validatePassword(String password) {
        if (password == null || password.length() < 12) {
            throw new IllegalArgumentException("Password must be at least 12 characters");
        }
        boolean hasLower = password.chars().anyMatch(Character::isLowerCase);
        boolean hasUpper = password.chars().anyMatch(Character::isUpperCase);
        boolean hasDigit = password.chars().anyMatch(Character::isDigit);
        boolean hasSpecial = password.chars().anyMatch(ch -> "!@#$%^&*()_+-=[]{}|;:,.<>?".indexOf(ch) >= 0);
        
        int charTypes = (hasLower ? 1 : 0) + (hasUpper ? 1 : 0) + (hasDigit ? 1 : 0) + (hasSpecial ? 1 : 0);
        if (charTypes < 3) {
            throw new IllegalArgumentException("Password must contain at least 3 of: lowercase, uppercase, digits, special characters");
        }
        
        // Check for common patterns
        String lower = password.toLowerCase();
        if (lower.contains("password") || lower.contains("123456") || lower.contains("qwerty")) {
            throw new IllegalArgumentException("Password contains common patterns");
        }
    }
}
