package http

import (
	"context"
	"encoding/json"
	"net/http"
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
	TransactionID   string    `json:"transactionId"`
	RRN             string    `json:"rrn"`
	Status          string    `json:"status"`
	ErrorCode       string    `json:"errorCode,omitempty"`
	ErrorMessage    string    `json:"errorMessage,omitempty"`
	PayerBankCode   string    `json:"payerBankCode,omitempty"`
	PayeeBankCode   string    `json:"payeeBankCode,omitempty"`
	ProcessedAt     time.Time `json:"processedAt"`
	Fees            *Fees     `json:"fees,omitempty"`
	SettlementID    string    `json:"settlementId,omitempty"`
}

type Fees struct {
	SwitchFeePaisa int64 `json:"switchFeePaisa"`
	BankFeePaisa   int64 `json:"bankFeePaisa"`
	TotalFeePaisa  int64 `json:"totalFeePaisa"`
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
	router.HandleFunc("/upi/transactions", server.processTransaction).Methods("POST")
	router.HandleFunc("/upi/transactions/{transactionId}", server.getTransactionStatus).Methods("GET")
	
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
