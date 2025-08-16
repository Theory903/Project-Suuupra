package com.suuupra.ledger.domain.entity;

/**
 * Enumeration of account types in the double-entry accounting system.
 * 
 * Based on the fundamental accounting equation:
 * Assets = Liabilities + Equity
 * 
 * And the expanded equation:
 * Assets + Expenses = Liabilities + Equity + Revenue
 */
public enum AccountType {
    
    /**
     * Asset accounts represent resources owned by the entity
     * Normal balance: Debit
     * Examples: Cash, Accounts Receivable, Inventory, Equipment
     */
    ASSET("Asset", true),
    
    /**
     * Liability accounts represent obligations owed by the entity
     * Normal balance: Credit
     * Examples: Accounts Payable, Loans Payable, Accrued Expenses
     */
    LIABILITY("Liability", false),
    
    /**
     * Equity accounts represent ownership interest in the entity
     * Normal balance: Credit
     * Examples: Owner's Equity, Retained Earnings, Common Stock
     */
    EQUITY("Equity", false),
    
    /**
     * Revenue accounts represent income earned by the entity
     * Normal balance: Credit
     * Examples: Sales Revenue, Service Revenue, Interest Income
     */
    REVENUE("Revenue", false),
    
    /**
     * Expense accounts represent costs incurred by the entity
     * Normal balance: Debit
     * Examples: Salaries Expense, Rent Expense, Utilities Expense
     */
    EXPENSE("Expense", true);

    private final String displayName;
    private final boolean normalDebitBalance;

    AccountType(String displayName, boolean normalDebitBalance) {
        this.displayName = displayName;
        this.normalDebitBalance = normalDebitBalance;
    }

    /**
     * @return The human-readable display name of the account type
     */
    public String getDisplayName() {
        return displayName;
    }

    /**
     * @return True if this account type has a normal debit balance, false if credit
     */
    public boolean hasNormalDebitBalance() {
        return normalDebitBalance;
    }

    /**
     * @return True if this account type has a normal credit balance, false if debit
     */
    public boolean hasNormalCreditBalance() {
        return !normalDebitBalance;
    }

    /**
     * Determines if an increase to this account type should be recorded as a debit
     * 
     * @return True if increases are debits, false if increases are credits
     */
    public boolean increaseIsDebit() {
        return normalDebitBalance;
    }

    /**
     * Determines if a decrease to this account type should be recorded as a debit
     * 
     * @return True if decreases are debits, false if decreases are credits
     */
    public boolean decreaseIsDebit() {
        return !normalDebitBalance;
    }

    /**
     * Checks if this account type appears on the left side of the accounting equation
     * (Assets + Expenses = Liabilities + Equity + Revenue)
     * 
     * @return True for ASSET and EXPENSE, false for LIABILITY, EQUITY, and REVENUE
     */
    public boolean isLeftSideOfEquation() {
        return this == ASSET || this == EXPENSE;
    }

    /**
     * Checks if this account type appears on the right side of the accounting equation
     * (Assets + Expenses = Liabilities + Equity + Revenue)
     * 
     * @return True for LIABILITY, EQUITY, and REVENUE, false for ASSET and EXPENSE
     */
    public boolean isRightSideOfEquation() {
        return this == LIABILITY || this == EQUITY || this == REVENUE;
    }

    /**
     * Checks if this is a balance sheet account (permanent account)
     * 
     * @return True for ASSET, LIABILITY, and EQUITY accounts
     */
    public boolean isBalanceSheetAccount() {
        return this == ASSET || this == LIABILITY || this == EQUITY;
    }

    /**
     * Checks if this is an income statement account (temporary account)
     * 
     * @return True for REVENUE and EXPENSE accounts
     */
    public boolean isIncomeStatementAccount() {
        return this == REVENUE || this == EXPENSE;
    }

    @Override
    public String toString() {
        return displayName;
    }
}
