package com.suuupra.ledger.domain.entity;

/**
 * Enumeration of transaction statuses in the ledger system.
 * 
 * Represents the lifecycle of a transaction from creation to final state.
 */
public enum TransactionStatus {
    
    /**
     * Transaction has been created but not yet posted to the ledger.
     * In this state, the transaction can be modified or cancelled.
     */
    PENDING("Pending"),
    
    /**
     * Transaction has been posted to the ledger and all journal entries are finalized.
     * Posted transactions are immutable and affect account balances.
     */
    POSTED("Posted"),
    
    /**
     * Transaction has been reversed by creating offsetting entries.
     * This maintains the audit trail while neutralizing the transaction's effect.
     */
    REVERSED("Reversed"),
    
    /**
     * Transaction has been cancelled before posting.
     * Cancelled transactions do not affect account balances.
     */
    CANCELLED("Cancelled");

    private final String displayName;

    TransactionStatus(String displayName) {
        this.displayName = displayName;
    }

    /**
     * @return The human-readable display name of the transaction status
     */
    public String getDisplayName() {
        return displayName;
    }

    /**
     * Checks if the transaction is in a final state (cannot be modified)
     * 
     * @return True for POSTED, REVERSED, or CANCELLED status
     */
    public boolean isFinalState() {
        return this == POSTED || this == REVERSED || this == CANCELLED;
    }

    /**
     * Checks if the transaction is in an active state (affects account balances)
     * 
     * @return True for POSTED status only
     */
    public boolean isActive() {
        return this == POSTED;
    }

    /**
     * Checks if the transaction can be modified
     * 
     * @return True only for PENDING status
     */
    public boolean canBeModified() {
        return this == PENDING;
    }

    /**
     * Checks if the transaction can be posted
     * 
     * @return True only for PENDING status
     */
    public boolean canBePosted() {
        return this == PENDING;
    }

    /**
     * Checks if the transaction can be reversed
     * 
     * @return True only for POSTED status
     */
    public boolean canBeReversed() {
        return this == POSTED;
    }

    /**
     * Checks if the transaction can be cancelled
     * 
     * @return True only for PENDING status
     */
    public boolean canBeCancelled() {
        return this == PENDING;
    }

    @Override
    public String toString() {
        return displayName;
    }
}