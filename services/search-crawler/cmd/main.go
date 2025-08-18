package main

import (
	"log"
	"net/http"
	"os"
	"time"

	"github.com/gin-gonic/gin"
)

type HealthResponse struct {
	Status    string    `json:"status"`
	Service   string    `json:"service"`
	Timestamp time.Time `json:"timestamp"`
	Version   string    `json:"version"`
}

type ServiceInfo struct {
	Service  string   `json:"service"`
	Version  string   `json:"version"`
	Status   string   `json:"status"`
	Features []string `json:"features"`
}

func main() {
	// Set Gin mode
	gin.SetMode(gin.ReleaseMode)

	// Create router
	r := gin.Default()

	// Health check endpoint
	r.GET("/health", func(c *gin.Context) {
		response := HealthResponse{
			Status:    "healthy",
			Service:   "search-crawler",
			Timestamp: time.Now(),
			Version:   "1.0.0",
		}
		c.JSON(http.StatusOK, response)
	})

	// Metrics endpoint
	r.GET("/metrics", func(c *gin.Context) {
		metrics := `# HELP search_crawler_requests_total Total requests to search crawler
# TYPE search_crawler_requests_total counter
search_crawler_requests_total 1

# HELP search_crawler_indexed_documents Total indexed documents
# TYPE search_crawler_indexed_documents gauge
search_crawler_indexed_documents 0
`
		c.String(http.StatusOK, metrics)
	})

	// Root endpoint
	r.GET("/", func(c *gin.Context) {
		info := ServiceInfo{
			Service:  "Suuupra Search Crawler Service",
			Version:  "1.0.0",
			Status:   "operational",
			Features: []string{"elasticsearch_indexing", "content_crawling", "search_api"},
		}
		c.JSON(http.StatusOK, info)
	})

	// Search endpoint
	r.GET("/search", func(c *gin.Context) {
		query := c.Query("q")
		if query == "" {
			c.JSON(http.StatusBadRequest, gin.H{"error": "Query parameter 'q' is required"})
			return
		}

		// Placeholder search results
		results := gin.H{
			"query": query,
			"results": []gin.H{
				{"id": "doc_1", "title": "Sample Document 1", "score": 0.95},
				{"id": "doc_2", "title": "Sample Document 2", "score": 0.87},
			},
			"total":        2,
			"search_time":  "50ms",
			"generated_at": time.Now(),
		}

		c.JSON(http.StatusOK, results)
	})

	// Get port from environment
	port := os.Getenv("PORT")
	if port == "" {
		port = "8096"
	}

	log.Printf("Starting Search Crawler Service on port %s", port)

	// Start server
	if err := r.Run(":" + port); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
