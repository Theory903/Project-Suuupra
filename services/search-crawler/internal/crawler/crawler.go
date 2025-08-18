package crawler

import (
	"context"
	"crypto/md5"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/gocolly/colly/v2"
	"github.com/gocolly/colly/v2/debug"
	"github.com/gocolly/colly/v2/extensions"
	"github.com/go-shiori/go-readability"
	"github.com/microcosm-cc/bluemonday"
	"github.com/suuupra/search-crawler/internal/config"
	"github.com/suuupra/search-crawler/internal/database"
	"github.com/suuupra/search-crawler/internal/elasticsearch"
	"github.com/suuupra/search-crawler/internal/models"
	"github.com/suuupra/search-crawler/internal/queue"
	"github.com/suuupra/search-crawler/pkg/logger"
	"github.com/suuupra/search-crawler/pkg/metrics"
	"github.com/texttheater/golang-levenshtein/levenshtein"
	"gorm.io/gorm"
)

type Service struct {
	config    *config.Config
	db        *database.Database
	es        *elasticsearch.Client
	queue     *queue.Client
	logger    logger.Logger
	sanitizer *bluemonday.Policy
}

func New(cfg *config.Config, db *database.Database, es *elasticsearch.Client, queue *queue.Client, logger logger.Logger) *Service {
	sanitizer := bluemonday.StrictPolicy()
	
	return &Service{
		config:    cfg,
		db:        db,
		es:        es,
		queue:     queue,
		logger:    logger,
		sanitizer: sanitizer,
	}
}

func (s *Service) StartWorkers(ctx context.Context) {
	s.logger.Info("Starting crawler workers", "count", s.config.MaxCrawlers)
	
	for i := 0; i < s.config.MaxCrawlers; i++ {
		go s.worker(ctx, i)
	}
}

func (s *Service) worker(ctx context.Context, workerID int) {
	s.logger.Info("Starting crawler worker", "worker_id", workerID)
	
	for {
		select {
		case <-ctx.Done():
			s.logger.Info("Stopping crawler worker", "worker_id", workerID)
			return
		default:
			job, err := s.queue.PopCrawlJob(ctx)
			if err != nil {
				if err != queue.ErrNoJobs {
					s.logger.Error("Failed to pop crawl job", "worker_id", workerID, "error", err)
				}
				time.Sleep(5 * time.Second)
				continue
			}
			
			if job != nil {
				s.processCrawlJob(ctx, job, workerID)
			}
		}
	}
}

func (s *Service) processCrawlJob(ctx context.Context, job *models.CrawlJob, workerID int) {
	startTime := time.Now()
	metrics.CrawlJobsProcessed.WithLabelValues("processing").Inc()
	
	s.logger.Info("Processing crawl job", 
		"worker_id", workerID, 
		"job_id", job.ID, 
		"url", job.URL,
		"depth", job.Depth,
		"retries", job.Retries)
	
	// Update job status to processing
	job.Status = "processing"
	job.StartedAt = &startTime
	if err := s.db.DB.Save(job).Error; err != nil {
		s.logger.Error("Failed to update job status", "job_id", job.ID, "error", err)
		return
	}
	
	// Create crawler instance
	crawler := s.createCrawler(job)
	
	// Crawl the URL
	result, err := s.crawlURL(crawler, job)
	if err != nil {
		s.handleCrawlError(job, err)
		metrics.CrawlJobsProcessed.WithLabelValues("failed").Inc()
		return
	}
	
	// Save crawl result
	if err := s.saveCrawlResult(job, result); err != nil {
		s.logger.Error("Failed to save crawl result", "job_id", job.ID, "error", err)
		s.handleCrawlError(job, err)
		metrics.CrawlJobsProcessed.WithLabelValues("failed").Inc()
		return
	}
	
	// Index in Elasticsearch
	if err := s.indexContent(result); err != nil {
		s.logger.Error("Failed to index content", "job_id", job.ID, "error", err)
	}
	
	// Update job status to completed
	completedAt := time.Now()
	job.Status = "completed"
	job.CompletedAt = &completedAt
	if err := s.db.DB.Save(job).Error; err != nil {
		s.logger.Error("Failed to update job completion", "job_id", job.ID, "error", err)
	}
	
	duration := time.Since(startTime)
	metrics.CrawlJobsProcessed.WithLabelValues("completed").Inc()
	metrics.CrawlDuration.Observe(duration.Seconds())
	
	s.logger.Info("Completed crawl job", 
		"worker_id", workerID, 
		"job_id", job.ID, 
		"url", job.URL,
		"duration", duration,
		"content_length", result.ContentLength)
}

