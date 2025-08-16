package com.suuupra.ledger.service.dto;

import com.suuupra.ledger.domain.entity.TransactionStatus;
import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.util.List;

/**
 * DTO representing a complete transaction with journal entries
 */
public class TransactionDto {

    @NotBlank
    private String id;

    @NotBlank
    private String transactionNumber;

    private String referenceId;

    @NotBlank
    private String transactionType;

    @NotBlank
    private String description;

    @NotNull
    @Positive
    private BigDecimal totalAmount;

    @NotBlank
    @Size(max = 3)
    private String currency;

    @NotNull
    private LocalDate transactionDate;

    @NotNull
    private LocalDate postingDate;

    @NotNull
    private TransactionStatus status;

    @NotBlank
    private String sourceSystem;

    @NotBlank
    private String createdBy;

    @NotBlank
    private String hashValue;

    private String previousHash;

    @NotNull
    private LocalDateTime createdAt;

    private LocalDateTime postedAt;

    @Valid
    private List<JournalEntryDto> journalEntries;

    // Constructors
    public TransactionDto() {}

    public TransactionDto(String id, String transactionNumber, String transactionType, 
                         String description, BigDecimal totalAmount, TransactionStatus status) {
        this.id = id;
        this.transactionNumber = transactionNumber;
        this.transactionType = transactionType;
        this.description = description;
        this.totalAmount = totalAmount;
        this.status = status;
    }

    // Business methods
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

    public List<JournalEntryDto> getJournalEntries() {
        return journalEntries;
    }

    public void setJournalEntries(List<JournalEntryDto> journalEntries) {
        this.journalEntries = journalEntries;
    }

    @Override
    public String toString() {
        return "TransactionDto{" +
                "id='" + id + '\'' +
                ", transactionNumber='" + transactionNumber + '\'' +
                ", transactionType='" + transactionType + '\'' +
                ", totalAmount=" + totalAmount +
                ", status=" + status +
                ", currency='" + currency + '\'' +
                ", transactionDate=" + transactionDate +
                '}';
    }
}
