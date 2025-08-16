package com.suuupra.ledger.domain.repository;

import com.suuupra.ledger.domain.entity.JournalEntry;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * Repository interface for Journal Entry operations.
 * Provides CRUD operations and custom queries for journal entry management.
 */
@Repository
public interface JournalEntryRepository extends JpaRepository<JournalEntry, String>, 
                                                JpaSpecificationExecutor<JournalEntry> {

    /**
     * Find all journal entries for a specific transaction
     */
    List<JournalEntry> findByTransactionId(String transactionId);

    /**
     * Find all journal entries for a specific account
     */
    List<JournalEntry> findByAccountId(String accountId);

    /**
     * Find journal entries for a specific account in date range
     */
    @Query("""
        SELECT je FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.transactionDate BETWEEN :startDate AND :endDate
        AND t.status = 'POSTED'
        ORDER BY t.transactionDate, je.entrySequence
        """)
    List<JournalEntry> findByAccountIdAndDateRange(
        @Param("accountId") String accountId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /**
     * Find journal entries ordered by sequence for a transaction
     */
    List<JournalEntry> findByTransactionIdOrderByEntrySequence(String transactionId);

    /**
     * Get account balance up to a specific date
     */
    @Query("""
        SELECT COALESCE(SUM(je.debitAmount) - SUM(je.creditAmount), 0)
        FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.transactionDate <= :asOfDate
        AND t.status = 'POSTED'
        """)
    BigDecimal getAccountBalanceAsOfDate(
        @Param("accountId") String accountId,
        @Param("asOfDate") LocalDate asOfDate
    );

    /**
     * Get account ledger (all entries with running balance)
     */
    @Query("""
        SELECT je.id, je.transactionId, je.debitAmount, je.creditAmount, 
               je.balanceAfter, je.description, je.createdAt,
               t.transactionNumber, t.description as transactionDescription,
               t.transactionDate
        FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.status = 'POSTED'
        ORDER BY t.transactionDate, je.entrySequence
        """)
    List<Object[]> getAccountLedger(@Param("accountId") String accountId);

    /**
     * Get account ledger for a specific date range
     */
    @Query("""
        SELECT je.id, je.transactionId, je.debitAmount, je.creditAmount, 
               je.balanceAfter, je.description, je.createdAt,
               t.transactionNumber, t.description as transactionDescription,
               t.transactionDate
        FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.transactionDate BETWEEN :startDate AND :endDate
        AND t.status = 'POSTED'
        ORDER BY t.transactionDate, je.entrySequence
        """)
    List<Object[]> getAccountLedgerForPeriod(
        @Param("accountId") String accountId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /**
     * Get total debits and credits for an account in a period
     */
    @Query("""
        SELECT COALESCE(SUM(je.debitAmount), 0) as totalDebits,
               COALESCE(SUM(je.creditAmount), 0) as totalCredits
        FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.transactionDate BETWEEN :startDate AND :endDate
        AND t.status = 'POSTED'
        """)
    Object[] getAccountTotalsForPeriod(
        @Param("accountId") String accountId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /**
     * Find journal entries with specific amount
     */
    @Query("""
        SELECT je FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE (je.debitAmount = :amount OR je.creditAmount = :amount)
        AND t.status = 'POSTED'
        ORDER BY t.transactionDate DESC
        """)
    List<JournalEntry> findByAmount(@Param("amount") BigDecimal amount);

    /**
     * Find journal entries in amount range
     */
    @Query("""
        SELECT je FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE ((je.debitAmount BETWEEN :minAmount AND :maxAmount) 
               OR (je.creditAmount BETWEEN :minAmount AND :maxAmount))
        AND t.status = 'POSTED'
        ORDER BY t.transactionDate DESC
        """)
    List<JournalEntry> findByAmountRange(
        @Param("minAmount") BigDecimal minAmount,
        @Param("maxAmount") BigDecimal maxAmount
    );

    /**
     * Get daily balance movements for an account
     */
    @Query("""
        SELECT t.transactionDate,
               COALESCE(SUM(je.debitAmount), 0) as dailyDebits,
               COALESCE(SUM(je.creditAmount), 0) as dailyCredits,
               COALESCE(SUM(je.debitAmount) - SUM(je.creditAmount), 0) as netMovement
        FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.transactionDate BETWEEN :startDate AND :endDate
        AND t.status = 'POSTED'
        GROUP BY t.transactionDate
        ORDER BY t.transactionDate
        """)
    List<Object[]> getDailyBalanceMovements(
        @Param("accountId") String accountId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /**
     * Find entries with potential data integrity issues
     */
    @Query("""
        SELECT je FROM JournalEntry je
        WHERE (je.debitAmount < 0 OR je.creditAmount < 0)
        OR (je.debitAmount > 0 AND je.creditAmount > 0)
        OR (je.debitAmount = 0 AND je.creditAmount = 0)
        """)
    List<JournalEntry> findEntriesWithIntegrityIssues();

    /**
     * Get entries created in a specific time range
     */
    List<JournalEntry> findByCreatedAtBetween(LocalDateTime startDateTime, LocalDateTime endDateTime);

    /**
     * Find entries by description pattern
     */
    @Query("""
        SELECT je FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE (LOWER(je.description) LIKE LOWER(CONCAT('%', :pattern, '%'))
               OR LOWER(t.description) LIKE LOWER(CONCAT('%', :pattern, '%')))
        AND t.status = 'POSTED'
        ORDER BY t.transactionDate DESC
        """)
    List<JournalEntry> findByDescriptionContaining(@Param("pattern") String pattern);

    /**
     * Get account activity summary
     */
    @Query("""
        SELECT COUNT(je) as entryCount,
               COALESCE(SUM(je.debitAmount), 0) as totalDebits,
               COALESCE(SUM(je.creditAmount), 0) as totalCredits,
               MIN(t.transactionDate) as firstTransactionDate,
               MAX(t.transactionDate) as lastTransactionDate
        FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.status = 'POSTED'
        """)
    Object[] getAccountActivitySummary(@Param("accountId") String accountId);

    /**
     * Find largest transactions by account
     */
    @Query("""
        SELECT je FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.status = 'POSTED'
        ORDER BY GREATEST(je.debitAmount, je.creditAmount) DESC
        LIMIT :limit
        """)
    List<JournalEntry> findLargestTransactionsByAccount(
        @Param("accountId") String accountId,
        @Param("limit") int limit
    );

    /**
     * Get monthly account activity
     */
    @Query("""
        SELECT YEAR(t.transactionDate) as year,
               MONTH(t.transactionDate) as month,
               COUNT(je) as entryCount,
               COALESCE(SUM(je.debitAmount), 0) as totalDebits,
               COALESCE(SUM(je.creditAmount), 0) as totalCredits
        FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.transactionDate >= :startDate
        AND t.status = 'POSTED'
        GROUP BY YEAR(t.transactionDate), MONTH(t.transactionDate)
        ORDER BY year, month
        """)
    List<Object[]> getMonthlyAccountActivity(
        @Param("accountId") String accountId,
        @Param("startDate") LocalDate startDate
    );

    /**
     * Find duplicate entries (same transaction, account, amount)
     */
    @Query("""
        SELECT je FROM JournalEntry je
        WHERE EXISTS (
            SELECT 1 FROM JournalEntry je2
            WHERE je2.transactionId = je.transactionId
            AND je2.accountId = je.accountId
            AND je2.debitAmount = je.debitAmount
            AND je2.creditAmount = je.creditAmount
            AND je2.id != je.id
        )
        ORDER BY je.transactionId, je.accountId
        """)
    List<JournalEntry> findPotentialDuplicateEntries();

    /**
     * Get balance verification data for an account
     */
    @Query("""
        SELECT je.balanceAfter,
               LAG(je.balanceAfter) OVER (ORDER BY t.transactionDate, je.entrySequence) as previousBalance,
               CASE 
                   WHEN je.debitAmount > 0 THEN je.debitAmount
                   ELSE -je.creditAmount
               END as movement
        FROM JournalEntry je
        INNER JOIN Transaction t ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.status = 'POSTED'
        ORDER BY t.transactionDate, je.entrySequence
        """)
    List<Object[]> getBalanceVerificationData(@Param("accountId") String accountId);
}
