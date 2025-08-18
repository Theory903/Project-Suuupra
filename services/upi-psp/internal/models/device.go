package models

import (
	"time"

	"github.com/google/uuid"
	"gorm.io/gorm"
)

// Device represents a user's registered device
type Device struct {
	ID        uuid.UUID      `json:"id" gorm:"type:uuid;primary_key;default:gen_random_uuid()"`
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `json:"-" gorm:"index"`

	// User relationship
	UserID uuid.UUID `json:"user_id" gorm:"type:uuid;not null;index"`
	User   User      `json:"user,omitempty" gorm:"foreignKey:UserID"`

	// Device Information
	DeviceID          string `json:"device_id" gorm:"not null;uniqueIndex"`
	DeviceFingerprint string `json:"device_fingerprint" gorm:"not null"`
	DeviceName        string `json:"device_name"`
	DeviceType        string `json:"device_type"` // mobile, tablet, web
	Platform          string `json:"platform"`    // ios, android, web
	OSVersion         string `json:"os_version"`
	AppVersion        string `json:"app_version"`

	// Security
	PublicKey      string     `json:"-" gorm:"type:text"` // For device-specific encryption
	LastUsedAt     time.Time  `json:"last_used_at"`
	LastLoginIP    string     `json:"last_login_ip"`
	IsActive       bool       `json:"is_active" gorm:"default:true"`
	IsPrimary      bool       `json:"is_primary" gorm:"default:false"`
	TrustLevel     int        `json:"trust_level" gorm:"default:0"` // 0-100
	FailedAttempts int        `json:"failed_attempts" gorm:"default:0"`
	LockedUntil    *time.Time `json:"locked_until"`

	// Biometric
	BiometricEnabled bool   `json:"biometric_enabled" gorm:"default:false"`
	BiometricHash    string `json:"-"` // Hashed biometric template

	// Location (last known)
	LastLatitude  *float64 `json:"last_latitude"`
	LastLongitude *float64 `json:"last_longitude"`
	LastLocation  string   `json:"last_location"`

	// Push Notifications
	FCMToken string `json:"-"` // Firebase Cloud Messaging token
}

// BeforeCreate sets the ID if not already set
func (d *Device) BeforeCreate(tx *gorm.DB) error {
	if d.ID == uuid.Nil {
		d.ID = uuid.New()
	}
	return nil
}

// IsLocked checks if the device is locked due to failed attempts
func (d *Device) IsLocked() bool {
	if d.LockedUntil == nil {
		return false
	}
	return time.Now().Before(*d.LockedUntil)
}

// IsTrusted checks if the device is trusted (trust level >= 80)
func (d *Device) IsTrusted() bool {
	return d.TrustLevel >= 80
}

// UpdateLastUsed updates the last used timestamp and IP
func (d *Device) UpdateLastUsed(ip string) {
	d.LastUsedAt = time.Now()
	d.LastLoginIP = ip
}

// IncrementFailedAttempts increments failed attempts and locks if needed
func (d *Device) IncrementFailedAttempts() {
	d.FailedAttempts++

	// Lock device after 5 failed attempts for 30 minutes
	if d.FailedAttempts >= 5 {
		lockUntil := time.Now().Add(30 * time.Minute)
		d.LockedUntil = &lockUntil
	}
}

// ResetFailedAttempts resets failed attempts counter
func (d *Device) ResetFailedAttempts() {
	d.FailedAttempts = 0
	d.LockedUntil = nil
}
