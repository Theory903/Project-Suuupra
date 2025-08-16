package com.suuupra.ledger.domain.repository;

import com.suuupra.ledger.domain.entity.AccountType;
import com.suuupra.ledger.domain.entity.ChartOfAccounts;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.util.List;
import java.util.Optional;

/**
 * Repository interface for Chart of Accounts operations.
 * Provides CRUD operations and custom queries for account management.
 */
@Repository
public interface ChartOfAccountsRepository extends JpaRepository<ChartOfAccounts, String>, 
                                                   JpaSpecificationExecutor<ChartOfAccounts> {

    /**
     * Find an account by its unique account code
     */
    Optional<ChartOfAccounts> findByAccountCode(String accountCode);

    /**
     * Find all accounts of a specific type
     */
    List<ChartOfAccounts> findByAccountType(AccountType accountType);

    /**
     * Find all active accounts
     */
    List<ChartOfAccounts> findByIsActiveTrue();

    /**
     * Find all accounts of a specific type that are active
     */
    List<ChartOfAccounts> findByAccountTypeAndIsActiveTrue(AccountType accountType);

    /**
     * Find all child accounts of a parent account
     */
    List<ChartOfAccounts> findByParentAccountId(String parentAccountId);

    /**
     * Find all child accounts of a parent account that are active
     */
    List<ChartOfAccounts> findByParentAccountIdAndIsActiveTrue(String parentAccountId);

    /**
     * Find all top-level accounts (accounts without a parent)
     */
    List<ChartOfAccounts> findByParentAccountIdIsNull();

    /**
     * Find all top-level accounts that are active
     */
    List<ChartOfAccounts> findByParentAccountIdIsNullAndIsActiveTrue();

    /**
     * Check if an account code already exists
     */
    boolean existsByAccountCode(String accountCode);

    /**
     * Check if an account has any child accounts
     */
    boolean existsByParentAccountId(String parentAccountId);

    /**
     * Get the hierarchical tree structure of accounts
     */
    @Query("""
        SELECT a FROM ChartOfAccounts a 
        LEFT JOIN FETCH a.childAccounts 
        WHERE a.parentAccountId IS NULL 
        AND a.isActive = true
        ORDER BY a.accountCode
        """)
    List<ChartOfAccounts> findAccountHierarchy();

    /**
     * Find accounts by name pattern (case-insensitive search)
     */
    @Query("""
        SELECT a FROM ChartOfAccounts a 
        WHERE LOWER(a.accountName) LIKE LOWER(CONCAT('%', :namePattern, '%'))
        AND a.isActive = true
        ORDER BY a.accountName
        """)
    List<ChartOfAccounts> findByAccountNameContainingIgnoreCase(@Param("namePattern") String namePattern);

    /**
     * Get account balance for a specific account
     * This aggregates all journal entries for the account
     */
    @Query("""
        SELECT COALESCE(SUM(je.debitAmount) - SUM(je.creditAmount), 0)
        FROM JournalEntry je 
        INNER JOIN je.transaction t
        WHERE je.accountId = :accountId 
        AND t.status = 'POSTED'
        """)
    java.math.BigDecimal getAccountBalance(@Param("accountId") String accountId);

    /**
     * Get account balance with normal balance consideration
     */
    @Query("""
        SELECT a.accountType,
               COALESCE(SUM(je.debitAmount) - SUM(je.creditAmount), 0) as rawBalance
        FROM ChartOfAccounts a 
        LEFT JOIN JournalEntry je ON je.accountId = a.id
        LEFT JOIN Transaction t ON je.transactionId = t.id AND t.status = 'POSTED'
        WHERE a.id = :accountId
        GROUP BY a.id, a.accountType
        """)
    Optional<Object[]> getAccountBalanceWithType(@Param("accountId") String accountId);

    /**
     * Find accounts that have transactions in a date range
     */
    @Query("""
        SELECT DISTINCT a FROM ChartOfAccounts a
        INNER JOIN JournalEntry je ON je.accountId = a.id
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE t.transactionDate BETWEEN :startDate AND :endDate
        AND t.status = 'POSTED'
        ORDER BY a.accountCode
        """)
    List<ChartOfAccounts> findAccountsWithTransactionsBetween(
        @Param("startDate") java.time.LocalDate startDate,
        @Param("endDate") java.time.LocalDate endDate
    );

    /**
     * Get trial balance data for all accounts
     */
    @Query("""
        SELECT a.id, a.accountCode, a.accountName, a.accountType,
               COALESCE(SUM(je.debitAmount), 0) as totalDebits,
               COALESCE(SUM(je.creditAmount), 0) as totalCredits,
               COALESCE(SUM(je.debitAmount) - SUM(je.creditAmount), 0) as balance
        FROM ChartOfAccounts a 
        LEFT JOIN JournalEntry je ON je.accountId = a.id
        LEFT JOIN Transaction t ON je.transactionId = t.id AND t.status = 'POSTED'
        WHERE a.isActive = true
        GROUP BY a.id, a.accountCode, a.accountName, a.accountType
        HAVING COALESCE(SUM(je.debitAmount), 0) > 0 OR COALESCE(SUM(je.creditAmount), 0) > 0
        ORDER BY a.accountType, a.accountCode
        """)
    List<Object[]> getTrialBalanceData();

    /**
     * Get trial balance data for a specific date range
     */
    @Query("""
        SELECT a.id, a.accountCode, a.accountName, a.accountType,
               COALESCE(SUM(je.debitAmount), 0) as totalDebits,
               COALESCE(SUM(je.creditAmount), 0) as totalCredits,
               COALESCE(SUM(je.debitAmount) - SUM(je.creditAmount), 0) as balance
        FROM ChartOfAccounts a 
        LEFT JOIN JournalEntry je ON je.accountId = a.id
        LEFT JOIN Transaction t ON je.transactionId = t.id 
        WHERE a.isActive = true
        AND (t.transactionDate BETWEEN :startDate AND :endDate OR t.transactionDate IS NULL)
        AND (t.status = 'POSTED' OR t.status IS NULL)
        GROUP BY a.id, a.accountCode, a.accountName, a.accountType
        HAVING COALESCE(SUM(je.debitAmount), 0) > 0 OR COALESCE(SUM(je.creditAmount), 0) > 0
        ORDER BY a.accountType, a.accountCode
        """)
    List<Object[]> getTrialBalanceDataForPeriod(
        @Param("startDate") java.time.LocalDate startDate,
        @Param("endDate") java.time.LocalDate endDate
    );
}
