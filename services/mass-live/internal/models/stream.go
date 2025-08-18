package models

import (
	"time"
	"gorm.io/gorm"
)

// StreamStatus represents the status of a live stream
type StreamStatus string

const (
	StreamStatusScheduled StreamStatus = "scheduled"
	StreamStatusLive      StreamStatus = "live"
	StreamStatusEnded     StreamStatus = "ended"
	StreamStatusError     StreamStatus = "error"
)

// Stream represents a live stream in the database
type Stream struct {
	ID              string                 `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	Key             string                 `gorm:"uniqueIndex;not null" json:"key"`
	Title           string                 `gorm:"not null" json:"title"`
	Description     string                 `json:"description"`
	CreatorID       string                 `gorm:"not null;index" json:"creator_id"`
	Status          StreamStatus           `gorm:"default:scheduled;index" json:"status"`
	ViewerCount     int                    `gorm:"default:0" json:"viewer_count"`
	PeakViewers     int                    `gorm:"default:0" json:"peak_viewers"`
	MaxViewers      int                    `gorm:"default:1000000" json:"max_viewers"`
	IsPublic        bool                   `gorm:"default:true" json:"is_public"`
	EnableRecording bool                   `gorm:"default:false" json:"enable_recording"`
	EnableChat      bool                   `gorm:"default:true" json:"enable_chat"`
	Tags            []string               `gorm:"type:text[]" json:"tags"`
	Metadata        map[string]interface{} `gorm:"type:jsonb" json:"metadata"`
	
	// URLs
	RTMPUrl    string `json:"rtmp_url"`
	HLSUrl     string `json:"hls_url"`
	DASHUrl    string `json:"dash_url"`
	RecordingUrl string `json:"recording_url,omitempty"`
	
	// Timing
	ScheduledAt *time.Time `json:"scheduled_at"`
	StartedAt   *time.Time `json:"started_at"`
	EndedAt     *time.Time `json:"ended_at"`
	Duration    int        `json:"duration"` // in seconds
	
	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	
	// Relations
	Analytics []StreamAnalytics `gorm:"foreignKey:StreamID" json:"analytics,omitempty"`
	ChatMessages []ChatMessage `gorm:"foreignKey:StreamID" json:"chat_messages,omitempty"`
}

// StreamAnalytics represents analytics data for a stream
type StreamAnalytics struct {
	ID              string                 `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	StreamID        string                 `gorm:"not null;index" json:"stream_id"`
	Timestamp       time.Time              `gorm:"not null;index" json:"timestamp"`
	ViewerCount     int                    `gorm:"not null" json:"viewer_count"`
	ChatMessages    int                    `gorm:"default:0" json:"chat_messages"`
	Engagement      float64                `gorm:"default:0" json:"engagement"`
	QualityStats    map[string]interface{} `gorm:"type:jsonb" json:"quality_stats"`
	GeographicData  map[string]interface{} `gorm:"type:jsonb" json:"geographic_data"`
	DeviceStats     map[string]interface{} `gorm:"type:jsonb" json:"device_stats"`
	
	// Relations
	Stream Stream `gorm:"foreignKey:StreamID" json:"stream,omitempty"`
}

// ChatMessage represents a chat message in a live stream
type ChatMessage struct {
	ID        string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	StreamID  string    `gorm:"not null;index" json:"stream_id"`
	UserID    string    `gorm:"not null;index" json:"user_id"`
	Username  string    `gorm:"not null" json:"username"`
	Message   string    `gorm:"not null" json:"message"`
	Type      string    `gorm:"default:text" json:"type"` // text, emoji, system
	Timestamp time.Time `gorm:"not null;index" json:"timestamp"`
	
	// Moderation
	IsModerated bool   `gorm:"default:false" json:"is_moderated"`
	ModeratedBy string `json:"moderated_by,omitempty"`
	ModeratedAt *time.Time `json:"moderated_at,omitempty"`
	
	// Relations
	Stream Stream `gorm:"foreignKey:StreamID" json:"stream,omitempty"`
}

