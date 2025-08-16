package com.suuupra.ledger.service.dto;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.math.BigDecimal;
import java.time.LocalDate;
import java.util.List;

/**
 * DTO for creating a new transaction with journal entries
 */
public class CreateTransactionRequest {

    @NotBlank(message = "Transaction type is required")
    @Size(max = 50, message = "Transaction type must not exceed 50 characters")
    private String transactionType;

    @NotBlank(message = "Description is required")
    @Size(max = 1000, message = "Description must not exceed 1000 characters")
    private String description;

    @NotNull(message = "Total amount is required")
    @Positive(message = "Total amount must be positive")
    private BigDecimal totalAmount;

    @Size(max = 3, message = "Currency code must be 3 characters")
    private String currency;

    private LocalDate transactionDate;

    private LocalDate postingDate;

    @NotBlank(message = "Source system is required")
    @Size(max = 50, message = "Source system must not exceed 50 characters")
    private String sourceSystem;

    @NotBlank(message = "Created by is required")
    @Size(max = 36, message = "Created by must not exceed 36 characters")
    private String createdBy;

    @Size(max = 100, message = "Reference ID must not exceed 100 characters")
    private String referenceId;

    @NotNull(message = "Journal entries are required")
    @Size(min = 2, message = "At least 2 journal entries are required")
    @Valid
    private List<JournalEntryDto> journalEntries;

    // Constructors
    public CreateTransactionRequest() {}

    public CreateTransactionRequest(String transactionType, String description, BigDecimal totalAmount, 
                                   String sourceSystem, String createdBy, List<JournalEntryDto> journalEntries) {
        this.transactionType = transactionType;
        this.description = description;
        this.totalAmount = totalAmount;
        this.sourceSystem = sourceSystem;
        this.createdBy = createdBy;
        this.journalEntries = journalEntries;
    }

    // Getters and Setters
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

    public String getReferenceId() {
        return referenceId;
    }

    public void setReferenceId(String referenceId) {
        this.referenceId = referenceId;
    }

    public List<JournalEntryDto> getJournalEntries() {
        return journalEntries;
    }

    public void setJournalEntries(List<JournalEntryDto> journalEntries) {
        this.journalEntries = journalEntries;
    }

    @Override
    public String toString() {
        return "CreateTransactionRequest{" +
                "transactionType='" + transactionType + '\'' +
                ", description='" + description + '\'' +
                ", totalAmount=" + totalAmount +
                ", currency='" + currency + '\'' +
                ", sourceSystem='" + sourceSystem + '\'' +
                ", createdBy='" + createdBy + '\'' +
                ", journalEntriesCount=" + (journalEntries != null ? journalEntries.size() : 0) +
                '}';
    }
}
