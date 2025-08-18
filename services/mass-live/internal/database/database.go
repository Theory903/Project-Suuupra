package database

import (
	"fmt"
	"mass-live/internal/models"

	"gorm.io/driver/postgres"
	"gorm.io/gorm"
)

type DB struct {
	DB *gorm.DB
}

func New(databaseURL string) (*DB, error) {
	db, err := gorm.Open(postgres.Open(databaseURL), &gorm.Config{})
	if err != nil {
		return nil, fmt.Errorf("failed to connect to database: %w", err)
	}

	return &DB{DB: db}, nil
}

func (d *DB) Migrate() error {
	return d.DB.AutoMigrate(
		&models.Stream{},
		&models.StreamAnalytics{},
		&models.ChatMessage{},
		&models.Viewer{},
	)
}

func (d *DB) Close() error {
	sqlDB, err := d.DB.DB()
	if err != nil {
		return err
	}
	return sqlDB.Close()
}

func (d *DB) CreateStream(stream *models.Stream) error {
	return d.DB.Create(stream).Error
}

func (d *DB) UpdateStreamStatus(streamID string, status models.StreamStatus) error {
	return d.DB.Model(&models.Stream{}).Where("id = ?", streamID).Update("status", status).Error
}

func (d *DB) UpdateStreamViewerCount(streamID string, count int) error {
	return d.DB.Model(&models.Stream{}).Where("id = ?", streamID).Update("viewer_count", count).Error
}
