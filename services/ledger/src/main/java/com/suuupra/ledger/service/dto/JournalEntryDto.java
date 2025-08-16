package com.suuupra.ledger.service.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDateTime;

/**
 * DTO for journal entry data transfer
 */
public class JournalEntryDto {

    private String id;

    private String transactionId;

    @NotBlank(message = "Account ID is required")
    private String accountId;

    @DecimalMin(value = "0.0", inclusive = true, message = "Debit amount must be non-negative")
    private BigDecimal debitAmount;

    @DecimalMin(value = "0.0", inclusive = true, message = "Credit amount must be non-negative")
    private BigDecimal creditAmount;

    private BigDecimal balanceAfter;

    @Size(max = 500, message = "Description must not exceed 500 characters")
    private String description;

    private Integer entrySequence;

    private String hashValue;

    private LocalDateTime createdAt;

    // Constructors
    public JournalEntryDto() {}

    public JournalEntryDto(String accountId, BigDecimal debitAmount, BigDecimal creditAmount, String description) {
        this.accountId = accountId;
        this.debitAmount = debitAmount != null ? debitAmount : BigDecimal.ZERO;
        this.creditAmount = creditAmount != null ? creditAmount : BigDecimal.ZERO;
        this.description = description;
    }

    // Business methods
    public boolean isDebitEntry() {
        return debitAmount != null && debitAmount.compareTo(BigDecimal.ZERO) > 0;
    }

    public boolean isCreditEntry() {
        return creditAmount != null && creditAmount.compareTo(BigDecimal.ZERO) > 0;
    }

    public BigDecimal getEntryAmount() {
        return isDebitEntry() ? debitAmount : creditAmount;
    }

    public boolean isValidEntry() {
        boolean hasDebit = debitAmount != null && debitAmount.compareTo(BigDecimal.ZERO) > 0;
        boolean hasCredit = creditAmount != null && creditAmount.compareTo(BigDecimal.ZERO) > 0;
        return (hasDebit && !hasCredit) || (!hasDebit && hasCredit);
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
        this.debitAmount = debitAmount;
    }

    public BigDecimal getCreditAmount() {
        return creditAmount;
    }

    public void setCreditAmount(BigDecimal creditAmount) {
        this.creditAmount = creditAmount;
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

    @Override
    public String toString() {
        return "JournalEntryDto{" +
                "id='" + id + '\'' +
                ", accountId='" + accountId + '\'' +
                ", debitAmount=" + debitAmount +
                ", creditAmount=" + creditAmount +
                ", balanceAfter=" + balanceAfter +
                ", description='" + description + '\'' +
                ", entrySequence=" + entrySequence +
                '}';
    }
}
