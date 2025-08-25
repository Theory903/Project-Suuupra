package main

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"os"
	"time"
)

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

type HealthResponse struct {
	Status    string `json:"status"`
	Service   string `json:"service"`
	Timestamp string `json:"timestamp"`
	Message   string `json:"message"`
}

var paymentIntents = make(map[string]PaymentIntentResponse)

func corsMiddleware(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Access-Control-Allow-Origin", "*")
		w.Header().Set("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization, X-Request-ID")

		if r.Method == "OPTIONS" {
			w.WriteHeader(http.StatusOK)
			return
		}

		next.ServeHTTP(w, r)
	}
}

func logRequest(handler http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		start := time.Now()
		log.Printf("Started %s %s", r.Method, r.URL.Path)

		handler.ServeHTTP(w, r)

		log.Printf("Completed %s %s in %v", r.Method, r.URL.Path, time.Since(start))
	}
}

func healthHandler(w http.ResponseWriter, r *http.Request) {
	response := HealthResponse{
		Status:    "healthy",
		Service:   "upi-core-payment-api",
		Timestamp: time.Now().UTC().Format(time.RFC3339),
		Message:   "UPI Core Payment API is running",
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func createPaymentIntent(w http.ResponseWriter, r *http.Request) {
	var req PaymentIntentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Failed to decode payment intent request: %v", err)
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

	// Generate client secret
	clientSecret := fmt.Sprintf("%s_secret_%d", paymentIntentID, time.Now().UnixNano())

	// Create payment intent response
	response := PaymentIntentResponse{
		ID:           paymentIntentID,
		Amount:       req.Amount,
		Currency:     req.Currency,
		Status:       "requires_payment_method",
		ClientSecret: clientSecret,
	}

	// Store payment intent for later processing
	paymentIntents[paymentIntentID] = response

	log.Printf("Payment intent created: ID=%s, Amount=%d, Currency=%s",
		paymentIntentID, req.Amount, req.Currency)

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(response)
}

func processPayment(w http.ResponseWriter, r *http.Request) {
	var req ProcessPaymentRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		log.Printf("Failed to decode process payment request: %v", err)
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

	// Find the payment intent
	_, exists := paymentIntents[req.PaymentIntentId]
	if !exists {
		log.Printf("Payment intent not found: %s", req.PaymentIntentId)
		http.Error(w, "Payment intent not found", http.StatusNotFound)
		return
	}

	// Simulate payment processing
	log.Printf("Processing payment: Intent=%s, Method=%s",
		req.PaymentIntentId, req.PaymentMethod.Type)

	// Generate transaction ID
	transactionID := fmt.Sprintf("txn_%d", time.Now().UnixNano())

	// Simulate success (you can add failure simulation logic)
	var paymentStatus string

	// Simple validation for demo
	if req.PaymentMethod.Type == "card" && req.PaymentMethod.Details != nil {
		// Basic card validation
		if len(req.PaymentMethod.Details.CardNumber) < 16 {
			paymentStatus = "failed"
		} else {
			paymentStatus = "completed"
		}
	} else {
		paymentStatus = "completed" // Default to success for UPI/other methods
	}

	// Create payment response
	response := ProcessPaymentResponse{
		ID:              fmt.Sprintf("pay_%d", time.Now().UnixNano()),
		Status:          paymentStatus,
		PaymentIntentId: req.PaymentIntentId,
		TransactionId:   transactionID,
	}

	log.Printf("Payment processed: Intent=%s, Status=%s, Transaction=%s",
		req.PaymentIntentId, paymentStatus, transactionID)

	w.Header().Set("Content-Type", "application/json")
	if paymentStatus == "completed" {
		w.WriteHeader(http.StatusOK)
	} else {
		w.WriteHeader(http.StatusBadRequest)
	}

	json.NewEncoder(w).Encode(response)
}

// Legacy endpoint handler for backwards compatibility
func defaultHandler(w http.ResponseWriter, r *http.Request) {
	response := map[string]interface{}{
		"message":   "UPI Core Payment API is running",
		"service":   "upi-core",
		"timestamp": time.Now().UTC().Format(time.RFC3339),
		"path":      r.URL.Path,
		"method":    r.Method,
		"version":   "1.0.0",
		"endpoints": []string{
			"POST /payments/api/v1/intents - Create payment intent",
			"POST /payments/api/v1/payments - Process payment",
			"GET /health - Health check",
		},
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(response)
}

func main() {
	// Create HTTP server
	mux := http.NewServeMux()

	// Register routes with middleware
	mux.HandleFunc("/health", corsMiddleware(logRequest(healthHandler)))

	// Full payment API routes (for direct access)
	mux.HandleFunc("/payments/api/v1/intents", corsMiddleware(logRequest(createPaymentIntent)))
	mux.HandleFunc("/payments/api/v1/payments", corsMiddleware(logRequest(processPayment)))

	// Shortened API routes (for API Gateway routing)
	mux.HandleFunc("/api/v1/intents", corsMiddleware(logRequest(createPaymentIntent)))
	mux.HandleFunc("/api/v1/payments", corsMiddleware(logRequest(processPayment)))

	mux.HandleFunc("/", corsMiddleware(logRequest(defaultHandler)))

	// Start server
	port := "8080"
	if portEnv := os.Getenv("PORT"); portEnv != "" {
		port = portEnv
	}

	log.Printf("🚀 UPI Core Payment API starting on port %s", port)
	log.Printf("📍 Endpoints available:")
	log.Printf("   GET  http://localhost:%s/health", port)
	log.Printf("   POST http://localhost:%s/payments/api/v1/intents", port)
	log.Printf("   POST http://localhost:%s/payments/api/v1/payments", port)

	if err := http.ListenAndServe(":"+port, mux); err != nil {
		log.Fatal("Failed to start server:", err)
	}
}
