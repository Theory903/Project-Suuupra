package com.suuupra.ledger.domain.repository;

import com.suuupra.ledger.domain.entity.Transaction;
import com.suuupra.ledger.domain.entity.TransactionStatus;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.JpaSpecificationExecutor;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import org.springframework.stereotype.Repository;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;
import java.util.Optional;

/**
 * Repository interface for Transaction operations.
 * Provides CRUD operations and custom queries for transaction management.
 */
@Repository
public interface TransactionRepository extends JpaRepository<Transaction, String>, 
                                               JpaSpecificationExecutor<Transaction> {

    /**
     * Find a transaction by its unique transaction number
     */
    Optional<Transaction> findByTransactionNumber(String transactionNumber);

    /**
     * Find transactions by status
     */
    List<Transaction> findByStatus(TransactionStatus status);

    /**
     * Find transactions by reference ID
     */
    List<Transaction> findByReferenceId(String referenceId);

    /**
     * Find transactions by source system
     */
    List<Transaction> findBySourceSystem(String sourceSystem);

    /**
     * Find transactions by transaction type
     */
    List<Transaction> findByTransactionType(String transactionType);

    /**
     * Find transactions by created by user
     */
    List<Transaction> findByCreatedBy(String createdBy);

    /**
     * Find transactions in a date range
     */
    List<Transaction> findByTransactionDateBetween(LocalDate startDate, LocalDate endDate);

    /**
     * Find transactions posted in a date range
     */
    List<Transaction> findByPostedAtBetween(LocalDateTime startDateTime, LocalDateTime endDateTime);

    /**
     * Find transactions by status and date range
     */
    List<Transaction> findByStatusAndTransactionDateBetween(
        TransactionStatus status, 
        LocalDate startDate, 
        LocalDate endDate
    );

    /**
     * Check if a transaction number already exists
     */
    boolean existsByTransactionNumber(String transactionNumber);

    /**
     * Find the latest transaction (for hash chain)
     */
    @Query("""
        SELECT t FROM Transaction t 
        WHERE t.status = 'POSTED'
        ORDER BY t.postedAt DESC, t.createdAt DESC
        LIMIT 1
        """)
    Optional<Transaction> findLatestPostedTransaction();

    /**
     * Find transactions with broken hash chain
     */
    @Query("""
        SELECT t1 FROM Transaction t1
        LEFT JOIN Transaction t2 ON t1.previousHash = t2.hashValue
        WHERE t1.previousHash IS NOT NULL 
        AND t2.id IS NULL
        AND t1.status = 'POSTED'
        ORDER BY t1.postedAt
        """)
    List<Transaction> findTransactionsWithBrokenHashChain();

    /**
     * Get total transaction volume for a period
     */
    @Query("""
        SELECT COALESCE(SUM(t.totalAmount), 0)
        FROM Transaction t 
        WHERE t.status = 'POSTED'
        AND t.transactionDate BETWEEN :startDate AND :endDate
        """)
    BigDecimal getTotalVolumeForPeriod(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /**
     * Get transaction count for a period
     */
    @Query("""
        SELECT COUNT(t)
        FROM Transaction t 
        WHERE t.status = 'POSTED'
        AND t.transactionDate BETWEEN :startDate AND :endDate
        """)
    Long getTransactionCountForPeriod(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /**
     * Get transaction statistics by type for a period
     */
    @Query("""
        SELECT t.transactionType, 
               COUNT(t) as transactionCount,
               COALESCE(SUM(t.totalAmount), 0) as totalAmount
        FROM Transaction t 
        WHERE t.status = 'POSTED'
        AND t.transactionDate BETWEEN :startDate AND :endDate
        GROUP BY t.transactionType
        ORDER BY totalAmount DESC
        """)
    List<Object[]> getTransactionStatsByTypeForPeriod(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /**
     * Find pending transactions older than specified hours
     */
    @Query("""
        SELECT t FROM Transaction t 
        WHERE t.status = 'PENDING'
        AND t.createdAt < :cutoffTime
        ORDER BY t.createdAt
        """)
    List<Transaction> findOldPendingTransactions(@Param("cutoffTime") LocalDateTime cutoffTime);

    /**
     * Find unbalanced posted transactions (should not exist if business rules are enforced)
     */
    @Query("""
        SELECT t FROM Transaction t
        WHERE t.status = 'POSTED'
        AND t.id NOT IN (
            SELECT je.transactionId FROM JournalEntry je
            GROUP BY je.transactionId
            HAVING SUM(je.debitAmount) = SUM(je.creditAmount)
        )
        """)
    List<Transaction> findUnbalancedPostedTransactions();

    /**
     * Get daily transaction summary for a period
     */
    @Query("""
        SELECT t.transactionDate,
               COUNT(t) as transactionCount,
               COALESCE(SUM(t.totalAmount), 0) as totalAmount,
               COUNT(DISTINCT t.sourceSystem) as sourceSystemCount
        FROM Transaction t 
        WHERE t.status = 'POSTED'
        AND t.transactionDate BETWEEN :startDate AND :endDate
        GROUP BY t.transactionDate
        ORDER BY t.transactionDate
        """)
    List<Object[]> getDailyTransactionSummary(
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /**
     * Find transactions requiring reconciliation
     */
    @Query("""
        SELECT t FROM Transaction t
        WHERE t.status = 'POSTED'
        AND t.transactionType IN ('PAYMENT', 'SETTLEMENT', 'TRANSFER')
        AND t.transactionDate = :businessDate
        ORDER BY t.postedAt
        """)
    List<Transaction> findTransactionsForReconciliation(@Param("businessDate") LocalDate businessDate);

    /**
     * Get hash chain verification data
     */
    @Query("""
        SELECT t.id, t.transactionNumber, t.hashValue, t.previousHash, t.postedAt
        FROM Transaction t
        WHERE t.status = 'POSTED'
        ORDER BY t.postedAt, t.createdAt
        """)
    List<Object[]> getHashChainVerificationData();

    /**
     * Find transactions by amount range
     */
    @Query("""
        SELECT t FROM Transaction t
        WHERE t.totalAmount BETWEEN :minAmount AND :maxAmount
        AND t.status = 'POSTED'
        ORDER BY t.totalAmount DESC
        """)
    List<Transaction> findByAmountRange(
        @Param("minAmount") BigDecimal minAmount,
        @Param("maxAmount") BigDecimal maxAmount
    );

    /**
     * Get latest transactions for audit
     */
    @Query("""
        SELECT t FROM Transaction t
        WHERE t.status = 'POSTED'
        ORDER BY t.postedAt DESC
        LIMIT :limit
        """)
    List<Transaction> findLatestTransactions(@Param("limit") int limit);

    /**
     * Find transactions with specific journal entry patterns
     */
    @Query("""
        SELECT DISTINCT t FROM Transaction t
        INNER JOIN JournalEntry je ON je.transactionId = t.id
        WHERE je.accountId = :accountId
        AND t.transactionDate BETWEEN :startDate AND :endDate
        AND t.status = 'POSTED'
        ORDER BY t.transactionDate DESC
        """)
    List<Transaction> findTransactionsByAccountAndDateRange(
        @Param("accountId") String accountId,
        @Param("startDate") LocalDate startDate,
        @Param("endDate") LocalDate endDate
    );

    /**
     * Get monthly transaction volume trends
     */
    @Query("""
        SELECT YEAR(t.transactionDate) as year,
               MONTH(t.transactionDate) as month,
               COUNT(t) as transactionCount,
               COALESCE(SUM(t.totalAmount), 0) as totalAmount
        FROM Transaction t 
        WHERE t.status = 'POSTED'
        AND t.transactionDate >= :startDate
        GROUP BY YEAR(t.transactionDate), MONTH(t.transactionDate)
        ORDER BY year, month
        """)
    List<Object[]> getMonthlyTransactionTrends(@Param("startDate") LocalDate startDate);
}
