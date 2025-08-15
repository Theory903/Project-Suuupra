package services

import (
	"github.com/redis/go-redis/v9"
	"github.com/sirupsen/logrus"
	"github.com/suuupra/payments/internal/config"
	"github.com/suuupra/payments/internal/repository"
)

// Services contains all service dependencies
type Services struct {
	Payment      *PaymentService
	Refund       *RefundService
	Ledger       *LedgerService
	Risk         *RiskService
	Webhook      *WebhookService
	Idempotency  *IdempotencyService
	UPIClient    *UPIClient
}

// Dependencies contains all dependencies needed to create services
type Dependencies struct {
	Repos     *repository.Repositories
	Redis     *redis.Client
	UPIClient *UPIClient
	Logger    *logrus.Logger
	Config    *config.Config
}

// NewServices creates all services with their dependencies
func NewServices(deps Dependencies) *Services {
	// Create individual services
	ledgerService := NewLedgerService(deps.Repos.DB, deps.Logger)
	idempotencyService := NewIdempotencyService(deps.Repos.DB, deps.Logger, deps.Config.IdempotencyTTLHours)
	riskService := NewRiskService(deps.Repos.DB, deps.Logger)
	webhookService := NewWebhookService(
		deps.Repos.DB,
		deps.Logger,
		deps.Config.WebhookSigningSecret,
		deps.Config.MaxWebhookRetries,
		deps.Config.WebhookTimeoutSeconds,
	)

	paymentService := NewPaymentService(
		deps.Repos.DB,
		deps.Logger,
		deps.UPIClient,
		ledgerService,
		riskService,
		webhookService,
	)

	refundService := NewRefundService(
		deps.Repos.DB,
		deps.Logger,
		deps.UPIClient,
		ledgerService,
		webhookService,
	)

	// Start webhook service
	webhookService.Start()

	return &Services{
		Payment:     paymentService,
		Refund:      refundService,
		Ledger:      ledgerService,
		Risk:        riskService,
		Webhook:     webhookService,
		Idempotency: idempotencyService,
		UPIClient:   deps.UPIClient,
	}
}