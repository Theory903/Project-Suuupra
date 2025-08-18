package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// VPA represents a Virtual Payment Address
type VPA struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// User relationship
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	User   User      `json:"user,omitempty" gorm:"foreignKey:UserID"`

	// VPA Information
	Address     string `json:"address" gorm:"uniqueIndex;not null"` // e.g., user@suuupra
	Alias       string `json:"alias"`                               // Human-readable alias
	Description string `json:"description"`

	// Status
	IsActive   bool `json:"is_active" gorm:"default:true"`
	IsPrimary  bool `json:"is_primary" gorm:"default:false"`
	IsVerified bool `json:"is_verified" gorm:"default:false"`

	// Privacy Settings
	IsPrivate        bool `json:"is_private" gorm:"default:false"`
	AllowNameReveal  bool `json:"allow_name_reveal" gorm:"default:true"`
	AllowPhoneReveal bool `json:"allow_phone_reveal" gorm:"default:false"`

	// Usage Statistics
	TransactionCount int       `json:"transaction_count" gorm:"default:0"`
	LastUsedAt       time.Time `json:"last_used_at"`

	// Bank Account Linking
	BankAccountNumber string `json:"-"` // Encrypted
	BankIFSC          string `json:"bank_ifsc"`
	BankName          string `json:"bank_name"`
}

// BeforeCreate sets the ID if not already set
func (v *VPA) BeforeCreate(tx *gorm.DB) error {
	if v.ID == uuid.Nil {
		v.ID = uuid.New()
	}
	return nil
}

// GetDisplayName returns the display name for the VPA
func (v *VPA) GetDisplayName() string {
	if v.Alias != "" {
		return v.Alias
	}
	return v.Address
}

// UpdateUsage updates usage statistics
func (v *VPA) UpdateUsage() {
	v.TransactionCount++
	v.LastUsedAt = time.Now()
}
