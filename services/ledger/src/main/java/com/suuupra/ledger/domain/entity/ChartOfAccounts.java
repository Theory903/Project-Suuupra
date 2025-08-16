package com.suuupra.ledger.domain.entity;

import jakarta.persistence.*;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.LocalDateTime;
import java.util.ArrayList;
import java.util.List;

/**
 * Chart of Accounts entity representing the hierarchical structure of accounts
 * in the double-entry accounting system.
 */
@Entity
@Table(name = "chart_of_accounts", indexes = {
    @Index(name = "idx_account_code", columnList = "account_code", unique = true),
    @Index(name = "idx_account_type", columnList = "account_type"),
    @Index(name = "idx_parent_account", columnList = "parent_account_id"),
    @Index(name = "idx_active_accounts", columnList = "is_active")
})
public class ChartOfAccounts {

    @Id
    @Column(name = "id", length = 36)
    private String id;

    @NotBlank
    @Size(max = 20)
    @Column(name = "account_code", unique = true, nullable = false, length = 20)
    private String accountCode;

    @NotBlank
    @Size(max = 100)
    @Column(name = "account_name", nullable = false, length = 100)
    private String accountName;

    @NotNull
    @Enumerated(EnumType.STRING)
    @Column(name = "account_type", nullable = false, length = 20)
    private AccountType accountType;

    @Column(name = "parent_account_id", length = 36)
    private String parentAccountId;

    @Column(name = "is_active", nullable = false)
    private Boolean isActive = true;

    @Size(max = 500)
    @Column(name = "description", length = 500)
    private String description;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt;

    // Self-referencing relationship for hierarchical structure
    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "parent_account_id", insertable = false, updatable = false)
    private ChartOfAccounts parentAccount;

    @OneToMany(mappedBy = "parentAccount", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<ChartOfAccounts> childAccounts = new ArrayList<>();

    @OneToMany(mappedBy = "account", cascade = CascadeType.ALL, fetch = FetchType.LAZY)
    private List<JournalEntry> journalEntries = new ArrayList<>();

    // Constructors
    public ChartOfAccounts() {}

    public ChartOfAccounts(String id, String accountCode, String accountName, AccountType accountType) {
        this.id = id;
        this.accountCode = accountCode;
        this.accountName = accountName;
        this.accountType = accountType;
    }

    // Business Methods
    public boolean isAssetAccount() {
        return AccountType.ASSET.equals(this.accountType);
    }

    public boolean isLiabilityAccount() {
        return AccountType.LIABILITY.equals(this.accountType);
    }

    public boolean isEquityAccount() {
        return AccountType.EQUITY.equals(this.accountType);
    }

    public boolean isRevenueAccount() {
        return AccountType.REVENUE.equals(this.accountType);
    }

    public boolean isExpenseAccount() {
        return AccountType.EXPENSE.equals(this.accountType);
    }

    public boolean hasParent() {
        return parentAccountId != null;
    }

    public boolean hasChildren() {
        return !childAccounts.isEmpty();
    }

    // Getters and Setters
    public String getId() {
        return id;
    }

    public void setId(String id) {
        this.id = id;
    }

    public String getAccountCode() {
        return accountCode;
    }

    public void setAccountCode(String accountCode) {
        this.accountCode = accountCode;
    }

    public String getAccountName() {
        return accountName;
    }

    public void setAccountName(String accountName) {
        this.accountName = accountName;
    }

    public AccountType getAccountType() {
        return accountType;
    }

    public void setAccountType(AccountType accountType) {
        this.accountType = accountType;
    }

    public String getParentAccountId() {
        return parentAccountId;
    }

    public void setParentAccountId(String parentAccountId) {
        this.parentAccountId = parentAccountId;
    }

    public Boolean getIsActive() {
        return isActive;
    }

    public void setIsActive(Boolean isActive) {
        this.isActive = isActive;
    }

    public String getDescription() {
        return description;
    }

    public void setDescription(String description) {
        this.description = description;
    }

    public LocalDateTime getCreatedAt() {
        return createdAt;
    }

    public void setCreatedAt(LocalDateTime createdAt) {
        this.createdAt = createdAt;
    }

    public LocalDateTime getUpdatedAt() {
        return updatedAt;
    }

    public void setUpdatedAt(LocalDateTime updatedAt) {
        this.updatedAt = updatedAt;
    }

    public ChartOfAccounts getParentAccount() {
        return parentAccount;
    }

    public void setParentAccount(ChartOfAccounts parentAccount) {
        this.parentAccount = parentAccount;
    }

    public List<ChartOfAccounts> getChildAccounts() {
        return childAccounts;
    }

    public void setChildAccounts(List<ChartOfAccounts> childAccounts) {
        this.childAccounts = childAccounts;
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
        if (!(o instanceof ChartOfAccounts)) return false;
        ChartOfAccounts that = (ChartOfAccounts) o;
        return id != null && id.equals(that.id);
    }

    @Override
    public int hashCode() {
        return id != null ? id.hashCode() : 0;
    }

    @Override
    public String toString() {
        return "ChartOfAccounts{" +
                "id='" + id + '\'' +
                ", accountCode='" + accountCode + '\'' +
                ", accountName='" + accountName + '\'' +
                ", accountType=" + accountType +
                ", isActive=" + isActive +
                '}';
    }
}
