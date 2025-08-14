package repository

import (
	"context"
	"database/sql"
	"time"
)

// TransactionStatus represents the status of a transaction
type TransactionStatus string

const (
	StatusPending   TransactionStatus = "PENDING"
	StatusSuccess   TransactionStatus = "SUCCESS"
	StatusFailed    TransactionStatus = "FAILED"
	StatusTimeout   TransactionStatus = "TIMEOUT"
	StatusCancelled TransactionStatus = "CANCELLED"
	StatusReversed  TransactionStatus = "REVERSED"
)

// TransactionType represents the type of transaction
type TransactionType string

const (
	TypeP2P    TransactionType = "P2P"
	TypeP2M    TransactionType = "P2M"
	TypeM2P    TransactionType = "M2P"
	TypeRefund TransactionType = "REFUND"
)

// Transaction represents a UPI transaction
type Transaction struct {
	ID             string            `db:"id"`
	TransactionID  string            `db:"transaction_id"`
	RRN            string            `db:"rrn"`
	PayerVPA       string            `db:"payer_vpa"`
	PayeeVPA       string            `db:"payee_vpa"`
	AmountPaisa    int64             `db:"amount_paisa"`
	Currency       string            `db:"currency"`
	Type           TransactionType   `db:"transaction_type"`
	Status         TransactionStatus `db:"status"`
	Description    string            `db:"description"`
	Reference      string            `db:"reference"`
	PayerBankCode  string            `db:"payer_bank_code"`
	PayeeBankCode  string            `db:"payee_bank_code"`
	SwitchFeePaisa int64             `db:"switch_fee_paisa"`
	BankFeePaisa   int64             `db:"bank_fee_paisa"`
	TotalFeePaisa  int64             `db:"total_fee_paisa"`
	SettlementID   string            `db:"settlement_id"`
	ErrorCode      string            `db:"error_code"`
	ErrorMessage   string            `db:"error_message"`
	Signature      string            `db:"signature"`
	Metadata       map[string]string `db:"metadata"`
	InitiatedAt    time.Time         `db:"initiated_at"`
	ProcessedAt    *time.Time        `db:"processed_at"`
	ExpiresAt      *time.Time        `db:"expires_at"`
	CreatedAt      time.Time         `db:"created_at"`
	UpdatedAt      time.Time         `db:"updated_at"`
}

// VPAMapping represents a Virtual Payment Address mapping
type VPAMapping struct {
	ID                string    `db:"id"`
	VPA               string    `db:"vpa"`
	BankCode          string    `db:"bank_code"`
	AccountNumber     string    `db:"account_number"`
	AccountHolderName string    `db:"account_holder_name"`
	MobileNumber      string    `db:"mobile_number"`
	IsActive          bool      `db:"is_active"`
	CreatedAt         time.Time `db:"created_at"`
	UpdatedAt         time.Time `db:"updated_at"`
}

// Bank represents a participating bank
type Bank struct {
	ID                string     `db:"id"`
	BankCode          string     `db:"bank_code"`
	BankName          string     `db:"bank_name"`
	IFSCPrefix        string     `db:"ifsc_prefix"`
	EndpointURL       string     `db:"endpoint_url"`
	PublicKey         string     `db:"public_key"`
	Status            string     `db:"status"`
	LastHeartbeat     *time.Time `db:"last_heartbeat"`
	SuccessRate       int        `db:"success_rate"`
	AvgResponseTimeMS int        `db:"avg_response_time_ms"`
	Features          []string   `db:"features"`
	CreatedAt         time.Time  `db:"created_at"`
	UpdatedAt         time.Time  `db:"updated_at"`
}

