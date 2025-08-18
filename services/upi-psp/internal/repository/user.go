package repository

import (
	"github.com/google/uuid"
	"github.com/suuupra/upi-psp/internal/models"
	"gorm.io/gorm"
)

// UserRepository handles user data operations
type UserRepository struct {
	db *gorm.DB
}

// NewUserRepository creates a new user repository
func NewUserRepository(db *gorm.DB) *UserRepository {
	return &UserRepository{db: db}
}

// Create creates a new user
func (r *UserRepository) Create(user *models.User) error {
	return r.db.Create(user).Error
}

// GetByID gets a user by ID
func (r *UserRepository) GetByID(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByEmail gets a user by email
func (r *UserRepository) GetByEmail(email string) (*models.User, error) {
	var user models.User
	err := r.db.Where("email = ?", email).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetByPhoneNumber gets a user by phone number
func (r *UserRepository) GetByPhoneNumber(phoneNumber string) (*models.User, error) {
	var user models.User
	err := r.db.Where("phone_number = ?", phoneNumber).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// Update updates a user
func (r *UserRepository) Update(user *models.User) error {
	return r.db.Save(user).Error
}

// Delete deletes a user
func (r *UserRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.User{}, id).Error
}

// GetWithDevices gets a user with their devices
func (r *UserRepository) GetWithDevices(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.Preload("Devices").Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// GetWithVPAs gets a user with their VPAs
func (r *UserRepository) GetWithVPAs(id uuid.UUID) (*models.User, error) {
	var user models.User
	err := r.db.Preload("VPAs").Where("id = ?", id).First(&user).Error
	if err != nil {
		return nil, err
	}
	return &user, nil
}

// Exists checks if a user exists by ID
func (r *UserRepository) Exists(id uuid.UUID) bool {
	var count int64
	r.db.Model(&models.User{}).Where("id = ?", id).Count(&count)
	return count > 0
}

// EmailExists checks if an email already exists
func (r *UserRepository) EmailExists(email string) bool {
	var count int64
	r.db.Model(&models.User{}).Where("email = ?", email).Count(&count)
	return count > 0
}

// PhoneExists checks if a phone number already exists
func (r *UserRepository) PhoneExists(phoneNumber string) bool {
	var count int64
	r.db.Model(&models.User{}).Where("phone_number = ?", phoneNumber).Count(&count)
	return count > 0
}