// Viewer represents a viewer of a live stream
type Viewer struct {
	ID           string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	StreamID     string    `gorm:"not null;index" json:"stream_id"`
	UserID       string    `gorm:"index" json:"user_id,omitempty"` // null for anonymous viewers
	SessionID    string    `gorm:"not null;index" json:"session_id"`
	IPAddress    string    `gorm:"not null" json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	Country      string    `json:"country"`
	City         string    `json:"city"`
	DeviceType   string    `json:"device_type"` // mobile, desktop, tablet, tv
	Quality      string    `json:"quality"`     // 240p, 360p, etc.
	JoinedAt     time.Time `gorm:"not null" json:"joined_at"`
	LeftAt       *time.Time `json:"left_at"`
	WatchDuration int      `gorm:"default:0" json:"watch_duration"` // seconds
	
	// Relations
	Stream Stream `gorm:"foreignKey:StreamID" json:"stream,omitempty"`
}

// StreamRecording represents a recording of a live stream
type StreamRecording struct {
	ID           string    `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	StreamID     string    `gorm:"not null;index" json:"stream_id"`
	FileName     string    `gorm:"not null" json:"file_name"`
	FilePath     string    `gorm:"not null" json:"file_path"`
	S3Key        string    `json:"s3_key"`
	S3Bucket     string    `json:"s3_bucket"`
	FileSize     int64     `gorm:"default:0" json:"file_size"`
	Duration     int       `gorm:"default:0" json:"duration"` // seconds
	Format       string    `gorm:"not null" json:"format"`
	Quality      string    `gorm:"not null" json:"quality"`
	Status       string    `gorm:"default:recording" json:"status"` // recording, processing, completed, failed
	StartedAt    time.Time `gorm:"not null" json:"started_at"`
	CompletedAt  *time.Time `json:"completed_at"`
	
	// Relations
	Stream Stream `gorm:"foreignKey:StreamID" json:"stream,omitempty"`
}

// CDNDistribution represents CDN distribution information
type CDNDistribution struct {
	ID           string                 `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	StreamID     string                 `gorm:"not null;index" json:"stream_id"`
	Provider     string                 `gorm:"not null" json:"provider"` // cloudfront, cloudflare, fastly
	DistributionID string               `gorm:"not null" json:"distribution_id"`
	URL          string                 `gorm:"not null" json:"url"`
	Status       string                 `gorm:"default:active" json:"status"` // active, inactive, error
	Config       map[string]interface{} `gorm:"type:jsonb" json:"config"`
	
	// Performance metrics
	CacheHitRatio    float64 `gorm:"default:0" json:"cache_hit_ratio"`
	BandwidthUsage   int64   `gorm:"default:0" json:"bandwidth_usage"`
	RequestCount     int64   `gorm:"default:0" json:"request_count"`
	EdgeResponseTime int     `gorm:"default:0" json:"edge_response_time"` // milliseconds
	
	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"deleted_at,omitempty"`
	
	// Relations
	Stream Stream `gorm:"foreignKey:StreamID" json:"stream,omitempty"`
}

// StreamEvent represents events that occur during a stream
type StreamEvent struct {
	ID        string                 `gorm:"primaryKey;type:uuid;default:gen_random_uuid()" json:"id"`
	StreamID  string                 `gorm:"not null;index" json:"stream_id"`
	EventType string                 `gorm:"not null;index" json:"event_type"` // start, stop, viewer_join, viewer_leave, error
	UserID    string                 `gorm:"index" json:"user_id,omitempty"`
	Data      map[string]interface{} `gorm:"type:jsonb" json:"data"`
	Timestamp time.Time              `gorm:"not null;index" json:"timestamp"`
	
	// Relations
	Stream Stream `gorm:"foreignKey:StreamID" json:"stream,omitempty"`
}
