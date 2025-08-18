package crawler

import (
	"fmt"
	"time"

	"search-crawler/internal/config"

	"github.com/gocolly/colly/v2"
	"github.com/gocolly/colly/v2/debug"
	"github.com/gocolly/colly/v2/extensions"
	"github.com/microcosm-cc/bluemonday"
)

type Service struct {
	config    *config.Config
	sanitizer *bluemonday.Policy
}

func New(cfg *config.Config) *Service {
	sanitizer := bluemonday.StrictPolicy()

	return &Service{
		config:    cfg,
		sanitizer: sanitizer,
	}
}

// CrawlURL crawls a single URL and returns basic information
func (s *Service) CrawlURL(url string) (*CrawlResult, error) {
	// Create crawler instance
	crawler := s.createCrawler()

	result := &CrawlResult{
		URL: url,
	}

	crawler.OnHTML("html", func(e *colly.HTMLElement) {
		// Extract title
		result.Title = e.ChildText("title")

		// Extract meta description
		result.Description = e.ChildAttr("meta[name=description]", "content")

		// Extract content
		result.Content = e.Text
		result.ContentLength = len(result.Content)
	})

	crawler.OnResponse(func(r *colly.Response) {
		result.StatusCode = r.StatusCode
		result.ContentType = r.Headers.Get("Content-Type")
	})

	// Visit the URL
	err := crawler.Visit(url)
	if err != nil {
		return nil, fmt.Errorf("failed to crawl URL %s: %w", url, err)
	}

	return result, nil
}

type CrawlResult struct {
	URL           string
	Title         string
	Description   string
	Content       string
	ContentLength int
	StatusCode    int
	ContentType   string
}

func (s *Service) createCrawler() *colly.Collector {
	crawler := colly.NewCollector(
		colly.Debugger(&debug.LogDebugger{}),
		colly.UserAgent("Suuupra Search Crawler 1.0"),
	)

	// Set request timeout
	crawler.SetRequestTimeout(30 * time.Second)

	// Use extensions
	extensions.Referer(crawler)
	extensions.RandomUserAgent(crawler)

	// Set crawl delay
	crawler.Limit(&colly.LimitRule{
		DomainGlob:  "*",
		Parallelism: 1,
		Delay:       1 * time.Second,
	})

	return crawler
}
