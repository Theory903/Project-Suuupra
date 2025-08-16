package com.suuupra.ledger.domain.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Transaction entity representing a complete double-entry accounting transaction
 * with cryptographic hash chain for data integrity.
 */
@Entity
@Table(name = "transactions", indexes = {
    @Index(name = "idx_transaction_number", columnList = "transaction_number", unique = true),
    @Index(name = "idx_reference_id", columnList = "reference_id"),
    @Index(name = "idx_transaction_type", columnList = "transaction_type"),
    @Index(name = "idx_status", columnList = "status"),
    @Index(name = "idx_transaction_date", columnList = "transaction_date"),
    @Index(name = "idx_posting_date", columnList = "posting_date"),
    @Index(name = "idx_source_system", columnList = "source_system"),
    @Index(name = "idx_hash_chain", columnList = "previous_hash")
})
public class Transaction {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @NotBlank
    @Size(max = 50)
    @Column(name = "transaction_number", unique = true, nullable = false, length = 50)
    private String transactionNumber;

    @Size(max = 100)
    @Column(name = "reference_id", length = 100)
    private String referenceId;

    @NotBlank
    @Size(max = 50)
    @Column(name = "transaction_type", nullable = false, length = 50)
    private String transactionType;

    @NotBlank
    @Size(max = 1000)
    @Column(name = "description", nullable = false, length = 1000)
    private String description;

    @NotNull
    @Column(name = "total_amount", precision = 19, scale = 4, nullable = false)
    private BigDecimal totalAmount;

    @NotBlank
    @Size(max = 3)
    @Column(name = "currency", nullable = false, length = 3)
    private String currency = "INR";

    @NotNull
    @Column(name = "transaction_date", nullable = false)
    private LocalDate transactionDate;

