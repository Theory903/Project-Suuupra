package http

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/mux"
	"github.com/sirupsen/logrus"
	"google.golang.org/protobuf/types/known/timestamppb"

	"upi-core/internal/domain/service"
	pb "upi-core/pkg/pb"
)

type HTTPServer struct {
	transactionService *service.TransactionService
	logger             *logrus.Logger
	server             *http.Server
}

type TransactionRequest struct {
	TransactionID string            `json:"transactionId"`
	PayerVPA      string            `json:"payerVpa"`
	PayeeVPA      string            `json:"payeeVpa"`
	AmountPaisa   int64             `json:"amountPaisa"`
	Currency      string            `json:"currency"`
	Type          string            `json:"type"`
	Description   string            `json:"description"`
	Reference     string            `json:"reference"`
	Metadata      map[string]string `json:"metadata"`
}

type TransactionResponse struct {
	TransactionID string    `json:"transactionId"`
	RRN           string    `json:"rrn"`
	Status        string    `json:"status"`
	ErrorCode     string    `json:"errorCode,omitempty"`
	ErrorMessage  string    `json:"errorMessage,omitempty"`
	PayerBankCode string    `json:"payerBankCode,omitempty"`
	PayeeBankCode string    `json:"payeeBankCode,omitempty"`
	ProcessedAt   time.Time `json:"processedAt"`
	Fees          *Fees     `json:"fees,omitempty"`
	SettlementID  string    `json:"settlementId,omitempty"`
}

type Fees struct {
	SwitchFeePaisa int64 `json:"switchFeePaisa"`
	BankFeePaisa   int64 `json:"bankFeePaisa"`
	TotalFeePaisa  int64 `json:"totalFeePaisa"`
}

// Payment Intent API Types (matching frontend expectations)
type PaymentIntentRequest struct {
	Amount      int    `json:"amount"`            // Amount in cents/paisa
	Currency    string `json:"currency"`          // Currency code
	Description string `json:"description"`       // Payment description
	OrderId     string `json:"orderId,omitempty"` // Optional order ID
}

type PaymentIntentResponse struct {
	ID           string `json:"id"`           // Payment intent ID
	Amount       int    `json:"amount"`       // Amount in cents/paisa
	Currency     string `json:"currency"`     // Currency code
	Status       string `json:"status"`       // Payment intent status
	ClientSecret string `json:"clientSecret"` // Client secret for payment
}

// Payment Processing API Types
type PaymentMethodDetails struct {
	CardNumber string `json:"cardNumber,omitempty"`
	Expiry     string `json:"expiry,omitempty"`
	CVC        string `json:"cvc,omitempty"`
}

type PaymentMethod struct {
	Type    string                `json:"type"`    // "card", "upi", etc.
	Details *PaymentMethodDetails `json:"details"` // Payment method details
}

type ProcessPaymentRequest struct {
	PaymentIntentId string         `json:"paymentIntentId"` // Payment intent ID to process
	PaymentMethod   *PaymentMethod `json:"paymentMethod"`   // Payment method details
}

type ProcessPaymentResponse struct {
	ID              string `json:"id"`              // Payment ID
	Status          string `json:"status"`          // Payment status
	PaymentIntentId string `json:"paymentIntentId"` // Associated payment intent
	TransactionId   string `json:"transactionId"`   // UPI transaction ID
}

func NewHTTPServer(transactionService *service.TransactionService, logger *logrus.Logger, port string) *HTTPServer {
	router := mux.NewRouter()

	server := &HTTPServer{
		transactionService: transactionService,
		logger:             logger,
	}

	// Middleware
	router.Use(server.loggingMiddleware)
	router.Use(server.corsMiddleware)

	// Routes
	router.HandleFunc("/health", server.healthCheck).Methods("GET")

	// Original UPI transaction routes
	router.HandleFunc("/upi/transactions", server.processTransaction).Methods("POST")
	router.HandleFunc("/upi/transactions/{transactionId}", server.getTransactionStatus).Methods("GET")

	// Payment API routes (matching frontend expectations)
	router.HandleFunc("/payments/api/v1/intents", server.createPaymentIntent).Methods("POST")
	router.HandleFunc("/payments/api/v1/payments", server.processPayment).Methods("POST")

	httpServer := &http.Server{
		Addr:         ":" + port,
		Handler:      router,
		ReadTimeout:  30 * time.Second,
		WriteTimeout: 30 * time.Second,
		IdleTimeout:  60 * time.Second,
	}

	server.server = httpServer

	return server
}

func (s *HTTPServer) Start() error {
	s.logger.Infof("Starting HTTP server on %s", s.server.Addr)
	return s.server.ListenAndServe()
}

func (s *HTTPServer) Stop(ctx context.Context) error {
	s.logger.Info("Stopping HTTP server")
	return s.server.Shutdown(ctx)
}

