package database

import (
	"time"

	"gorm.io/gorm"
)

// Stream represents a live stream
type Stream struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	Title       string     `gorm:"not null" json:"title"`
	Description string     `json:"description"`
	CreatorID   string     `gorm:"not null;index" json:"creator_id"`
	CreatorName string     `gorm:"not null" json:"creator_name"`
	Status      string     `gorm:"not null;default:'inactive'" json:"status"` // active, inactive, ended
	StartTime   *time.Time `json:"start_time,omitempty"`
	EndTime     *time.Time `json:"end_time,omitempty"`
	Duration    int64      `json:"duration_seconds"`

	// Stream configuration
	RTMPKey      string `gorm:"unique;not null" json:"rtmp_key"`
	IsPrivate    bool   `gorm:"default:false" json:"is_private"`
	MaxViewers   int    `gorm:"default:10000" json:"max_viewers"`
	Category     string `json:"category"`
	Tags         string `json:"tags"` // JSON array as string
	ThumbnailURL string `json:"thumbnail_url"`

	// Analytics
	PeakViewers    int   `gorm:"default:0" json:"peak_viewers"`
	TotalViewers   int64 `gorm:"default:0" json:"total_viewers"`
	TotalBandwidth int64 `gorm:"default:0" json:"total_bandwidth_bytes"`
	ChatMessages   int   `gorm:"default:0" json:"chat_messages"`
	Likes          int   `gorm:"default:0" json:"likes"`
	Shares         int   `gorm:"default:0" json:"shares"`

	// Timestamps
	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	ViewerSessions  []ViewerSession `gorm:"foreignKey:StreamID" json:"-"`
	Messages        []ChatMessage   `gorm:"foreignKey:StreamID" json:"-"`
	StreamQualities []StreamQuality `gorm:"foreignKey:StreamID" json:"-"`
}

// ViewerSession tracks individual viewer sessions
type ViewerSession struct {
	ID        uint       `gorm:"primaryKey" json:"id"`
	StreamID  string     `gorm:"not null;index" json:"stream_id"`
	UserID    string     `gorm:"index" json:"user_id"`
	Username  string     `json:"username"`
	JoinTime  time.Time  `gorm:"not null" json:"join_time"`
	LeaveTime *time.Time `json:"leave_time,omitempty"`
	Duration  int64      `json:"duration_seconds"`
	Quality   string     `json:"quality"`
	Location  string     `json:"location"`
	Device    string     `json:"device"`
	UserAgent string     `json:"user_agent"`
	IPAddress string     `json:"ip_address"`
	Bandwidth int64      `gorm:"default:0" json:"bandwidth_bytes"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Stream Stream `gorm:"foreignKey:StreamID" json:"-"`
}

// ChatMessage represents a chat message in a stream
type ChatMessage struct {
	ID          uint       `gorm:"primaryKey" json:"id"`
	StreamID    string     `gorm:"not null;index" json:"stream_id"`
	UserID      string     `gorm:"not null;index" json:"user_id"`
	Username    string     `gorm:"not null" json:"username"`
	Message     string     `gorm:"not null" json:"message"`
	MessageType string     `gorm:"default:'text'" json:"message_type"` // text, emoji, system
	IsModerated bool       `gorm:"default:false" json:"is_moderated"`
	ModeratedBy string     `json:"moderated_by,omitempty"`
	ModeratedAt *time.Time `json:"moderated_at,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Stream Stream `gorm:"foreignKey:StreamID" json:"-"`
}

// StreamQuality represents different quality levels for a stream
type StreamQuality struct {
	ID          uint   `gorm:"primaryKey" json:"id"`
	StreamID    string `gorm:"not null;index" json:"stream_id"`
	Quality     string `gorm:"not null" json:"quality"` // 720p, 480p, 360p, etc.
	Width       int    `gorm:"not null" json:"width"`
	Height      int    `gorm:"not null" json:"height"`
	Bitrate     int    `gorm:"not null" json:"bitrate"`
	Framerate   int    `gorm:"not null" json:"framerate"`
	PlaylistURL string `json:"playlist_url"`
	IsActive    bool   `gorm:"default:true" json:"is_active"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Stream Stream `gorm:"foreignKey:StreamID" json:"-"`
}

// StreamEvent represents events that occur during a stream
type StreamEvent struct {
	ID        uint      `gorm:"primaryKey" json:"id"`
	StreamID  string    `gorm:"not null;index" json:"stream_id"`
	EventType string    `gorm:"not null" json:"event_type"` // started, ended, quality_changed, viewer_peak, etc.
	EventData string    `json:"event_data"`                 // JSON data
	UserID    string    `gorm:"index" json:"user_id,omitempty"`
	Timestamp time.Time `gorm:"not null" json:"timestamp"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Stream Stream `gorm:"foreignKey:StreamID" json:"-"`
}

// User represents a platform user
type User struct {
	ID          string     `gorm:"primaryKey" json:"id"`
	Username    string     `gorm:"unique;not null" json:"username"`
	Email       string     `gorm:"unique;not null" json:"email"`
	DisplayName string     `json:"display_name"`
	AvatarURL   string     `json:"avatar_url"`
	Role        string     `gorm:"not null;default:'viewer'" json:"role"` // viewer, streamer, moderator, admin
	IsActive    bool       `gorm:"default:true" json:"is_active"`
	IsBanned    bool       `gorm:"default:false" json:"is_banned"`
	BannedAt    *time.Time `json:"banned_at,omitempty"`
	BannedBy    string     `json:"banned_by,omitempty"`
	BanReason   string     `json:"ban_reason,omitempty"`

	// Streamer-specific fields
	StreamKey      string `gorm:"unique" json:"stream_key,omitempty"`
	IsLive         bool   `gorm:"default:false" json:"is_live"`
	FollowersCount int    `gorm:"default:0" json:"followers_count"`
	TotalViews     int64  `gorm:"default:0" json:"total_views"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Streams        []Stream        `gorm:"foreignKey:CreatorID" json:"-"`
	ViewerSessions []ViewerSession `gorm:"foreignKey:UserID" json:"-"`
	ChatMessages   []ChatMessage   `gorm:"foreignKey:UserID" json:"-"`
}

// Follow represents user follows
type Follow struct {
	ID         uint   `gorm:"primaryKey" json:"id"`
	FollowerID string `gorm:"not null;index" json:"follower_id"`
	FolloweeID string `gorm:"not null;index" json:"followee_id"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Unique constraint
	// gorm:"uniqueIndex:idx_follower_followee"
}

// StreamReport represents user reports on streams
type StreamReport struct {
	ID         uint       `gorm:"primaryKey" json:"id"`
	StreamID   string     `gorm:"not null;index" json:"stream_id"`
	ReporterID string     `gorm:"not null;index" json:"reporter_id"`
	Reason     string     `gorm:"not null" json:"reason"`
	Details    string     `json:"details"`
	Status     string     `gorm:"not null;default:'pending'" json:"status"` // pending, reviewed, resolved
	ReviewedBy string     `json:"reviewed_by,omitempty"`
	ReviewedAt *time.Time `json:"reviewed_at,omitempty"`

	CreatedAt time.Time      `json:"created_at"`
	UpdatedAt time.Time      `json:"updated_at"`
	DeletedAt gorm.DeletedAt `gorm:"index" json:"-"`

	// Relationships
	Stream Stream `gorm:"foreignKey:StreamID" json:"-"`
}
