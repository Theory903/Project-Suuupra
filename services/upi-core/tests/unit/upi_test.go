package main

import (
	"testing"
	"context"
	pb "github.com/suuupra/upi-core/pkg/pb"
)

func TestUPIPaymentProcessing(t *testing.T) {
	server := &server{}
	
	req := &pb.UPIPaymentRequest{
		PaymentId: "test_payment_123",
		Amount:    10000, // ₹100.00 in paisa
		Currency:  "INR",
		PayerUpi:  "user@paytm",
		PayeeUpi:  "merchant@googlepay",
	}
	
	resp, err := server.ProcessUPIPayment(context.Background(), req)
	
	if err != nil {
		t.Fatalf("Expected no error, got %v", err)
	}
	
	if resp.Status != "SUCCESS" {
		t.Errorf("Expected status SUCCESS, got %s", resp.Status)
	}
	
	if resp.Amount != req.Amount {
		t.Errorf("Expected amount %d, got %d", req.Amount, resp.Amount)
	}
	
	if resp.TransactionId == "" {
		t.Error("Expected transaction ID to be generated")
	}
}

func TestUPIIdValidation(t *testing.T) {
	server := &server{}
	
	testCases := []struct {
		upiId    string
		expected bool
	}{
		{"user@paytm", true},
		{"merchant@googlepay", true},
		{"", false},
		{"invalid", false},
	}
	
	for _, tc := range testCases {
		req := &pb.UPIValidationRequest{
			UpiId: tc.upiId,
		}
		
		resp, err := server.ValidateUPIId(context.Background(), req)
		
		if err != nil {
			t.Fatalf("Expected no error for UPI ID %s, got %v", tc.upiId, err)
		}
		
		if resp.IsValid != tc.expected {
			t.Errorf("For UPI ID %s, expected valid=%t, got %t", tc.upiId, tc.expected, resp.IsValid)
		}
	}
}

func TestTransactionIdGeneration(t *testing.T) {
	server := &server{}
	
	req := &pb.UPIPaymentRequest{
		PaymentId: "test_payment_456",
		Amount:    5000,
		Currency:  "INR",
		PayerUpi:  "user@phonepe",
		PayeeUpi:  "shop@paytm",
	}
	
	resp1, _ := server.ProcessUPIPayment(context.Background(), req)
	resp2, _ := server.ProcessUPIPayment(context.Background(), req)
	
	if resp1.TransactionId == resp2.TransactionId {
		t.Error("Expected unique transaction IDs, got duplicates")
	}
}

func BenchmarkUPIPaymentProcessing(b *testing.B) {
	server := &server{}
	req := &pb.UPIPaymentRequest{
		PaymentId: "benchmark_payment",
		Amount:    10000,
		Currency:  "INR",
		PayerUpi:  "user@paytm",
		PayeeUpi:  "merchant@googlepay",
	}
	
	b.ResetTimer()
	for i := 0; i < b.N; i++ {
		_, err := server.ProcessUPIPayment(context.Background(), req)
		if err != nil {
			b.Fatal(err)
		}
	}
}