func (s *HTTPServer) loggingMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()

		s.logger.WithFields(logrus.Fields{
			"method":     r.Method,
			"url":        r.URL.Path,
			"user_agent": r.UserAgent(),
			"remote_ip":  r.RemoteAddr,
		}).Info("HTTP request started")

		next.ServeHTTP(w, r)

		s.logger.WithFields(logrus.Fields{
			"method":   r.Method,
			"url":      r.URL.Path,
			"duration": time.Since(start),
		}).Info("HTTP request completed")
	})
}

func (s *HTTPServer) corsMiddleware(next http.Handler) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func (s *HTTPServer) healthCheck(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"status":    "healthy",
		"timestamp": time.Now().UTC(),
		"service":   "upi-core",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *HTTPServer) processTransaction(w http.ResponseWriter, r *http.Request) {
	var req TransactionRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.logger.WithError(err).Error("Failed to decode transaction request")
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Convert HTTP request to gRPC request
	grpcReq := &pb.TransactionRequest{
		TransactionId: req.TransactionID,
		PayerVpa:      req.PayerVPA,
		PayeeVpa:      req.PayeeVPA,
		AmountPaisa:   req.AmountPaisa,
		Currency:      req.Currency,
		Type:          s.parseTransactionType(req.Type),
		Description:   req.Description,
		Reference:     req.Reference,
		InitiatedAt:   timestamppb.Now(),
		Metadata:      req.Metadata,
	}

	// Process transaction
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	grpcResp, err := s.transactionService.ProcessTransaction(ctx, grpcReq)
	if err != nil {
		s.logger.WithError(err).Error("Failed to process transaction")
		http.Error(w, "Transaction processing failed", http.StatusInternalServerError)
		return
	}

	// Convert gRPC response to HTTP response
	httpResp := &TransactionResponse{
		TransactionID: grpcResp.TransactionId,
		RRN:           grpcResp.Rrn,
		Status:        grpcResp.Status.String(),
		ErrorCode:     grpcResp.ErrorCode,
		ErrorMessage:  grpcResp.ErrorMessage,
		PayerBankCode: grpcResp.PayerBankCode,
		PayeeBankCode: grpcResp.PayeeBankCode,
		ProcessedAt:   grpcResp.ProcessedAt.AsTime(),
		SettlementID:  grpcResp.SettlementId,
	}

	if grpcResp.Fees != nil {
		httpResp.Fees = &Fees{
			SwitchFeePaisa: grpcResp.Fees.SwitchFeePaisa,
			BankFeePaisa:   grpcResp.Fees.BankFeePaisa,
			TotalFeePaisa:  grpcResp.Fees.TotalFeePaisa,
		}
	}

	w.Header().Set("Content-Type", "application/json")
	if grpcResp.Status == pb.TransactionStatus_TRANSACTION_STATUS_SUCCESS {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusBadRequest)
	}

	json.NewEncoder(w).Encode(httpResp)
}

