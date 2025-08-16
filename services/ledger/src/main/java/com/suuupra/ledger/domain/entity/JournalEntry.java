package com.suuupra.ledger.domain.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * Journal Entry entity representing individual debit/credit entries
 * in the double-entry accounting system.
 */
@Entity
@Table(name = "journal_entries", indexes = {
    @Index(name = "idx_transaction_id", columnList = "transaction_id"),
    @Index(name = "idx_account_id", columnList = "account_id"),
    @Index(name = "idx_entry_sequence", columnList = "transaction_id,entry_sequence"),
    @Index(name = "idx_created_at", columnList = "created_at")
})
public class JournalEntry {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @NotNull
    @Column(name = "transaction_id", nullable = false, length = 36)
    private String transactionId;

    @NotNull
    @Column(name = "account_id", nullable = false, length = 36)
    private String accountId;

    @DecimalMin(value = "0.0", inclusive = true)
    @Column(name = "debit_amount", precision = 19, scale = 4, nullable = false)
    private BigDecimal debitAmount = BigDecimal.ZERO;

    @DecimalMin(value = "0.0", inclusive = true)
    @Column(name = "credit_amount", precision = 19, scale = 4, nullable = false)
    private BigDecimal creditAmount = BigDecimal.ZERO;

    @NotNull
    @Column(name = "balance_after", precision = 19, scale = 4, nullable = false)
    private BigDecimal balanceAfter;

    @Size(max = 500)
    @Column(name = "description", length = 500)
    private String description;

    @NotNull
    @Column(name = "entry_sequence", nullable = false)
    private Integer entrySequence;

    @NotNull
    @Size(max = 64)
    @Column(name = "hash_value", nullable = false, length = 64)
    private String hashValue;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    // Relationships
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "transaction_id", insertable = false, updatable = false)
    private Transaction transaction;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "account_id", insertable = false, updatable = false)
    private ChartOfAccounts account;

    // Constructors
    public JournalEntry() {}

    public JournalEntry(String id, String transactionId, String accountId, 
                       BigDecimal debitAmount, BigDecimal creditAmount, 
                       BigDecimal balanceAfter, Integer entrySequence) {
        this.id = id;
        this.transactionId = transactionId;
        this.accountId = accountId;
        this.debitAmount = debitAmount != null ? debitAmount : BigDecimal.ZERO;
        this.creditAmount = creditAmount != null ? creditAmount : BigDecimal.ZERO;
        this.balanceAfter = balanceAfter;
        this.entrySequence = entrySequence;
    }

    // Business Methods
    public boolean isDebitEntry() {
        return debitAmount.compareTo(BigDecimal.ZERO) > 0;
    }

    public boolean isCreditEntry() {
        return creditAmount.compareTo(BigDecimal.ZERO) > 0;
    }

    public BigDecimal getEntryAmount() {
        return isDebitEntry() ? debitAmount : creditAmount;
    }

    public boolean isValidEntry() {
        // Entry must be either debit or credit, but not both and not neither
        boolean hasDebit = debitAmount.compareTo(BigDecimal.ZERO) > 0;
        boolean hasCredit = creditAmount.compareTo(BigDecimal.ZERO) > 0;
        return (hasDebit && !hasCredit) || (!hasDebit && hasCredit);
    }

    public void validateBusinessRules() {
        if (!isValidEntry()) {
            throw new IllegalStateException("Journal entry must have either debit or credit amount, but not both");
        }
        if (debitAmount.compareTo(BigDecimal.ZERO) < 0 || creditAmount.compareTo(BigDecimal.ZERO) < 0) {
            throw new IllegalStateException("Debit and credit amounts cannot be negative");
        }
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTransactionId() {
        return transactionId;
    }

    public void setTransactionId(String transactionId) {
        this.transactionId = transactionId;
    }

    public String getAccountId() {
        return accountId;
    }

    public void setAccountId(String accountId) {
        this.accountId = accountId;
    }

    public BigDecimal getDebitAmount() {
        return debitAmount;
    }

    public void setDebitAmount(BigDecimal debitAmount) {
        this.debitAmount = debitAmount != null ? debitAmount : BigDecimal.ZERO;
    }

    public BigDecimal getCreditAmount() {
        return creditAmount;
    }

    public void setCreditAmount(BigDecimal creditAmount) {
        this.creditAmount = creditAmount != null ? creditAmount : BigDecimal.ZERO;
    }

    public BigDecimal getBalanceAfter() {
        return balanceAfter;
    }

    public void setBalanceAfter(BigDecimal balanceAfter) {
        this.balanceAfter = balanceAfter;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public Integer getEntrySequence() {
        return entrySequence;
    }

    public void setEntrySequence(Integer entrySequence) {
        this.entrySequence = entrySequence;
    }

    public String getHashValue() {
        return hashValue;
    }

    public void setHashValue(String hashValue) {
        this.hashValue = hashValue;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public Transaction getTransaction() {
        return transaction;
    }

    public void setTransaction(Transaction transaction) {
        this.transaction = transaction;
    }

    public ChartOfAccounts getAccount() {
        return account;
    }

    public void setAccount(ChartOfAccounts account) {
        this.account = account;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof JournalEntry)) return false;
        JournalEntry that = (JournalEntry) o;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }

    @Override
    public String toString() {
        return "JournalEntry{" +
                "id='" + id + '\'' +
                ", transactionId='" + transactionId + '\'' +
                ", accountId='" + accountId + '\'' +
                ", debitAmount=" + debitAmount +
                ", creditAmount=" + creditAmount +
                ", balanceAfter=" + balanceAfter +
                ", entrySequence=" + entrySequence +
                '}';
    }
}
