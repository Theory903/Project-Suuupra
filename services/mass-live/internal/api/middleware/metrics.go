package middleware

import (
	"strconv"
	"time"

	"github.com/gin-gonic/gin"
	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promauto"
)

var (
	httpRequestsTotal = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "endpoint", "status_code"},
	)

	httpRequestDuration = promauto.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Duration of HTTP requests in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "endpoint", "status_code"},
	)

	activeConnections = promauto.NewGauge(
		prometheus.GaugeOpts{
			Name: "active_connections",
			Help: "Number of active connections",
		},
	)

	streamMetrics = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "active_streams",
			Help: "Number of active streams",
		},
		[]string{"quality"},
	)

	viewerMetrics = promauto.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "active_viewers",
			Help: "Number of active viewers",
		},
		[]string{"stream_id"},
	)

	bandwidthMetrics = promauto.NewCounterVec(
		prometheus.CounterOpts{
			Name: "bandwidth_bytes_total",
			Help: "Total bandwidth usage in bytes",
		},
		[]string{"direction", "stream_id"},
	)
)

func MetricsMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		start := time.Now()

		// Increment active connections
		activeConnections.Inc()
		defer activeConnections.Dec()

		// Process request
		c.Next()

		// Record metrics
		duration := time.Since(start).Seconds()
		statusCode := strconv.Itoa(c.Writer.Status())
		endpoint := c.FullPath()
		method := c.Request.Method

		httpRequestsTotal.WithLabelValues(method, endpoint, statusCode).Inc()
		httpRequestDuration.WithLabelValues(method, endpoint, statusCode).Observe(duration)
	}
}

// StreamMetrics provides functions to update streaming-specific metrics
type StreamMetricsCollector struct{}

func NewStreamMetricsCollector() *StreamMetricsCollector {
	return &StreamMetricsCollector{}
}

func (s *StreamMetricsCollector) IncrementActiveStreams(quality string) {
	streamMetrics.WithLabelValues(quality).Inc()
}

func (s *StreamMetricsCollector) DecrementActiveStreams(quality string) {
	streamMetrics.WithLabelValues(quality).Dec()
}

func (s *StreamMetricsCollector) SetActiveViewers(streamID string, count int) {
	viewerMetrics.WithLabelValues(streamID).Set(float64(count))
}

func (s *StreamMetricsCollector) IncrementBandwidth(direction, streamID string, bytes int64) {
	bandwidthMetrics.WithLabelValues(direction, streamID).Add(float64(bytes))
}

func (s *StreamMetricsCollector) RemoveStreamMetrics(streamID string) {
	viewerMetrics.DeleteLabelValues(streamID)
	bandwidthMetrics.DeleteLabelValues("inbound", streamID)
	bandwidthMetrics.DeleteLabelValues("outbound", streamID)
}