func (s *Service) createCrawler(job *models.CrawlJob) *colly.Collector {
	crawler := colly.NewCollector(
		colly.Debugger(&debug.LogDebugger{}),
		colly.UserAgent(s.config.UserAgent),
	)
	
	// Set request timeout
	crawler.SetRequestTimeout(time.Duration(s.config.RequestTimeout) * time.Second)
	
	// Respect robots.txt if enabled
	if s.config.RespectRobotsTxt {
		extensions.Referer(crawler)
		extensions.RandomUserAgent(crawler)
	}
	
	// Limit crawling to allowed domains
	if len(s.config.AllowedDomains) > 0 {
		crawler.AllowedDomains = s.config.AllowedDomains
	}
	
	// Block certain domains
	for _, domain := range s.config.BlockedDomains {
		crawler.DisallowedDomains = append(crawler.DisallowedDomains, domain)
	}
	
	// Set crawl delay
	crawler.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Parallelism: 1,
		Delay:       time.Duration(s.config.CrawlDelay) * time.Second,
	})
	
	return crawler
}

func (s *Service) crawlURL(crawler *colly.Collector, job *models.CrawlJob) (*models.CrawlResult, error) {
	result := &models.CrawlResult{
		CrawlJobID: job.ID,
		URL:        job.URL,
	}
	
	crawler.OnHTML("html", func(e *colly.HTMLElement) {
		// Extract title
		result.Title = e.ChildText("title")
		
		// Extract meta description
		description := e.ChildAttr("meta[name=description]", "content")
		
		// Extract content using readability
		doc := e.DOM.Parent()
		htmlStr, _ := doc.Html()
		
		article, err := readability.FromReader(strings.NewReader(htmlStr), nil)
		if err == nil {
			result.Content = article.TextContent
			result.CleanContent = s.sanitizer.Sanitize(article.Content)
			result.Summary = s.generateSummary(article.TextContent, description)
		}
		
		// Extract keywords from meta tags
		keywords := e.ChildAttr("meta[name=keywords]", "content")
		result.Keywords = keywords
		
		// Detect language
		lang := e.ChildAttr("html", "lang")
		if lang == "" {
			lang = s.detectLanguage(result.Content)
		}
		result.Language = lang
		
		// Count outbound links
		result.OutboundLinks = len(e.ChildAttrs("a[href]", "href"))
		
		// Calculate content metrics
		result.ContentLength = len(result.Content)
		result.QualityScore = s.calculateQualityScore(result)
		result.SimHash = s.calculateSimHash(result.CleanContent)
	})
	
	crawler.OnResponse(func(r *colly.Response) {
		result.StatusCode = r.StatusCode
		result.ContentType = r.Headers.Get("Content-Type")
		
		// Store important headers as JSON
		headers := map[string]string{
			"content-type":     r.Headers.Get("Content-Type"),
			"content-length":   r.Headers.Get("Content-Length"),
			"last-modified":    r.Headers.Get("Last-Modified"),
			"server":           r.Headers.Get("Server"),
		}
		result.Headers = fmt.Sprintf("%+v", headers)
	})
	
	crawler.OnError(func(r *colly.Response, err error) {
		result.StatusCode = r.StatusCode
		s.logger.Error("Crawler error", "url", job.URL, "error", err)
	})
	
	// Visit the URL
	err := crawler.Visit(job.URL)
	if err != nil {
		return nil, fmt.Errorf("failed to crawl URL %s: %w", job.URL, err)
	}
	
	// Validate content
	if result.ContentLength < s.config.MinContentLength {
		return nil, fmt.Errorf("content too short: %d bytes", result.ContentLength)
	}
	
	if result.ContentLength > s.config.MaxContentLength {
		result.Content = result.Content[:s.config.MaxContentLength]
		result.ContentLength = s.config.MaxContentLength
	}
	
	return result, nil
}

func (s *Service) saveCrawlResult(job *models.CrawlJob, result *models.CrawlResult) error {
	// Check for duplicates using SimHash
	var existingResult models.CrawlResult
	err := s.db.DB.Where("sim_hash = ? AND url != ?", result.SimHash, result.URL).First(&existingResult).Error
	if err == nil {
		s.logger.Info("Duplicate content detected", 
			"url", result.URL, 
			"duplicate_of", existingResult.URL,
			"sim_hash", result.SimHash)
		
		// Still save but mark as duplicate
		result.QualityScore *= 0.5 // Reduce quality score for duplicates
	}
	
	return s.db.DB.Create(result).Error
}

