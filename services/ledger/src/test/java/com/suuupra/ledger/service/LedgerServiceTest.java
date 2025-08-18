package com.suuupra.ledger.service;

import com.suuupra.ledger.domain.entity.AccountType;
import com.suuupra.ledger.domain.entity.ChartOfAccounts;
import com.suuupra.ledger.domain.entity.TransactionStatus;
import com.suuupra.ledger.domain.repository.ChartOfAccountsRepository;
import com.suuupra.ledger.domain.repository.JournalEntryRepository;
import com.suuupra.ledger.domain.repository.TransactionRepository;
import com.suuupra.ledger.service.dto.CreateTransactionRequest;
import com.suuupra.ledger.service.dto.JournalEntryDto;
import com.suuupra.ledger.service.dto.TransactionDto;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.ActiveProfiles;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.Arrays;
import java.util.UUID;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Integration tests for LedgerService
 */
@SpringBootTest
@ActiveProfiles("test")
@Transactional
public class LedgerServiceTest {

    @Autowired
    private LedgerService ledgerService;

    @Autowired
    private ChartOfAccountsRepository chartOfAccountsRepository;

    @Autowired
    private TransactionRepository transactionRepository;

    @Autowired
    private JournalEntryRepository journalEntryRepository;

    private String cashAccountId;
    private String revenueAccountId;

    @BeforeEach
    void setUp() {
        // Create test accounts
        ChartOfAccounts cashAccount = new ChartOfAccounts();
        cashAccount.setId(UUID.randomUUID().toString());
        cashAccount.setAccountCode("1001");
        cashAccount.setAccountName("Cash");
        cashAccount.setAccountType(AccountType.ASSET);
        cashAccount.setIsActive(true);
        cashAccount.setDescription("Cash account for testing");
        cashAccount = chartOfAccountsRepository.save(cashAccount);
        cashAccountId = cashAccount.getId();

        ChartOfAccounts revenueAccount = new ChartOfAccounts();
        revenueAccount.setId(UUID.randomUUID().toString());
        revenueAccount.setAccountCode("4001");
        revenueAccount.setAccountName("Sales Revenue");
        revenueAccount.setAccountType(AccountType.REVENUE);
        revenueAccount.setIsActive(true);
        revenueAccount.setDescription("Revenue account for testing");
        revenueAccount = chartOfAccountsRepository.save(revenueAccount);
        revenueAccountId = revenueAccount.getId();
    }

    @Test
    void testCreateTransaction() {
        // Arrange
        CreateTransactionRequest request = new CreateTransactionRequest();
        request.setTransactionType("SALE");
        request.setDescription("Test sale transaction");
        request.setTotalAmount(new BigDecimal("1000.00"));
        request.setCurrency("INR");
        request.setTransactionDate(LocalDate.now());
        request.setPostingDate(LocalDate.now());
        request.setSourceSystem("TEST_SYSTEM");
        request.setCreatedBy("test-user");
        
        // Create journal entries for double-entry
        JournalEntryDto debitEntry = new JournalEntryDto();
        debitEntry.setAccountId(cashAccountId);
        debitEntry.setDebitAmount(new BigDecimal("1000.00"));
        debitEntry.setCreditAmount(BigDecimal.ZERO);
        debitEntry.setDescription("Cash received from sale");

        JournalEntryDto creditEntry = new JournalEntryDto();
        creditEntry.setAccountId(revenueAccountId);
        creditEntry.setDebitAmount(BigDecimal.ZERO);
        creditEntry.setCreditAmount(new BigDecimal("1000.00"));
        creditEntry.setDescription("Revenue from sale");

        request.setJournalEntries(Arrays.asList(debitEntry, creditEntry));

        // Act
        TransactionDto result = ledgerService.createTransaction(request);

        // Assert
        assertNotNull(result);
        assertNotNull(result.getId());
        assertNotNull(result.getTransactionNumber());
        assertEquals(TransactionStatus.PENDING, result.getStatus());
        assertEquals("SALE", result.getTransactionType());
        assertEquals(new BigDecimal("1000.00"), result.getTotalAmount());
        assertEquals(2, result.getJournalEntries().size());
        assertNotNull(result.getHashValue());
    }

    @Test
    void testPostTransaction() {
        // Arrange - First create a transaction
        CreateTransactionRequest request = new CreateTransactionRequest();
        request.setTransactionType("SALE");
        request.setDescription("Test sale transaction");
        request.setTotalAmount(new BigDecimal("500.00"));
        request.setSourceSystem("TEST_SYSTEM");
        request.setCreatedBy("test-user");
        
        JournalEntryDto debitEntry = new JournalEntryDto();
        debitEntry.setAccountId(cashAccountId);
        debitEntry.setDebitAmount(new BigDecimal("500.00"));
        debitEntry.setCreditAmount(BigDecimal.ZERO);
        debitEntry.setDescription("Cash received");

        JournalEntryDto creditEntry = new JournalEntryDto();
        creditEntry.setAccountId(revenueAccountId);
        creditEntry.setDebitAmount(BigDecimal.ZERO);
        creditEntry.setCreditAmount(new BigDecimal("500.00"));
        creditEntry.setDescription("Revenue earned");

        request.setJournalEntries(Arrays.asList(debitEntry, creditEntry));

        TransactionDto createdTransaction = ledgerService.createTransaction(request);

        // Act - Post the transaction
        TransactionDto postedTransaction = ledgerService.postTransaction(createdTransaction.getId());

        // Assert
        assertNotNull(postedTransaction);
        assertEquals(TransactionStatus.POSTED, postedTransaction.getStatus());
        assertNotNull(postedTransaction.getPostedAt());
        
        // Verify balances are updated
        BigDecimal cashBalance = ledgerService.getAccountBalance(cashAccountId);
        BigDecimal revenueBalance = ledgerService.getAccountBalance(revenueAccountId);
        
        assertEquals(new BigDecimal("500.00"), cashBalance);
        assertEquals(new BigDecimal("-500.00"), revenueBalance); // Revenue shows as negative in raw balance
    }

    @Test
    void testGetAccountBalance() {
        // Initially, account balance should be zero
        BigDecimal initialBalance = ledgerService.getAccountBalance(cashAccountId);
        assertEquals(BigDecimal.ZERO, initialBalance);
    }

    @Test
    void testDoubleEntryValidation() {
        // Test that unbalanced transactions are rejected
        CreateTransactionRequest request = new CreateTransactionRequest();
        request.setTransactionType("INVALID");
        request.setDescription("Unbalanced transaction");
        request.setTotalAmount(new BigDecimal("1000.00"));
        request.setSourceSystem("TEST_SYSTEM");
        request.setCreatedBy("test-user");
        
        JournalEntryDto debitEntry = new JournalEntryDto();
        debitEntry.setAccountId(cashAccountId);
        debitEntry.setDebitAmount(new BigDecimal("1000.00"));
        debitEntry.setCreditAmount(BigDecimal.ZERO);
        debitEntry.setDescription("Unbalanced debit");

        JournalEntryDto creditEntry = new JournalEntryDto();
        creditEntry.setAccountId(revenueAccountId);
        creditEntry.setDebitAmount(BigDecimal.ZERO);
        creditEntry.setCreditAmount(new BigDecimal("500.00")); // Intentionally unbalanced
        creditEntry.setDescription("Unbalanced credit");

        request.setJournalEntries(Arrays.asList(debitEntry, creditEntry));

        // Should throw exception due to unbalanced entries
        assertThrows(IllegalArgumentException.class, () -> {
            ledgerService.createTransaction(request);
        });
    }
}
