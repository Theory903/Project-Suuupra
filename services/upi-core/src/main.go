package main

import (
	"context"
	"log"
	"net"
	"os"
	"os/signal"
	"syscall"

	"google.golang.org/grpc"
	"google.golang.org/grpc/reflection"

	pb "github.com/suuupra/upi-core/pkg/pb"
)

const (
	defaultPort = "8012"
)

type server struct {
	pb.UnimplementedUPICoreServer
}

func (s *server) ProcessUPIPayment(ctx context.Context, req *pb.UPIPaymentRequest) (*pb.UPIPaymentResponse, error) {
	// Mock UPI payment processing
	return &pb.UPIPaymentResponse{
		TransactionId: "upi_" + req.PaymentId,
		Status:        "SUCCESS",
		Message:       "Payment processed successfully",
		Amount:        req.Amount,
		Currency:      req.Currency,
	}, nil
}

func (s *server) ValidateUPIId(ctx context.Context, req *pb.UPIValidationRequest) (*pb.UPIValidationResponse, error) {
	// Mock UPI ID validation
	isValid := len(req.UpiId) > 0 && req.UpiId != ""
	
	return &pb.UPIValidationResponse{
		IsValid: isValid,
		UpiId:   req.UpiId,
		Message: "UPI ID validation completed",
	}, nil
}

func main() {
	port := os.Getenv("PORT")
	if port == "" {
		port = defaultPort
	}

	lis, err := net.Listen("tcp", ":"+port)
	if err != nil {
		log.Fatalf("Failed to listen: %v", err)
	}

	s := grpc.NewServer()
	pb.RegisterUPICoreServer(s, &server{})
	
	// Enable reflection for grpcurl testing
	reflection.Register(s)

	log.Printf("UPI Core gRPC server listening on port %s", port)

	// Graceful shutdown
	go func() {
		if err := s.Serve(lis); err != nil {
			log.Fatalf("Failed to serve: %v", err)
		}
	}()

	// Wait for interrupt signal to gracefully shutdown
	quit := make(chan os.Signal, 1)
	signal.Notify(quit, syscall.SIGINT, syscall.SIGTERM)
	<-quit
	
	log.Println("Shutting down UPI Core server...")
	s.GracefulStop()
}