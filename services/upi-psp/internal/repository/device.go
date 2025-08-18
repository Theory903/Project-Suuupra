package repository

import (
	"github.com/google/uuid"
	"github.com/suuupra/upi-psp/internal/models"
	"gorm.io/gorm"
)

// DeviceRepository handles device data operations
type DeviceRepository struct {
	db *gorm.DB
}

// NewDeviceRepository creates a new device repository
func NewDeviceRepository(db *gorm.DB) *DeviceRepository {
	return &DeviceRepository{db: db}
}

// Create creates a new device
func (r *DeviceRepository) Create(device *models.Device) error {
	return r.db.Create(device).Error
}

// GetByID gets a device by ID
func (r *DeviceRepository) GetByID(id uuid.UUID) (*models.Device, error) {
	var device models.Device
	err := r.db.Where("id = ?", id).First(&device).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

// GetByDeviceID gets a device by device ID
func (r *DeviceRepository) GetByDeviceID(deviceID string) (*models.Device, error) {
	var device models.Device
	err := r.db.Where("device_id = ?", deviceID).First(&device).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

// GetByUserID gets all devices for a user
func (r *DeviceRepository) GetByUserID(userID uuid.UUID) ([]models.Device, error) {
	var devices []models.Device
	err := r.db.Where("user_id = ?", userID).Find(&devices).Error
	return devices, err
}

// GetActiveByUserID gets all active devices for a user
func (r *DeviceRepository) GetActiveByUserID(userID uuid.UUID) ([]models.Device, error) {
	var devices []models.Device
	err := r.db.Where("user_id = ? AND is_active = ?", userID, true).Find(&devices).Error
	return devices, err
}

// GetPrimaryByUserID gets the primary device for a user
func (r *DeviceRepository) GetPrimaryByUserID(userID uuid.UUID) (*models.Device, error) {
	var device models.Device
	err := r.db.Where("user_id = ? AND is_primary = ?", userID, true).First(&device).Error
	if err != nil {
		return nil, err
	}
	return &device, nil
}

// Update updates a device
func (r *DeviceRepository) Update(device *models.Device) error {
	return r.db.Save(device).Error
}

// Delete deletes a device
func (r *DeviceRepository) Delete(id uuid.UUID) error {
	return r.db.Delete(&models.Device{}, id).Error
}

// DeactivateByDeviceID deactivates a device by device ID
func (r *DeviceRepository) DeactivateByDeviceID(deviceID string) error {
	return r.db.Model(&models.Device{}).Where("device_id = ?", deviceID).Update("is_active", false).Error
}

// SetPrimary sets a device as primary and unsets others
func (r *DeviceRepository) SetPrimary(userID, deviceID uuid.UUID) error {
	tx := r.db.Begin()
	defer func() {
		if r := recover(); r != nil {
			tx.Rollback()
		}
	}()

	// Unset all other devices as non-primary
	if err := tx.Model(&models.Device{}).Where("user_id = ?", userID).Update("is_primary", false).Error; err != nil {
		tx.Rollback()
		return err
	}

	// Set the specified device as primary
	if err := tx.Model(&models.Device{}).Where("id = ?", deviceID).Update("is_primary", true).Error; err != nil {
		tx.Rollback()
		return err
	}

	return tx.Commit().Error
}

// DeviceExists checks if a device exists by device ID
func (r *DeviceRepository) DeviceExists(deviceID string) bool {
	var count int64
	r.db.Model(&models.Device{}).Where("device_id = ?", deviceID).Count(&count)
	return count > 0
}

// IsDeviceOwnedByUser checks if a device belongs to a specific user
func (r *DeviceRepository) IsDeviceOwnedByUser(deviceID string, userID uuid.UUID) bool {
	var count int64
	r.db.Model(&models.Device{}).Where("device_id = ? AND user_id = ?", deviceID, userID).Count(&count)
	return count > 0
}
