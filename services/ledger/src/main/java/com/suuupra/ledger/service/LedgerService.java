package com.suuupra.ledger.service;

import com.suuupra.ledger.domain.entity.ChartOfAccounts;
import com.suuupra.ledger.domain.entity.JournalEntry;
import com.suuupra.ledger.domain.entity.Transaction;
import com.suuupra.ledger.domain.entity.TransactionStatus;
import com.suuupra.ledger.domain.repository.ChartOfAccountsRepository;
import com.suuupra.ledger.domain.repository.JournalEntryRepository;
import com.suuupra.ledger.domain.repository.TransactionRepository;
import com.suuupra.ledger.service.dto.CreateTransactionRequest;
import com.suuupra.ledger.service.dto.JournalEntryDto;
import com.suuupra.ledger.service.dto.TransactionDto;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;
import java.util.UUID;

/**
 * Core service for double-entry accounting operations.
 * Handles transaction creation, posting, and balance management with cryptographic integrity.
 */
@Service
@Transactional
public class LedgerService {

    private static final Logger logger = LoggerFactory.getLogger(LedgerService.class);

    private final TransactionRepository transactionRepository;
    private final JournalEntryRepository journalEntryRepository;
    private final ChartOfAccountsRepository chartOfAccountsRepository;
    private final HashChainService hashChainService;
    private final BalanceService balanceService;

    public LedgerService(
            TransactionRepository transactionRepository,
            JournalEntryRepository journalEntryRepository,
            ChartOfAccountsRepository chartOfAccountsRepository,
            HashChainService hashChainService,
            BalanceService balanceService) {
        this.transactionRepository = transactionRepository;
        this.journalEntryRepository = journalEntryRepository;
        this.chartOfAccountsRepository = chartOfAccountsRepository;
        this.hashChainService = hashChainService;
        this.balanceService = balanceService;
    }

    /**
     * Create a new double-entry transaction with journal entries
     */
    public TransactionDto createTransaction(CreateTransactionRequest request) {
        logger.info("Creating transaction: {}", request.getTransactionType());

        // Validate request
        validateTransactionRequest(request);

        // Create transaction entity
        Transaction transaction = new Transaction();
        transaction.setId(UUID.randomUUID().toString());
        transaction.setTransactionNumber(generateTransactionNumber());
        transaction.setReferenceId(request.getReferenceId());
        transaction.setTransactionType(request.getTransactionType());
        transaction.setDescription(request.getDescription());
        transaction.setTotalAmount(request.getTotalAmount());
        transaction.setCurrency(request.getCurrency() != null ? request.getCurrency() : "INR");
        transaction.setTransactionDate(request.getTransactionDate() != null ? request.getTransactionDate() : LocalDate.now());
        transaction.setPostingDate(request.getPostingDate() != null ? request.getPostingDate() : LocalDate.now());
        transaction.setSourceSystem(request.getSourceSystem());
        transaction.setCreatedBy(request.getCreatedBy());
        transaction.setStatus(TransactionStatus.PENDING);

        // Create journal entries
        List<JournalEntry> journalEntries = createJournalEntries(transaction, request.getJournalEntries());
        transaction.setJournalEntries(journalEntries);

        // Validate business rules
        transaction.validateBusinessRules();

        // Calculate hash
        String transactionHash = hashChainService.calculateTransactionHash(transaction);
        transaction.setHashValue(transactionHash);

        // Save transaction
        Transaction savedTransaction = transactionRepository.save(transaction);

        logger.info("Transaction created successfully: {}", savedTransaction.getTransactionNumber());
        return convertToDto(savedTransaction);
    }