    @NotNull
    @Column(name = "posting_date", nullable = false)
    private LocalDate postingDate;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "status", nullable = false, length = 20)
    private TransactionStatus status = TransactionStatus.PENDING;

    @NotBlank
    @Size(max = 50)
    @Column(name = "source_system", nullable = false, length = 50)
    private String sourceSystem;

    @NotBlank
    @Size(max = 36)
    @Column(name = "created_by", nullable = false, length = 36)
    private String createdBy;

    @NotBlank
    @Size(max = 64)
    @Column(name = "hash_value", nullable = false, length = 64)
    private String hashValue;

    @Size(max = 64)
    @Column(name = "previous_hash", length = 64)
    private String previousHash;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @Column(name = "posted_at")
    private LocalDateTime postedAt;

    // Relationships
    @OneToMany(mappedBy = "transaction", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    @OrderBy("entrySequence ASC")
    private List<JournalEntry> journalEntries = new ArrayList<>();

    // Constructors
    public Transaction() {}

    public Transaction(String id, String transactionNumber, String transactionType, 
                      String description, BigDecimal totalAmount, LocalDate transactionDate,
                      LocalDate postingDate, String sourceSystem, String createdBy) {
        this.id = id;
        this.transactionNumber = transactionNumber;
        this.transactionType = transactionType;
        this.description = description;
        this.totalAmount = totalAmount;
        this.transactionDate = transactionDate;
        this.postingDate = postingDate;
        this.sourceSystem = sourceSystem;
        this.createdBy = createdBy;
    }

    // Business Methods
    public boolean isPending() {
        return TransactionStatus.PENDING.equals(this.status);
    }

    public boolean isPosted() {
        return TransactionStatus.POSTED.equals(this.status);
    }

    public boolean isReversed() {
        return TransactionStatus.REVERSED.equals(this.status);
    }

    public boolean isCancelled() {
        return TransactionStatus.CANCELLED.equals(this.status);
    }

    public boolean canBePosted() {
        return isPending() && isBalanced();
    }

    public boolean canBeReversed() {
        return isPosted();
    }

    public boolean canBeCancelled() {
        return isPending();
    }

    public boolean isBalanced() {
        if (journalEntries.isEmpty()) {
            return false;
        }

        BigDecimal totalDebits = journalEntries.stream()
            .map(JournalEntry::getDebitAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        BigDecimal totalCredits = journalEntries.stream()
            .map(JournalEntry::getCreditAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);

        return totalDebits.compareTo(totalCredits) == 0 && 
               totalDebits.compareTo(totalAmount) == 0;
    }

    public void post() {
        if (!canBePosted()) {
            throw new IllegalStateException("Transaction cannot be posted in current state");
        }
        this.status = TransactionStatus.POSTED;
        this.postedAt = LocalDateTime.now();
    }

    public void reverse() {
        if (!canBeReversed()) {
            throw new IllegalStateException("Transaction cannot be reversed in current state");
        }
        this.status = TransactionStatus.REVERSED;
    }

    public void cancel() {
        if (!canBeCancelled()) {
            throw new IllegalStateException("Transaction cannot be cancelled in current state");
        }
        this.status = TransactionStatus.CANCELLED;
    }

    public void addJournalEntry(JournalEntry entry) {
        if (entry != null) {
            journalEntries.add(entry);
            entry.setTransaction(this);
        }
    }

    public void removeJournalEntry(JournalEntry entry) {
        if (entry != null) {
            journalEntries.remove(entry);
            entry.setTransaction(null);
        }
    }

    public BigDecimal getTotalDebits() {
        return journalEntries.stream()
            .map(JournalEntry::getDebitAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public BigDecimal getTotalCredits() {
        return journalEntries.stream()
            .map(JournalEntry::getCreditAmount)
            .reduce(BigDecimal.ZERO, BigDecimal::add);
    }

    public void validateBusinessRules() {
        if (!isBalanced()) {
            throw new IllegalStateException("Transaction is not balanced: debits must equal credits");
        }
        
        if (journalEntries.size() < 2) {
            throw new IllegalStateException("Transaction must have at least 2 journal entries");
        }

        journalEntries.forEach(JournalEntry::validateBusinessRules);
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getTransactionNumber() {
        return transactionNumber;
    }

    public void setTransactionNumber(String transactionNumber) {
        this.transactionNumber = transactionNumber;
    }

    public String getReferenceId() {
        return referenceId;
    }

    public void setReferenceId(String referenceId) {
        this.referenceId = referenceId;
    }

    public String getTransactionType() {
        return transactionType;
    }

    public void setTransactionType(String transactionType) {
        this.transactionType = transactionType;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public BigDecimal getTotalAmount() {
        return totalAmount;
    }

    public void setTotalAmount(BigDecimal totalAmount) {
        this.totalAmount = totalAmount;
    }

    public String getCurrency() {
        return currency;
    }

    public void setCurrency(String currency) {
        this.currency = currency;
    }

    public LocalDate getTransactionDate() {
        return transactionDate;
    }

    public void setTransactionDate(LocalDate transactionDate) {
        this.transactionDate = transactionDate;
    }

    public LocalDate getPostingDate() {
        return postingDate;
    }

    public void setPostingDate(LocalDate postingDate) {
        this.postingDate = postingDate;
    }

    public TransactionStatus getStatus() {
        return status;
    }

    public void setStatus(TransactionStatus status) {
        this.status = status;
    }

    public String getSourceSystem() {
        return sourceSystem;
    }

    public void setSourceSystem(String sourceSystem) {
        this.sourceSystem = sourceSystem;
    }

    public String getCreatedBy() {
        return createdBy;
    }

    public void setCreatedBy(String createdBy) {
        this.createdBy = createdBy;
    }

    public String getHashValue() {
        return hashValue;
    }

    public void setHashValue(String hashValue) {
        this.hashValue = hashValue;
    }

    public String getPreviousHash() {
        return previousHash;
    }

    public void setPreviousHash(String previousHash) {
        this.previousHash = previousHash;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getPostedAt() {
        return postedAt;
    }

    public void setPostedAt(LocalDateTime postedAt) {
        this.postedAt = postedAt;
    }

    public List<JournalEntry> getJournalEntries() {
        return journalEntries;
    }

    public void setJournalEntries(List<JournalEntry> journalEntries) {
        this.journalEntries = journalEntries;
    }

    @Override
    public boolean equals(Object o) {
        if (this == o) return true;
        if (!(o instanceof Transaction)) return false;
        Transaction that = (Transaction) o;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }

    @Override
    public String toString() {
        return "Transaction{" +
                "id='" + id + '\'' +
                ", transactionNumber='" + transactionNumber + '\'' +
                ", transactionType='" + transactionType + '\'' +
                ", totalAmount=" + totalAmount +
                ", status=" + status +
                ", transactionDate=" + transactionDate +
                '}';
    }
}