// TransactionRepository defines the interface for transaction operations
type TransactionRepository interface {
	// ACID Transaction Operations
	BeginTransaction(ctx context.Context) (*sql.Tx, error)
	CommitTransaction(tx *sql.Tx) error
	RollbackTransaction(tx *sql.Tx) error

	// Transaction CRUD operations
	CreateTransaction(ctx context.Context, tx *sql.Tx, transaction *Transaction) error
	GetTransactionByID(ctx context.Context, transactionID string) (*Transaction, error)
	GetTransactionByRRN(ctx context.Context, rrn string) (*Transaction, error)
	UpdateTransactionStatus(ctx context.Context, tx *sql.Tx, transactionID string, status TransactionStatus, reason string, errorCode string, errorMessage string) error
	ListTransactionsByStatus(ctx context.Context, status TransactionStatus, limit int) ([]*Transaction, error)
	ListTransactionsByVPA(ctx context.Context, vpa string, limit int) ([]*Transaction, error)

	// VPA operations
	GetVPAMapping(ctx context.Context, vpa string) (*VPAMapping, error)
	CreateVPAMapping(ctx context.Context, tx *sql.Tx, mapping *VPAMapping) error
	UpdateVPAMapping(ctx context.Context, tx *sql.Tx, vpa string, mapping *VPAMapping) error
	DeactivateVPA(ctx context.Context, tx *sql.Tx, vpa string) error

	// Bank operations
	GetBankByCode(ctx context.Context, bankCode string) (*Bank, error)
	ListActiveBanks(ctx context.Context) ([]*Bank, error)
	UpdateBankStatus(ctx context.Context, tx *sql.Tx, bankCode string, status string) error
	UpdateBankHealth(ctx context.Context, tx *sql.Tx, bankCode string, successRate int, avgResponseTime int) error

	// Idempotency operations
	CheckIdempotencyKey(ctx context.Context, keyHash string) (bool, string, error)
	StoreIdempotencyKey(ctx context.Context, tx *sql.Tx, keyHash string, entityType string, entityID string, responseData []byte, expiresAt time.Time) error

	// Audit operations
	LogAudit(ctx context.Context, tx *sql.Tx, entityType string, entityID string, action string, actor string, oldValues map[string]interface{}, newValues map[string]interface{}, correlationID string) error

	// Lock operations for distributed coordination
	AcquireLock(ctx context.Context, lockName string, ownerID string, duration time.Duration) (bool, error)
	ReleaseLock(ctx context.Context, lockName string, ownerID string) error
}

// PostgreSQLTransactionRepository implements TransactionRepository for PostgreSQL
type PostgreSQLTransactionRepository struct {
	db *sql.DB
}

// NewPostgreSQLTransactionRepository creates a new PostgreSQL transaction repository
func NewPostgreSQLTransactionRepository(db *sql.DB) TransactionRepository {
	return &PostgreSQLTransactionRepository{
		db: db,
	}
}

// BeginTransaction starts a new database transaction
func (r *PostgreSQLTransactionRepository) BeginTransaction(ctx context.Context) (*sql.Tx, error) {
	return r.db.BeginTx(ctx, &sql.TxOptions{
		Isolation: sql.LevelReadCommitted,
	})
}

// CommitTransaction commits the database transaction
func (r *PostgreSQLTransactionRepository) CommitTransaction(tx *sql.Tx) error {
	return tx.Commit()
}

// RollbackTransaction rolls back the database transaction
func (r *PostgreSQLTransactionRepository) RollbackTransaction(tx *sql.Tx) error {
	return tx.Rollback()
}

// CreateTransaction creates a new transaction record with ACID guarantees
func (r *PostgreSQLTransactionRepository) CreateTransaction(ctx context.Context, tx *sql.Tx, transaction *Transaction) error {
	query := `
		INSERT INTO transactions (
			transaction_id, rrn, payer_vpa, payee_vpa, amount_paisa, currency,
			transaction_type, status, description, reference, payer_bank_code, payee_bank_code,
			switch_fee_paisa, bank_fee_paisa, total_fee_paisa, signature, metadata,
			initiated_at, expires_at
		) VALUES (
			$1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19
		)
	`

	_, err := tx.ExecContext(ctx, query,
		transaction.TransactionID,
		transaction.RRN,
		transaction.PayerVPA,
		transaction.PayeeVPA,
		transaction.AmountPaisa,
		transaction.Currency,
		transaction.Type,
		transaction.Status,
		transaction.Description,
		transaction.Reference,
		transaction.PayerBankCode,
		transaction.PayeeBankCode,
		transaction.SwitchFeePaisa,
		transaction.BankFeePaisa,
		transaction.TotalFeePaisa,
		transaction.Signature,
		transaction.Metadata,
		transaction.InitiatedAt,
		transaction.ExpiresAt,
	)

	return err
}

