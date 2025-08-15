package metrics

import (
	"net/http"

	"github.com/prometheus/client_golang/prometheus"
	"github.com/prometheus/client_golang/prometheus/promhttp"
)

var (
	// HTTP request metrics
	HTTPRequestsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "http_requests_total",
			Help: "Total number of HTTP requests",
		},
		[]string{"method", "path", "status"},
	)

	HTTPRequestDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "http_request_duration_seconds",
			Help:    "Duration of HTTP requests in seconds",
			Buckets: prometheus.DefBuckets,
		},
		[]string{"method", "path"},
	)

	// Payment specific metrics
	PaymentIntentsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "payment_intents_total",
			Help: "Total number of payment intents created",
		},
		[]string{"status"},
	)

	PaymentsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "payments_total",
			Help: "Total number of payments processed",
		},
		[]string{"status", "payment_method"},
	)

	PaymentDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "payment_duration_seconds",
			Help:    "Duration of payment processing in seconds",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10, 30},
		},
		[]string{"payment_method"},
	)

	RefundsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "refunds_total",
			Help: "Total number of refunds processed",
		},
		[]string{"status"},
	)

	// Risk assessment metrics
	RiskAssessmentsTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "risk_assessments_total",
			Help: "Total number of risk assessments performed",
		},
		[]string{"decision", "risk_level"},
	)

	RiskScoreHistogram = prometheus.NewHistogram(
		prometheus.HistogramOpts{
			Name:    "risk_score",
			Help:    "Distribution of risk scores",
			Buckets: []float64{0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1.0},
		},
	)

	// Webhook metrics
	WebhookDeliveriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "webhook_deliveries_total",
			Help: "Total number of webhook deliveries attempted",
		},
		[]string{"status", "event_type"},
	)

	WebhookDeliveryDuration = prometheus.NewHistogramVec(
		prometheus.HistogramOpts{
			Name:    "webhook_delivery_duration_seconds",
			Help:    "Duration of webhook delivery attempts in seconds",
			Buckets: []float64{0.1, 0.5, 1, 2, 5, 10},
		},
		[]string{"status"},
	)

	// Idempotency metrics
	IdempotencyHitsTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "idempotency_hits_total",
			Help: "Total number of idempotency key hits",
		},
	)

	IdempotencyMissesTotal = prometheus.NewCounter(
		prometheus.CounterOpts{
			Name: "idempotency_misses_total",
			Help: "Total number of idempotency key misses",
		},
	)

	// Ledger metrics
	LedgerEntriesTotal = prometheus.NewCounterVec(
		prometheus.CounterOpts{
			Name: "ledger_entries_total",
			Help: "Total number of ledger entries created",
		},
		[]string{"account_type", "reference_type"},
	)

	LedgerBalance = prometheus.NewGaugeVec(
		prometheus.GaugeOpts{
			Name: "ledger_account_balance",
			Help: "Current balance of ledger accounts",
		},
		[]string{"account_id", "account_type", "currency"},
	)
)

// InitMetrics initializes and registers all metrics
func InitMetrics() {
	prometheus.MustRegister(
		HTTPRequestsTotal,
		HTTPRequestDuration,
		PaymentIntentsTotal,
		PaymentsTotal,
		PaymentDuration,
		RefundsTotal,
		RiskAssessmentsTotal,
		RiskScoreHistogram,
		WebhookDeliveriesTotal,
		WebhookDeliveryDuration,
		IdempotencyHitsTotal,
		IdempotencyMissesTotal,
		LedgerEntriesTotal,
		LedgerBalance,
	)
}

// Handler returns the Prometheus metrics handler
func Handler() http.Handler {
	return promhttp.Handler()
}