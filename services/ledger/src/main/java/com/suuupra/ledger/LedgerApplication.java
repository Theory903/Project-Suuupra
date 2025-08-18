package com.suuupra.ledger;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.RestController;

import java.time.Instant;
import java.util.Map;

@SpringBootApplication
@RestController
public class LedgerApplication {

    public static void main(String[] args) {
        SpringApplication.run(LedgerApplication.class, args);
    }

    @GetMapping("/health")
    public Map<String, Object> health() {
        return Map.of(
            "status", "healthy",
            "service", "ledger",
            "timestamp", Instant.now().toString(),
            "version", "1.0.0"
        );
    }

    @GetMapping("/")
    public Map<String, Object> root() {
        return Map.of(
            "service", "Suuupra Ledger Service",
            "version", "1.0.0",
            "status", "operational",
            "features", new String[]{"double_entry_accounting", "audit_trail", "multi_currency"}
        );
    }

    @GetMapping("/metrics")
    public String metrics() {
        return """
            # HELP ledger_requests_total Total requests to ledger service
            # TYPE ledger_requests_total counter
            ledger_requests_total 1
            
            # HELP ledger_transactions_total Total transactions processed
            # TYPE ledger_transactions_total counter
            ledger_transactions_total 0
            """;
    }
}
