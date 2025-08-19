package integration

import (
	"context"
	"testing"
	"time"
	
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	
	pb "github.com/suuupra/upi-core/pkg/pb"
)

func TestUPICoreIntegration(t *testing.T) {
	// Connect to UPI Core service
	conn, err := grpc.Dial("localhost:8012", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Skipf("Could not connect to UPI Core service: %v", err)
	}
	defer conn.Close()
	
	client := pb.NewUPICoreClient(conn)
	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	
	t.Run("ProcessUPIPayment", func(t *testing.T) {
		req := &pb.UPIPaymentRequest{
			PaymentId: "integration_test_001",
			Amount:    15000, // ₹150.00
			Currency:  "INR",
			PayerUpi:  "testuser@bank1",
			PayeeUpi:  "testmerchant@bank2",
		}
		
		resp, err := client.ProcessUPIPayment(ctx, req)
		if err != nil {
			t.Fatalf("ProcessUPIPayment failed: %v", err)
		}
		
		if resp.Status != "SUCCESS" {
			t.Errorf("Expected SUCCESS, got %s", resp.Status)
		}
		
		if resp.Amount != req.Amount {
			t.Errorf("Amount mismatch: expected %d, got %d", req.Amount, resp.Amount)
		}
	})
	
	t.Run("ValidateUPIId", func(t *testing.T) {
		testCases := []struct {
			name     string
			upiId    string
			expected bool
		}{
			{"Valid UPI ID", "user@paytm", true},
			{"Empty UPI ID", "", false},
			{"Invalid format", "notaupiid", false},
		}
		
		for _, tc := range testCases {
			t.Run(tc.name, func(t *testing.T) {
				req := &pb.UPIValidationRequest{
					UpiId: tc.upiId,
				}
				
				resp, err := client.ValidateUPIId(ctx, req)
				if err != nil {
					t.Fatalf("ValidateUPIId failed: %v", err)
				}
				
				if resp.IsValid != tc.expected {
					t.Errorf("For %s, expected valid=%t, got %t", tc.upiId, tc.expected, resp.IsValid)
				}
			})
		}
	})
}

func TestUPICoreLoadHandling(t *testing.T) {
	conn, err := grpc.Dial("localhost:8012", grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		t.Skipf("Could not connect to UPI Core service: %v", err)
	}
	defer conn.Close()
	
	client := pb.NewUPICoreClient(conn)
	
	// Concurrent payment processing test
	numGoroutines := 10
	numRequestsPerGoroutine := 5
	
	errChan := make(chan error, numGoroutines*numRequestsPerGoroutine)
	
	for i := 0; i < numGoroutines; i++ {
		go func(goroutineId int) {
			for j := 0; j < numRequestsPerGoroutine; j++ {
				ctx, cancel := context.WithTimeout(context.Background(), 5*time.Second)
				
				req := &pb.UPIPaymentRequest{
					PaymentId: fmt.Sprintf("load_test_%d_%d", goroutineId, j),
					Amount:    int64(1000 + goroutineId*100 + j*10),
					Currency:  "INR",
					PayerUpi:  fmt.Sprintf("user%d@bank1", goroutineId),
					PayeeUpi:  "loadtest@bank2",
				}
				
				_, err := client.ProcessUPIPayment(ctx, req)
				errChan <- err
				cancel()
			}
		}(i)
	}
	
	// Collect results
	successCount := 0
	for i := 0; i < numGoroutines*numRequestsPerGoroutine; i++ {
		err := <-errChan
		if err == nil {
			successCount++
		} else {
			t.Logf("Request failed: %v", err)
		}
	}
	
	expectedSuccess := numGoroutines * numRequestsPerGoroutine
	if successCount < expectedSuccess*8/10 { // Allow 20% failure rate
		t.Errorf("Too many failures: %d/%d succeeded", successCount, expectedSuccess)
	}
}