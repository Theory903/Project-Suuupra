package com.suuupra.identity.notifications;

public interface EmailService {
    void send(String to, String subject, String body);
}


