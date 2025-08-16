package com.suuupra.ledger;

import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.batch.core.configuration.annotation.EnableBatchProcessing;
import org.springframework.transaction.annotation.EnableTransactionManagement;

/**
 * Main application class for the Ledger Service
 * 
 * Provides enterprise-grade double-entry accounting capabilities with:
 * - ACID compliant transactions
 * - Cryptographic hash chains for data integrity
 * - Automated reconciliation engine
 * - Spring Batch settlement processing
 * - Financial reporting capabilities
 */
@SpringBootApplication
@EnableBatchProcessing
@EnableTransactionManagement
public class LedgerServiceApplication {

    public static void main(String[] args) {
        SpringApplication.run(LedgerServiceApplication.class, args);
    }
}