    /**
     * Post a pending transaction to the ledger
     */
    public TransactionDto postTransaction(String transactionId) {
        logger.info("Posting transaction: {}", transactionId);

        Transaction transaction = transactionRepository.findById(transactionId)
            .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + transactionId));

        if (!transaction.canBePosted()) {
            throw new IllegalStateException("Transaction cannot be posted in current state: " + transaction.getStatus());
        }

        // Update account balances
        for (JournalEntry entry : transaction.getJournalEntries()) {
            BigDecimal newBalance = balanceService.updateAccountBalance(entry);
            entry.setBalanceAfter(newBalance);
        }

        // Set previous hash for hash chain
        Optional<Transaction> latestTransaction = transactionRepository.findLatestPostedTransaction();
        if (latestTransaction.isPresent()) {
            transaction.setPreviousHash(latestTransaction.get().getHashValue());
        }

        // Recalculate hash with previous hash
        String updatedHash = hashChainService.calculateTransactionHash(transaction);
        transaction.setHashValue(updatedHash);

        // Post the transaction
        transaction.post();

        Transaction savedTransaction = transactionRepository.save(transaction);

        logger.info("Transaction posted successfully: {}", savedTransaction.getTransactionNumber());
        return convertToDto(savedTransaction);
    }

    /**
     * Reverse a posted transaction
     */
    public TransactionDto reverseTransaction(String transactionId, String reason, String reversedBy) {
        logger.info("Reversing transaction: {}", transactionId);

        Transaction originalTransaction = transactionRepository.findById(transactionId)
            .orElseThrow(() -> new IllegalArgumentException("Transaction not found: " + transactionId));

        if (!originalTransaction.canBeReversed()) {
            throw new IllegalStateException("Transaction cannot be reversed in current state: " + originalTransaction.getStatus());
        }

        // Create reversal transaction
        CreateTransactionRequest reversalRequest = createReversalRequest(originalTransaction, reason, reversedBy);
        TransactionDto reversalTransaction = createTransaction(reversalRequest);

        // Post the reversal transaction
        postTransaction(reversalTransaction.getId());

        // Mark original transaction as reversed
        originalTransaction.reverse();
        transactionRepository.save(originalTransaction);

        logger.info("Transaction reversed successfully: {}", originalTransaction.getTransactionNumber());
        return convertToDto(originalTransaction);
    }

    /**
     * Get transaction by ID
     */
    @Transactional(readOnly = true)
    public Optional<TransactionDto> getTransaction(String transactionId) {
        return transactionRepository.findById(transactionId)
            .map(this::convertToDto);
    }

    /**
     * Get transaction by transaction number
     */
    @Transactional(readOnly = true)
    public Optional<TransactionDto> getTransactionByNumber(String transactionNumber) {
        return transactionRepository.findByTransactionNumber(transactionNumber)
            .map(this::convertToDto);
    }

    /**
     * Get account balance
     */
    @Transactional(readOnly = true)
    public BigDecimal getAccountBalance(String accountId) {
        return balanceService.getCurrentAccountBalance(accountId);
    }

    /**
     * Get account balance as of specific date
     */
    @Transactional(readOnly = true)
    public BigDecimal getAccountBalanceAsOfDate(String accountId, LocalDate asOfDate) {
        return journalEntryRepository.getAccountBalanceAsOfDate(accountId, asOfDate);
    }

    /**
     * Verify hash chain integrity
     */
    @Transactional(readOnly = true)
    public boolean verifyHashChainIntegrity() {
        return hashChainService.verifyHashChain();
    }

    /**
     * Get transactions requiring reconciliation
     */
    @Transactional(readOnly = true)
    public List<TransactionDto> getTransactionsForReconciliation(LocalDate businessDate) {
        return transactionRepository.findTransactionsForReconciliation(businessDate)
            .stream()
            .map(this::convertToDto)
            .toList();
    }

    // Private helper methods

    private void validateTransactionRequest(CreateTransactionRequest request) {
        if (request.getJournalEntries() == null || request.getJournalEntries().size() < 2) {
            throw new IllegalArgumentException("Transaction must have at least 2 journal entries");
        }

        BigDecimal totalDebits = BigDecimal.ZERO;
        BigDecimal totalCredits = BigDecimal.ZERO;

        for (JournalEntryDto entry : request.getJournalEntries()) {
            if (entry.getAccountId() == null || entry.getAccountId().trim().isEmpty()) {
                throw new IllegalArgumentException("Journal entry must have an account ID");
            }

            // Verify account exists
            if (!chartOfAccountsRepository.existsById(entry.getAccountId())) {
                throw new IllegalArgumentException("Account not found: " + entry.getAccountId());
            }

            if (entry.getDebitAmount() != null && entry.getDebitAmount().compareTo(BigDecimal.ZERO) > 0) {
                totalDebits = totalDebits.add(entry.getDebitAmount());
            }
            if (entry.getCreditAmount() != null && entry.getCreditAmount().compareTo(BigDecimal.ZERO) > 0) {
                totalCredits = totalCredits.add(entry.getCreditAmount());
            }
        }

        if (totalDebits.compareTo(totalCredits) != 0) {
            throw new IllegalArgumentException("Total debits must equal total credits");
        }

        if (totalDebits.compareTo(request.getTotalAmount()) != 0) {
            throw new IllegalArgumentException("Total amount must equal sum of debits/credits");
        }
    }

    private List<JournalEntry> createJournalEntries(Transaction transaction, List<JournalEntryDto> entryDtos) {
        List<JournalEntry> journalEntries = new ArrayList<>();
        int sequence = 1;

        for (JournalEntryDto dto : entryDtos) {
            JournalEntry entry = new JournalEntry();
            entry.setId(UUID.randomUUID().toString());
            entry.setTransactionId(transaction.getId());
            entry.setAccountId(dto.getAccountId());
            entry.setDebitAmount(dto.getDebitAmount() != null ? dto.getDebitAmount() : BigDecimal.ZERO);
            entry.setCreditAmount(dto.getCreditAmount() != null ? dto.getCreditAmount() : BigDecimal.ZERO);
            entry.setDescription(dto.getDescription());
            entry.setEntrySequence(sequence++);
            entry.setBalanceAfter(BigDecimal.ZERO); // Will be calculated when posted
            
            // Calculate entry hash
            String entryHash = hashChainService.calculateJournalEntryHash(entry);
            entry.setHashValue(entryHash);

            entry.validateBusinessRules();
            journalEntries.add(entry);
        }

        return journalEntries;
    }

    private CreateTransactionRequest createReversalRequest(Transaction originalTransaction, String reason, String reversedBy) {
        CreateTransactionRequest reversalRequest = new CreateTransactionRequest();
        reversalRequest.setTransactionType("REVERSAL");
        reversalRequest.setDescription("Reversal of " + originalTransaction.getTransactionNumber() + " - " + reason);
        reversalRequest.setTotalAmount(originalTransaction.getTotalAmount());
        reversalRequest.setCurrency(originalTransaction.getCurrency());
        reversalRequest.setTransactionDate(LocalDate.now());
        reversalRequest.setPostingDate(LocalDate.now());
        reversalRequest.setSourceSystem(originalTransaction.getSourceSystem());
        reversalRequest.setCreatedBy(reversedBy);
        reversalRequest.setReferenceId(originalTransaction.getId());

        // Create opposite journal entries
        List<JournalEntryDto> reversalEntries = new ArrayList<>();
        for (JournalEntry originalEntry : originalTransaction.getJournalEntries()) {
            JournalEntryDto reversalEntry = new JournalEntryDto();
            reversalEntry.setAccountId(originalEntry.getAccountId());
            
            // Reverse the amounts
            if (originalEntry.getDebitAmount().compareTo(BigDecimal.ZERO) > 0) {
                reversalEntry.setCreditAmount(originalEntry.getDebitAmount());
                reversalEntry.setDebitAmount(BigDecimal.ZERO);
            } else {
                reversalEntry.setDebitAmount(originalEntry.getCreditAmount());
                reversalEntry.setCreditAmount(BigDecimal.ZERO);
            }
            
            reversalEntry.setDescription("Reversal of entry: " + originalEntry.getDescription());
            reversalEntries.add(reversalEntry);
        }

        reversalRequest.setJournalEntries(reversalEntries);
        return reversalRequest;
    }

    private String generateTransactionNumber() {
        LocalDateTime now = LocalDateTime.now();
        String prefix = "TXN";
        String timestamp = String.valueOf(now.toLocalDate().toEpochDay()) + 
                          String.format("%05d", now.toLocalTime().toSecondOfDay());
        String uuid = UUID.randomUUID().toString().substring(0, 8).toUpperCase();
        return prefix + timestamp + uuid;
    }

    private TransactionDto convertToDto(Transaction transaction) {
        TransactionDto dto = new TransactionDto();
        dto.setId(transaction.getId());
        dto.setTransactionNumber(transaction.getTransactionNumber());
        dto.setReferenceId(transaction.getReferenceId());
        dto.setTransactionType(transaction.getTransactionType());
        dto.setDescription(transaction.getDescription());
        dto.setTotalAmount(transaction.getTotalAmount());
        dto.setCurrency(transaction.getCurrency());
        dto.setTransactionDate(transaction.getTransactionDate());
        dto.setPostingDate(transaction.getPostingDate());
        dto.setStatus(transaction.getStatus());
        dto.setSourceSystem(transaction.getSourceSystem());
        dto.setCreatedBy(transaction.getCreatedBy());
        dto.setHashValue(transaction.getHashValue());
        dto.setPreviousHash(transaction.getPreviousHash());
        dto.setCreatedAt(transaction.getCreatedAt());
        dto.setPostedAt(transaction.getPostedAt());

        // Convert journal entries
        List<JournalEntryDto> entryDtos = transaction.getJournalEntries().stream()
            .map(this::convertJournalEntryToDto)
            .toList();
        dto.setJournalEntries(entryDtos);

        return dto;
    }

    private JournalEntryDto convertJournalEntryToDto(JournalEntry entry) {
        JournalEntryDto dto = new JournalEntryDto();
        dto.setId(entry.getId());
        dto.setTransactionId(entry.getTransactionId());
        dto.setAccountId(entry.getAccountId());
        dto.setDebitAmount(entry.getDebitAmount());
        dto.setCreditAmount(entry.getCreditAmount());
        dto.setBalanceAfter(entry.getBalanceAfter());
        dto.setDescription(entry.getDescription());
        dto.setEntrySequence(entry.getEntrySequence());
        dto.setHashValue(entry.getHashValue());
        dto.setCreatedAt(entry.getCreatedAt());
        return dto;
    }
}