func (s *Service) indexContent(result *models.CrawlResult) error {
	doc := map[string]interface{}{
		"url":           result.URL,
		"title":         result.Title,
		"content":       result.CleanContent,
		"summary":       result.Summary,
		"keywords":      result.Keywords,
		"language":      result.Language,
		"content_type":  result.ContentType,
		"quality_score": result.QualityScore,
		"page_rank":     result.PageRank,
		"indexed_at":    time.Now(),
		"domain":        s.extractDomain(result.URL),
	}
	
	return s.es.IndexDocument(s.config.IndexName, fmt.Sprintf("%d", result.ID), doc)
}

func (s *Service) handleCrawlError(job *models.CrawlJob, err error) {
	job.Retries++
	job.LastError = err.Error()
	
	if job.Retries >= s.config.MaxRetries {
		job.Status = "failed"
		completedAt := time.Now()
		job.CompletedAt = &completedAt
	} else {
		job.Status = "pending"
		// Reschedule with exponential backoff
		job.ScheduledAt = time.Now().Add(time.Duration(job.Retries*job.Retries) * time.Minute)
	}
	
	s.db.DB.Save(job)
	s.logger.Error("Crawl job error", 
		"job_id", job.ID, 
		"url", job.URL, 
		"retries", job.Retries, 
		"error", err)
}

func (s *Service) generateSummary(content, description string) string {
	if description != "" && len(description) > 50 {
		return description
	}
	
	// Simple extractive summary - take first few sentences
	sentences := strings.Split(content, ".")
	summary := ""
	for i, sentence := range sentences {
		if i >= 3 || len(summary) > 300 {
			break
		}
		summary += strings.TrimSpace(sentence) + ". "
	}
	
	return strings.TrimSpace(summary)
}

func (s *Service) calculateQualityScore(result *models.CrawlResult) float64 {
	score := 0.0
	
	// Title quality
	if result.Title != "" && len(result.Title) > 10 {
		score += 0.2
	}
	
	// Content length
	if result.ContentLength > 500 {
		score += 0.3
	}
	if result.ContentLength > 2000 {
		score += 0.2
	}
	
	// Outbound links (indicates rich content)
	if result.OutboundLinks > 0 {
		score += 0.1
	}
	if result.OutboundLinks > 5 {
		score += 0.1
	}
	
	// Keywords present
	if result.Keywords != "" {
		score += 0.1
	}
	
	return score
}

func (s *Service) calculateSimHash(content string) string {
	// Simple hash-based approach for duplicate detection
	hash := md5.Sum([]byte(strings.ToLower(strings.TrimSpace(content))))
	return fmt.Sprintf("%x", hash)
}

func (s *Service) detectLanguage(content string) string {
	// Simple language detection based on common words
	// In production, use a proper language detection library
	content = strings.ToLower(content)
	
	englishWords := []string{"the", "and", "or", "but", "in", "on", "at", "to", "for", "of", "with", "by"}
	spanishWords := []string{"el", "la", "y", "o", "pero", "en", "para", "de", "con", "por"}
	frenchWords := []string{"le", "la", "et", "ou", "mais", "dans", "sur", "pour", "de", "avec"}
	
	englishCount := s.countWords(content, englishWords)
	spanishCount := s.countWords(content, spanishWords)
	frenchCount := s.countWords(content, frenchWords)
	
	if englishCount >= spanishCount && englishCount >= frenchCount {
		return "en"
	} else if spanishCount >= frenchCount {
		return "es"
	} else {
		return "fr"
	}
}

func (s *Service) countWords(content string, words []string) int {
	count := 0
	for _, word := range words {
		count += strings.Count(content, " "+word+" ")
	}
	return count
}

func (s *Service) extractDomain(urlStr string) string {
	u, err := url.Parse(urlStr)
	if err != nil {
		return ""
	}
	return u.Host
}

// AddCrawlJob adds a new URL to be crawled
func (s *Service) AddCrawlJob(ctx context.Context, urlStr string, priority int, depth int) error {
	// Validate URL
	u, err := url.Parse(urlStr)
	if err != nil {
		return fmt.Errorf("invalid URL: %w", err)
	}
	
	domain := u.Host
	
	// Check if URL already exists
	var existingJob models.CrawlJob
	err = s.db.DB.Where("url = ?", urlStr).First(&existingJob).Error
	if err == nil {
		return fmt.Errorf("URL already scheduled for crawling")
	}
	
	// Create new crawl job
	job := &models.CrawlJob{
		URL:      urlStr,
		Domain:   domain,
		Status:   "pending",
		Priority: priority,
		Depth:    depth,
	}
	
	if err := s.db.DB.Create(job).Error; err != nil {
		return fmt.Errorf("failed to create crawl job: %w", err)
	}
	
	// Add to queue
	return s.queue.PushCrawlJob(ctx, job)
}
