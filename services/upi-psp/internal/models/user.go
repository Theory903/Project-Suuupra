package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// User represents a UPI PSP user
type User struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// Personal Information
	FirstName   string     `json:"first_name" gorm:"not null"`
	LastName    string     `json:"last_name" gorm:"not null"`
	Email       string     `json:"email" gorm:"uniqueIndex;not null"`
	PhoneNumber string     `json:"phone_number" gorm:"uniqueIndex;not null"`
	DateOfBirth *time.Time `json:"date_of_birth"`

	// Authentication
	PasswordHash string `json:"-" gorm:"not null"`
	PINHash      string `json:"-"`
	IsActive     bool   `json:"is_active" gorm:"default:true"`
	IsVerified   bool   `json:"is_verified" gorm:"default:false"`

	// KYC Information
	KYCStatus    KYCStatus `json:"kyc_status" gorm:"default:pending"`
	KYCDocuments []byte    `json:"-" gorm:"type:jsonb"` // Encrypted KYC documents

	// Profile
	ProfilePicture string            `json:"profile_picture"`
	Preferences    map[string]string `json:"preferences" gorm:"type:jsonb"`

	// Relationships
	Devices         []Device         `json:"devices,omitempty" gorm:"foreignKey:UserID"`
	VPAs            []VPA            `json:"vpas,omitempty" gorm:"foreignKey:UserID"`
	Transactions    []Transaction    `json:"transactions,omitempty" gorm:"foreignKey:UserID"`
	PaymentRequests []PaymentRequest `json:"payment_requests,omitempty" gorm:"foreignKey:UserID"`
}

// KYCStatus represents the KYC verification status
type KYCStatus string

const (
	KYCStatusPending   KYCStatus = "pending"
	KYCStatusSubmitted KYCStatus = "submitted"
	KYCStatusVerified  KYCStatus = "verified"
	KYCStatusRejected  KYCStatus = "rejected"
)

// BeforeCreate sets the ID if not already set
func (u *User) BeforeCreate(tx *gorm.DB) error {
	if u.ID == uuid.Nil {
		u.ID = uuid.New()
	}
	return nil
}

// FullName returns the user's full name
func (u *User) FullName() string {
	return u.FirstName + " " + u.LastName
}

// IsKYCCompleted checks if KYC is completed
func (u *User) IsKYCCompleted() bool {
	return u.KYCStatus == KYCStatusVerified
}
