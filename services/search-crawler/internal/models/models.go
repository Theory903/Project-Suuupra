package models

import (
	"time"
	"gorm.io/gorm"
)

// CrawlJob represents a crawl job in the system
type CrawlJob struct {
	ID          uint      `gorm:"primaryKey" json:"id"`
	URL         string    `gorm:"uniqueIndex;not null" json:"url"`
	Domain      string    `gorm:"index;not null" json:"domain"`
	Status      string    `gorm:"index;not null;default:'pending'" json:"status"` // pending, processing, completed, failed
	Priority    int       `gorm:"index;default:0" json:"priority"`
	Depth       int       `gorm:"default:0" json:"depth"`
	Retries     int       `gorm:"default:0" json:"retries"`
	LastError   string    `json:"last_error,omitempty"`
	ScheduledAt time.Time `gorm:"index" json:"scheduled_at"`
	StartedAt   *time.Time `json:"started_at,omitempty"`
	CompletedAt *time.Time `json:"completed_at,omitempty"`
	CreatedAt   time.Time `json:"created_at"`
	UpdatedAt   time.Time `json:"updated_at"`
}

// CrawlResult represents the result of a crawl operation
type CrawlResult struct {
	ID              uint      `gorm:"primaryKey" json:"id"`
	CrawlJobID      uint      `gorm:"index;not null" json:"crawl_job_id"`
	CrawlJob        CrawlJob  `gorm:"foreignKey:CrawlJobID" json:"crawl_job,omitempty"`
	URL             string    `gorm:"index;not null" json:"url"`
	Title           string    `json:"title"`
	Content         string    `gorm:"type:text" json:"content"`
	CleanContent    string    `gorm:"type:text" json:"clean_content"`
	Summary         string    `gorm:"type:text" json:"summary"`
	Keywords        string    `json:"keywords"`
	Language        string    `gorm:"index" json:"language"`
	ContentType     string    `gorm:"index" json:"content_type"`
	ContentLength   int       `json:"content_length"`
	StatusCode      int       `gorm:"index" json:"status_code"`
	Headers         string    `gorm:"type:json" json:"headers"`
	OutboundLinks   int       `json:"outbound_links"`
	InboundLinks    int       `json:"inbound_links"`
	PageRank        float64   `gorm:"index;default:0" json:"page_rank"`
	QualityScore    float64   `gorm:"index;default:0" json:"quality_score"`
	SimHash         string    `gorm:"index" json:"sim_hash"`
	IndexedAt       *time.Time `gorm:"index" json:"indexed_at,omitempty"`
	CreatedAt       time.Time `json:"created_at"`
	UpdatedAt       time.Time `json:"updated_at"`
}

// SearchQuery represents a search query log
type SearchQuery struct {
	ID           uint      `gorm:"primaryKey" json:"id"`
	Query        string    `gorm:"index;not null" json:"query"`
	UserID       string    `gorm:"index" json:"user_id,omitempty"`
	SessionID    string    `gorm:"index" json:"session_id"`
	IPAddress    string    `gorm:"index" json:"ip_address"`
	UserAgent    string    `json:"user_agent"`
	ResultsCount int       `json:"results_count"`
	ClickedURL   string    `json:"clicked_url,omitempty"`
	ResponseTime int       `json:"response_time_ms"`
	CreatedAt    time.Time `gorm:"index" json:"created_at"`
}

// Domain represents domain-specific crawl settings
type Domain struct {
	ID                uint      `gorm:"primaryKey" json:"id"`
	Name              string    `gorm:"uniqueIndex;not null" json:"name"`
	Status            string    `gorm:"index;default:'active'" json:"status"` // active, blocked, paused
	CrawlDelay        int       `gorm:"default:1" json:"crawl_delay"`
	MaxPages          int       `gorm:"default:10000" json:"max_pages"`
	MaxDepth          int       `gorm:"default:10" json:"max_depth"`
	RespectRobotsTxt  bool      `gorm:"default:true" json:"respect_robots_txt"`
	RobotsTxt         string    `gorm:"type:text" json:"robots_txt,omitempty"`
	SitemapURL        string    `json:"sitemap_url,omitempty"`
	LastCrawledAt     *time.Time `gorm:"index" json:"last_crawled_at,omitempty"`
	PagesCrawled      int       `gorm:"default:0" json:"pages_crawled"`
	TotalPages        int       `gorm:"default:0" json:"total_pages"`
	AverageQuality    float64   `gorm:"default:0" json:"average_quality"`
	CreatedAt         time.Time `json:"created_at"`
	UpdatedAt         time.Time `json:"updated_at"`
}

// CrawlStats represents crawling statistics
type CrawlStats struct {
	ID                 uint      `gorm:"primaryKey" json:"id"`
	Date               time.Time `gorm:"uniqueIndex;not null" json:"date"`
	TotalJobs          int       `gorm:"default:0" json:"total_jobs"`
	CompletedJobs      int       `gorm:"default:0" json:"completed_jobs"`
	FailedJobs         int       `gorm:"default:0" json:"failed_jobs"`
	PagesIndexed       int       `gorm:"default:0" json:"pages_indexed"`
	AverageResponseTime int      `gorm:"default:0" json:"average_response_time"`
	TotalDataSize      int64     `gorm:"default:0" json:"total_data_size"`
	UniqueDomainsCount int       `gorm:"default:0" json:"unique_domains_count"`
	DuplicatesFound    int       `gorm:"default:0" json:"duplicates_found"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

// SearchStats represents search statistics
type SearchStats struct {
	ID               uint      `gorm:"primaryKey" json:"id"`
	Date             time.Time `gorm:"uniqueIndex;not null" json:"date"`
	TotalQueries     int       `gorm:"default:0" json:"total_queries"`
	UniqueQueries    int       `gorm:"default:0" json:"unique_queries"`
	AverageResults   int       `gorm:"default:0" json:"average_results"`
	AverageLatency   int       `gorm:"default:0" json:"average_latency"`
	ClickThroughRate float64   `gorm:"default:0" json:"click_through_rate"`
	TopQueries       string    `gorm:"type:json" json:"top_queries"`
	CreatedAt        time.Time `json:"created_at"`
	UpdatedAt        time.Time `json:"updated_at"`
}

// BeforeCreate hooks
func (cj *CrawlJob) BeforeCreate(tx *gorm.DB) error {
	if cj.ScheduledAt.IsZero() {
		cj.ScheduledAt = time.Now()
	}
	return nil
}

func (cs *CrawlStats) BeforeCreate(tx *gorm.DB) error {
	if cs.Date.IsZero() {
		cs.Date = time.Now().Truncate(24 * time.Hour)
	}
	return nil
}

func (ss *SearchStats) BeforeCreate(tx *gorm.DB) error {
	if ss.Date.IsZero() {
		ss.Date = time.Now().Truncate(24 * time.Hour)
	}
	return nil
}
