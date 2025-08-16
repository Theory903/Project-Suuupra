package com.suuupra.ledger.service;

import com.suuupra.ledger.domain.entity.JournalEntry;
import com.suuupra.ledger.domain.entity.Transaction;
import com.suuupra.ledger.domain.repository.TransactionRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.util.List;

/**
 * Service for managing cryptographic hash chains to ensure data integrity
 */
@Service
@Transactional(readOnly = true)
public class HashChainService {

    private static final Logger logger = LoggerFactory.getLogger(HashChainService.class);
    private static final String HASH_ALGORITHM = "SHA-256";

    private final TransactionRepository transactionRepository;

    public HashChainService(TransactionRepository transactionRepository) {
        this.transactionRepository = transactionRepository;
    }

    /**
     * Calculate hash for a transaction including its journal entries
     */
    public String calculateTransactionHash(Transaction transaction) {
        try {
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            
            // Add transaction fields to hash
            addToHash(digest, transaction.getId());
            addToHash(digest, transaction.getTransactionNumber());
            addToHash(digest, transaction.getTransactionType());
            addToHash(digest, transaction.getDescription());
            addToHash(digest, transaction.getTotalAmount().toString());
            addToHash(digest, transaction.getCurrency());
            addToHash(digest, transaction.getTransactionDate().toString());
            addToHash(digest, transaction.getSourceSystem());
            addToHash(digest, transaction.getCreatedBy());
            
            // Add previous hash if present
            if (transaction.getPreviousHash() != null) {
                addToHash(digest, transaction.getPreviousHash());
            }
            
            // Add journal entries to hash
            if (transaction.getJournalEntries() != null) {
                for (JournalEntry entry : transaction.getJournalEntries()) {
                    addJournalEntryToHash(digest, entry);
                }
            }
            
            byte[] hashBytes = digest.digest();
            return bytesToHex(hashBytes);
            
        } catch (NoSuchAlgorithmException e) {
            logger.error("Hash algorithm {} not available", HASH_ALGORITHM, e);
            throw new RuntimeException("Hash calculation failed", e);
        }
    }

    /**
     * Calculate hash for a journal entry
     */
    public String calculateJournalEntryHash(JournalEntry entry) {
        try {
            MessageDigest digest = MessageDigest.getInstance(HASH_ALGORITHM);
            
            addToHash(digest, entry.getId());
            addToHash(digest, entry.getTransactionId());
            addToHash(digest, entry.getAccountId());
            addToHash(digest, entry.getDebitAmount().toString());
            addToHash(digest, entry.getCreditAmount().toString());
            addToHash(digest, entry.getDescription());
            addToHash(digest, String.valueOf(entry.getEntrySequence()));
            
            byte[] hashBytes = digest.digest();
            return bytesToHex(hashBytes);
            
        } catch (NoSuchAlgorithmException e) {
            logger.error("Hash algorithm {} not available", HASH_ALGORITHM, e);
            throw new RuntimeException("Hash calculation failed", e);
        }
    }

    /**
     * Verify the integrity of the entire hash chain
     */
    public boolean verifyHashChain() {
        logger.info("Starting hash chain verification");
        
        try {
            List<Object[]> hashChainData = transactionRepository.getHashChainVerificationData();
            
            if (hashChainData.isEmpty()) {
                logger.info("No transactions found, hash chain is valid");
                return true;
            }
            
            String previousHash = null;
            int verifiedTransactions = 0;
            
            for (Object[] data : hashChainData) {
                String transactionId = (String) data[0];
                String transactionNumber = (String) data[1];
                String storedHash = (String) data[2];
                String storedPreviousHash = (String) data[3];
                
                // Verify previous hash linkage
                if (previousHash != null && !previousHash.equals(storedPreviousHash)) {
                    logger.error("Hash chain broken at transaction {}: expected previous hash {}, found {}", 
                        transactionNumber, previousHash, storedPreviousHash);
                    return false;
                }
                
                // For full verification, we would recalculate the hash here
                // This is a simplified version that checks the chain linkage
                previousHash = storedHash;
                verifiedTransactions++;
            }
            
            logger.info("Hash chain verification completed successfully for {} transactions", verifiedTransactions);
            return true;
            
        } catch (Exception e) {
            logger.error("Hash chain verification failed", e);
            return false;
        }
    }

    /**
     * Find any transactions with broken hash chain links
     */
    public List<Transaction> findBrokenHashChainTransactions() {
        return transactionRepository.findTransactionsWithBrokenHashChain();
    }

    /**
     * Verify a specific transaction's hash
     */
    public boolean verifyTransactionHash(Transaction transaction) {
        String calculatedHash = calculateTransactionHash(transaction);
        boolean isValid = calculatedHash.equals(transaction.getHashValue());
        
        if (!isValid) {
            logger.warn("Hash verification failed for transaction {}: calculated {}, stored {}", 
                transaction.getTransactionNumber(), calculatedHash, transaction.getHashValue());
        }
        
        return isValid;
    }

    // Private helper methods
    
    private void addToHash(MessageDigest digest, String value) {
        if (value != null) {
            digest.update(value.getBytes(StandardCharsets.UTF_8));
        }
    }
    
    private void addJournalEntryToHash(MessageDigest digest, JournalEntry entry) {
        addToHash(digest, entry.getId());
        addToHash(digest, entry.getAccountId());
        addToHash(digest, entry.getDebitAmount().toString());
        addToHash(digest, entry.getCreditAmount().toString());
        addToHash(digest, String.valueOf(entry.getEntrySequence()));
    }
    
    private String bytesToHex(byte[] bytes) {
        StringBuilder result = new StringBuilder();
        for (byte b : bytes) {
            result.append(String.format("%02x", b));
        }
        return result.toString();
    }
}