// GetTransactionByID retrieves a transaction by its ID
func (r *PostgreSQLTransactionRepository) GetTransactionByID(ctx context.Context, transactionID string) (*Transaction, error) {
	query := `
		SELECT id, transaction_id, rrn, payer_vpa, payee_vpa, amount_paisa, currency,
			   transaction_type, status, description, reference, payer_bank_code, payee_bank_code,
			   switch_fee_paisa, bank_fee_paisa, total_fee_paisa, settlement_id, error_code, error_message,
			   signature, metadata, initiated_at, processed_at, expires_at, created_at, updated_at
		FROM transactions
		WHERE transaction_id = $1
	`

	var transaction Transaction
	err := r.db.QueryRowContext(ctx, query, transactionID).Scan(
		&transaction.ID,
		&transaction.TransactionID,
		&transaction.RRN,
		&transaction.PayerVPA,
		&transaction.PayeeVPA,
		&transaction.AmountPaisa,
		&transaction.Currency,
		&transaction.Type,
		&transaction.Status,
		&transaction.Description,
		&transaction.Reference,
		&transaction.PayerBankCode,
		&transaction.PayeeBankCode,
		&transaction.SwitchFeePaisa,
		&transaction.BankFeePaisa,
		&transaction.TotalFeePaisa,
		&transaction.SettlementID,
		&transaction.ErrorCode,
		&transaction.ErrorMessage,
		&transaction.Signature,
		&transaction.Metadata,
		&transaction.InitiatedAt,
		&transaction.ProcessedAt,
		&transaction.ExpiresAt,
		&transaction.CreatedAt,
		&transaction.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &transaction, nil
}

// UpdateTransactionStatus updates transaction status using the stored function
func (r *PostgreSQLTransactionRepository) UpdateTransactionStatus(ctx context.Context, tx *sql.Tx, transactionID string, status TransactionStatus, reason string, errorCode string, errorMessage string) error {
	query := `SELECT update_transaction_status($1, $2, $3, $4, $5, $6)`

	var success bool
	err := tx.QueryRowContext(ctx, query, transactionID, string(status), reason, "SYSTEM", errorCode, errorMessage).Scan(&success)

	if err != nil {
		return err
	}

	if !success {
		return sql.ErrNoRows
	}

	return nil
}

// GetVPAMapping retrieves VPA mapping information
func (r *PostgreSQLTransactionRepository) GetVPAMapping(ctx context.Context, vpa string) (*VPAMapping, error) {
	query := `
		SELECT id, vpa, bank_code, account_number, account_holder_name, mobile_number,
			   is_active, created_at, updated_at
		FROM vpa_mappings
		WHERE vpa = $1 AND is_active = true
	`

	var mapping VPAMapping
	err := r.db.QueryRowContext(ctx, query, vpa).Scan(
		&mapping.ID,
		&mapping.VPA,
		&mapping.BankCode,
		&mapping.AccountNumber,
		&mapping.AccountHolderName,
		&mapping.MobileNumber,
		&mapping.IsActive,
		&mapping.CreatedAt,
		&mapping.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &mapping, nil
}

// GetBankByCode retrieves bank information by bank code
func (r *PostgreSQLTransactionRepository) GetBankByCode(ctx context.Context, bankCode string) (*Bank, error) {
	query := `
		SELECT id, bank_code, bank_name, ifsc_prefix, endpoint_url, public_key,
			   status, last_heartbeat, success_rate, avg_response_time_ms, features,
			   created_at, updated_at
		FROM banks
		WHERE bank_code = $1
	`

	var bank Bank
	err := r.db.QueryRowContext(ctx, query, bankCode).Scan(
		&bank.ID,
		&bank.BankCode,
		&bank.BankName,
		&bank.IFSCPrefix,
		&bank.EndpointURL,
		&bank.PublicKey,
		&bank.Status,
		&bank.LastHeartbeat,
		&bank.SuccessRate,
		&bank.AvgResponseTimeMS,
		&bank.Features,
		&bank.CreatedAt,
		&bank.UpdatedAt,
	)

	if err != nil {
		return nil, err
	}

	return &bank, nil
}

// CheckIdempotencyKey checks if an idempotency key exists and returns the cached response
func (r *PostgreSQLTransactionRepository) CheckIdempotencyKey(ctx context.Context, keyHash string) (bool, string, error) {
	query := `
		SELECT entity_id, response_data
		FROM idempotency_keys
		WHERE key_hash = $1 AND expires_at > CURRENT_TIMESTAMP
	`

	var entityID string
	var responseData []byte
	err := r.db.QueryRowContext(ctx, query, keyHash).Scan(&entityID, &responseData)

	if err == sql.ErrNoRows {
		return false, "", nil
	}

	if err != nil {
		return false, "", err
	}

	return true, string(responseData), nil
}

// StoreIdempotencyKey stores an idempotency key with cached response
func (r *PostgreSQLTransactionRepository) StoreIdempotencyKey(ctx context.Context, tx *sql.Tx, keyHash string, entityType string, entityID string, responseData []byte, expiresAt time.Time) error {
	query := `
		INSERT INTO idempotency_keys (key_hash, entity_type, entity_id, response_data, expires_at)
		VALUES ($1, $2, $3, $4, $5)
		ON CONFLICT (key_hash) DO UPDATE SET
			response_data = EXCLUDED.response_data,
			expires_at = EXCLUDED.expires_at
	`

	_, err := tx.ExecContext(ctx, query, keyHash, entityType, entityID, responseData, expiresAt)
	return err
}

// LogAudit logs an audit entry for tracking changes
func (r *PostgreSQLTransactionRepository) LogAudit(ctx context.Context, tx *sql.Tx, entityType string, entityID string, action string, actor string, oldValues map[string]interface{}, newValues map[string]interface{}, correlationID string) error {
	query := `
		INSERT INTO audit_logs (entity_type, entity_id, action, actor, old_values, new_values, correlation_id)
		VALUES ($1, $2, $3, $4, $5, $6, $7)
	`

	_, err := tx.ExecContext(ctx, query, entityType, entityID, action, actor, oldValues, newValues, correlationID)
	return err
}

// AcquireLock attempts to acquire a distributed lock
func (r *PostgreSQLTransactionRepository) AcquireLock(ctx context.Context, lockName string, ownerID string, duration time.Duration) (bool, error) {
	expiresAt := time.Now().Add(duration)

	query := `
		INSERT INTO distributed_locks (lock_name, owner_id, expires_at)
		VALUES ($1, $2, $3)
		ON CONFLICT (lock_name) DO UPDATE SET
			owner_id = EXCLUDED.owner_id,
			acquired_at = CURRENT_TIMESTAMP,
			expires_at = EXCLUDED.expires_at
		WHERE distributed_locks.expires_at < CURRENT_TIMESTAMP
	`

	result, err := r.db.ExecContext(ctx, query, lockName, ownerID, expiresAt)
	if err != nil {
		return false, err
	}

	rowsAffected, err := result.RowsAffected()
	if err != nil {
		return false, err
	}

	return rowsAffected > 0, nil
}

// ReleaseLock releases a distributed lock
func (r *PostgreSQLTransactionRepository) ReleaseLock(ctx context.Context, lockName string, ownerID string) error {
	query := `DELETE FROM distributed_locks WHERE lock_name = $1 AND owner_id = $2`

	_, err := r.db.ExecContext(ctx, query, lockName, ownerID)
	return err
}

// Placeholder implementations for remaining methods
func (r *PostgreSQLTransactionRepository) GetTransactionByRRN(ctx context.Context, rrn string) (*Transaction, error) {
	// Implementation similar to GetTransactionByID but filtering by RRN
	return nil, nil
}

func (r *PostgreSQLTransactionRepository) ListTransactionsByStatus(ctx context.Context, status TransactionStatus, limit int) ([]*Transaction, error) {
	// Implementation to list transactions by status
	return nil, nil
}

func (r *PostgreSQLTransactionRepository) ListTransactionsByVPA(ctx context.Context, vpa string, limit int) ([]*Transaction, error) {
	// Implementation to list transactions by VPA
	return nil, nil
}

func (r *PostgreSQLTransactionRepository) CreateVPAMapping(ctx context.Context, tx *sql.Tx, mapping *VPAMapping) error {
	// Implementation to create VPA mapping
	return nil
}

func (r *PostgreSQLTransactionRepository) UpdateVPAMapping(ctx context.Context, tx *sql.Tx, vpa string, mapping *VPAMapping) error {
	// Implementation to update VPA mapping
	return nil
}

func (r *PostgreSQLTransactionRepository) DeactivateVPA(ctx context.Context, tx *sql.Tx, vpa string) error {
	// Implementation to deactivate VPA
	return nil
}

func (r *PostgreSQLTransactionRepository) ListActiveBanks(ctx context.Context) ([]*Bank, error) {
	// Implementation to list active banks
	return nil, nil
}

func (r *PostgreSQLTransactionRepository) UpdateBankStatus(ctx context.Context, tx *sql.Tx, bankCode string, status string) error {
	// Implementation to update bank status
	return nil
}

func (r *PostgreSQLTransactionRepository) UpdateBankHealth(ctx context.Context, tx *sql.Tx, bankCode string, successRate int, avgResponseTime int) error {
	// Implementation to update bank health metrics
	return nil
}
