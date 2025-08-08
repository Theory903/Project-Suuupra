package com.suuupra.identity.notifications;

import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.context.annotation.Profile;
import org.springframework.stereotype.Service;

@Service
@Profile({"default","dev","local"})
public class ConsoleEmailService implements EmailService {
    private static final Logger log = LoggerFactory.getLogger(ConsoleEmailService.class);
    @Override
    public void send(String to, String subject, String body) {
        log.info("[EMAIL] to={} subject={} body={} ", to, subject, body);
    }
}


