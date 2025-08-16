package com.suuupra.ledger.service;

import com.suuupra.ledger.domain.entity.AccountType;
import com.suuupra.ledger.domain.entity.ChartOfAccounts;
import com.suuupra.ledger.domain.entity.JournalEntry;
import com.suuupra.ledger.domain.repository.ChartOfAccountsRepository;
import com.suuupra.ledger.domain.repository.JournalEntryRepository;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

/**
 * Service for managing account balances with double-entry accounting rules
 */
@Service
@Transactional
public class BalanceService {

    private static final Logger logger = LoggerFactory.getLogger(BalanceService.class);

    private final ChartOfAccountsRepository chartOfAccountsRepository;
    private final JournalEntryRepository journalEntryRepository;

    public BalanceService(ChartOfAccountsRepository chartOfAccountsRepository,
                         JournalEntryRepository journalEntryRepository) {
        this.chartOfAccountsRepository = chartOfAccountsRepository;
        this.journalEntryRepository = journalEntryRepository;
    }

    /**
     * Update account balance after a journal entry is posted
     */
    public BigDecimal updateAccountBalance(JournalEntry journalEntry) {
        logger.debug("Updating balance for account {} with entry {}", 
            journalEntry.getAccountId(), journalEntry.getId());

        // Get current account balance
        BigDecimal currentBalance = getCurrentAccountBalance(journalEntry.getAccountId());
        
        // Calculate new balance based on debit/credit and account type
        BigDecimal balanceChange = calculateBalanceChange(journalEntry);
        BigDecimal newBalance = currentBalance.add(balanceChange);
        
        logger.debug("Account {} balance updated: {} + {} = {}", 
            journalEntry.getAccountId(), currentBalance, balanceChange, newBalance);
        
        return newBalance;
    }

    /**
     * Get current balance for an account
     */
    @Transactional(readOnly = true)
    public BigDecimal getCurrentAccountBalance(String accountId) {
        BigDecimal balance = chartOfAccountsRepository.getAccountBalance(accountId);
        return balance != null ? balance : BigDecimal.ZERO;
    }

    /**
     * Get account balance as of a specific date
     */
    @Transactional(readOnly = true)
    public BigDecimal getAccountBalanceAsOfDate(String accountId, LocalDate asOfDate) {
        BigDecimal balance = journalEntryRepository.getAccountBalanceAsOfDate(accountId, asOfDate);
        return balance != null ? balance : BigDecimal.ZERO;
    }

    /**
     * Calculate the normal balance for an account based on its type
     */
    @Transactional(readOnly = true)
    public BigDecimal getNormalBalance(String accountId) {
        Optional<ChartOfAccounts> account = chartOfAccountsRepository.findById(accountId);
        if (account.isEmpty()) {
            throw new IllegalArgumentException("Account not found: " + accountId);
        }
        
        BigDecimal rawBalance = getCurrentAccountBalance(accountId);
        AccountType accountType = account.get().getAccountType();
        
        // Apply normal balance rules for financial statements
        return applyNormalBalanceRules(rawBalance, accountType);
    }

    /**
     * Verify that account balances are consistent across all accounts
     */
    @Transactional(readOnly = true)
    public boolean verifyBalanceConsistency() {
        logger.info("Starting balance consistency verification");
        
        try {
            // Get trial balance data
            var trialBalanceData = chartOfAccountsRepository.getTrialBalanceData();
            
            BigDecimal totalDebits = BigDecimal.ZERO;
            BigDecimal totalCredits = BigDecimal.ZERO;
            int accountsChecked = 0;
            
            for (Object[] row : trialBalanceData) {
                BigDecimal debits = (BigDecimal) row[4];
                BigDecimal credits = (BigDecimal) row[5];
                
                totalDebits = totalDebits.add(debits);
                totalCredits = totalCredits.add(credits);
                accountsChecked++;
            }
            
            boolean isBalanced = totalDebits.compareTo(totalCredits) == 0;
            
            if (isBalanced) {
                logger.info("Balance consistency verification passed: {} accounts checked, total debits = total credits = {}", 
                    accountsChecked, totalDebits);
            } else {
                logger.error("Balance consistency verification failed: total debits {} != total credits {}", 
                    totalDebits, totalCredits);
            }
            
            return isBalanced;
            
        } catch (Exception e) {
            logger.error("Balance consistency verification failed", e);
            return false;
        }
    }

    /**
     * Calculate balance movement (increase/decrease) for a journal entry
     */
    private BigDecimal calculateBalanceChange(JournalEntry journalEntry) {
        // For double-entry accounting:
        // - Debit entries increase asset and expense accounts, decrease liability, equity, and revenue accounts
        // - Credit entries increase liability, equity, and revenue accounts, decrease asset and expense accounts
        
        if (journalEntry.getDebitAmount().compareTo(BigDecimal.ZERO) > 0) {
            return journalEntry.getDebitAmount();
        } else if (journalEntry.getCreditAmount().compareTo(BigDecimal.ZERO) > 0) {
            return journalEntry.getCreditAmount().negate();
        } else {
            throw new IllegalArgumentException("Journal entry must have either debit or credit amount");
        }
    }

    /**
     * Apply normal balance rules for financial statement presentation
     */
    private BigDecimal applyNormalBalanceRules(BigDecimal rawBalance, AccountType accountType) {
        return switch (accountType) {
            case ASSET, EXPENSE -> rawBalance; // Normal debit balance
            case LIABILITY, EQUITY, REVENUE -> rawBalance.negate(); // Normal credit balance  
        };
    }

    /**
     * Get account activity summary including balance movements
     */
    @Transactional(readOnly = true)
    public Object[] getAccountActivitySummary(String accountId) {
        return journalEntryRepository.getAccountActivitySummary(accountId);
    }

    /**
     * Get daily balance movements for an account
     */
    @Transactional(readOnly = true)
    public Object[] getAccountTotalsForPeriod(String accountId, LocalDate startDate, LocalDate endDate) {
        return journalEntryRepository.getAccountTotalsForPeriod(accountId, startDate, endDate);
    }

    /**
     * Validate that a transaction maintains double-entry balance
     */
    public boolean validateDoubleEntryBalance(BigDecimal totalDebits, BigDecimal totalCredits) {
        boolean isBalanced = totalDebits.compareTo(totalCredits) == 0;
        
        if (!isBalanced) {
            logger.warn("Double-entry balance validation failed: debits {} != credits {}", 
                totalDebits, totalCredits);
        }
        
        return isBalanced;
    }

    /**
     * Calculate running balance for account ledger entries
     */
    @Transactional(readOnly = true)
    public BigDecimal calculateRunningBalance(String accountId, BigDecimal previousBalance, 
                                            BigDecimal debitAmount, BigDecimal creditAmount) {
        
        BigDecimal balanceChange = debitAmount.subtract(creditAmount);
        return previousBalance.add(balanceChange);
    }

    /**
     * Get balance verification data for audit purposes
     */
    @Transactional(readOnly = true)
    public List<Object[]> getBalanceVerificationData(String accountId) {
        return journalEntryRepository.getBalanceVerificationData(accountId);
    }
}