func (s *HTTPServer) getTransactionStatus(w http.ResponseWriter, r *http.Request) {
	vars := mux.Vars(r)
	transactionID := vars["transactionId"]

	if transactionID == "" {
		http.Error(w, "Transaction ID is required", http.StatusBadRequest)
		return
	}

	// For now, return a mock response
	// In a real implementation, you'd query the database
	response := &TransactionResponse{
		TransactionID: transactionID,
		Status:        "SUCCESS",
		ProcessedAt:   time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func (s *HTTPServer) parseTransactionType(typeStr string) pb.TransactionType {
	switch typeStr {
	case "P2P":
		return pb.TransactionType_TRANSACTION_TYPE_P2P
	case "P2M":
		return pb.TransactionType_TRANSACTION_TYPE_P2M
	case "M2P":
		return pb.TransactionType_TRANSACTION_TYPE_M2P
	case "REFUND":
		return pb.TransactionType_TRANSACTION_TYPE_REFUND
	default:
		return pb.TransactionType_TRANSACTION_TYPE_UNSPECIFIED
	}
}

// Payment API Handlers

// createPaymentIntent creates a payment intent (similar to Stripe's payment intents)
func (s *HTTPServer) createPaymentIntent(w http.ResponseWriter, r *http.Request) {
	var req PaymentIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.logger.WithError(err).Error("Failed to decode payment intent request")
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.Amount <= 0 {
		http.Error(w, "Amount must be greater than 0", http.StatusBadRequest)
		return
	}

	if req.Currency == "" {
		req.Currency = "INR" // Default to INR
	}

	// Generate a payment intent ID
	paymentIntentID := fmt.Sprintf("pi_%d", time.Now().UnixNano())

	// Generate client secret (in production, this would be cryptographically secure)
	clientSecret := fmt.Sprintf("%s_secret_%d", paymentIntentID, time.Now().UnixNano())

	// Create payment intent response
	response := PaymentIntentResponse{
		ID:           paymentIntentID,
		Amount:       req.Amount,
		Currency:     req.Currency,
		Status:       "requires_payment_method",
		ClientSecret: clientSecret,
	}

	s.logger.WithFields(logrus.Fields{
		"payment_intent_id": paymentIntentID,
		"amount":            req.Amount,
		"currency":          req.Currency,
	}).Info("Payment intent created")

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

// processPayment processes a payment using UPI Core
func (s *HTTPServer) processPayment(w http.ResponseWriter, r *http.Request) {
	var req ProcessPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		s.logger.WithError(err).Error("Failed to decode process payment request")
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.PaymentIntentId == "" {
		http.Error(w, "Payment intent ID is required", http.StatusBadRequest)
		return
	}

	if req.PaymentMethod == nil {
		http.Error(w, "Payment method is required", http.StatusBadRequest)
		return
	}

	// Generate transaction ID for UPI processing
	transactionID := fmt.Sprintf("txn_%d", time.Now().UnixNano())

	// For demo purposes, we'll create mock VPAs based on payment method
	// In production, these would come from user authentication and merchant setup
	var payerVPA, payeeVPA string

	switch req.PaymentMethod.Type {
	case "card":
		// For card payments, create mock UPI VPAs
		payerVPA = "user@paytm"       // Mock payer VPA
		payeeVPA = "merchant@phonepe" // Mock payee VPA
	case "upi":
		// For UPI payments, extract VPAs from payment method details
		payerVPA = "user@gpay"     // Would be extracted from user session
		payeeVPA = "suuupra@paytm" // Suuupra merchant VPA
	default:
		// Default to card-like flow
		payerVPA = "user@paytm"
		payeeVPA = "merchant@phonepe"
	}

	// Extract amount from payment intent ID (in production, you'd query this from storage)
	// For demo, we'll use a default amount or parse it somehow
	amount := int64(2900) // Default ₹29.00 in paisa
	if len(req.PaymentIntentId) > 15 {
		// Try to extract timestamp and derive amount (this is just for demo)
		timestampStr := req.PaymentIntentId[3:13] // Extract timestamp part
		if ts, err := strconv.ParseInt(timestampStr, 10, 64); err == nil {
			// Use timestamp to derive amount (just for demo variety)
			amount = (ts % 5000) + 1000 // Amount between 1000-6000 paisa
		}
	}

	// Create UPI transaction request
	upiReq := &pb.TransactionRequest{
		TransactionId: transactionID,
		PayerVpa:      payerVPA,
		PayeeVpa:      payeeVPA,
		AmountPaisa:   amount,
		Currency:      "INR",
		Type:          pb.TransactionType_TRANSACTION_TYPE_P2M, // Payment to Merchant
		Description:   "Suuupra subscription payment",
		Reference:     req.PaymentIntentId,
		InitiatedAt:   timestamppb.Now(),
		Metadata: map[string]string{
			"payment_intent_id": req.PaymentIntentId,
			"payment_method":    req.PaymentMethod.Type,
		},
	}

	// Process transaction through UPI Core
	ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
	defer cancel()

	upiResp, err := s.transactionService.ProcessTransaction(ctx, upiReq)
	if err != nil {
		s.logger.WithError(err).WithFields(logrus.Fields{
			"payment_intent_id": req.PaymentIntentId,
			"transaction_id":    transactionID,
		}).Error("Failed to process UPI transaction")

		// Return failed payment response
		response := ProcessPaymentResponse{
			ID:              fmt.Sprintf("pay_%d", time.Now().UnixNano()),
			Status:          "failed",
			PaymentIntentId: req.PaymentIntentId,
			TransactionId:   transactionID,
		}

		w.Header().Set("Content-Type", "application/json")
		w.WriteHeader(http.StatusBadRequest)
		json.NewEncoder(w).Encode(response)
		return
	}

	// Map UPI transaction status to payment status
	var paymentStatus string
	switch upiResp.Status {
	case pb.TransactionStatus_TRANSACTION_STATUS_SUCCESS:
		paymentStatus = "completed"
	case pb.TransactionStatus_TRANSACTION_STATUS_PENDING:
		paymentStatus = "processing"
	case pb.TransactionStatus_TRANSACTION_STATUS_FAILED:
		paymentStatus = "failed"
	default:
		paymentStatus = "failed"
	}

	// Create successful payment response
	response := ProcessPaymentResponse{
		ID:              fmt.Sprintf("pay_%d", time.Now().UnixNano()),
		Status:          paymentStatus,
		PaymentIntentId: req.PaymentIntentId,
		TransactionId:   upiResp.TransactionId,
	}

	s.logger.WithFields(logrus.Fields{
		"payment_intent_id": req.PaymentIntentId,
		"transaction_id":    upiResp.TransactionId,
		"upi_status":        upiResp.Status.String(),
		"payment_status":    paymentStatus,
		"amount":            amount,
	}).Info("Payment processed through UPI Core")

	w.Header().Set("Content-Type", "application/json")
	if paymentStatus == "completed" {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusAccepted) // 202 for processing/pending
	}

	json.NewEncoder(w).Encode(response)
}
