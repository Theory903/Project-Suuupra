package main

import (
	"context"
	"fmt"
	"log"
	"testing"
	"time"

	"github.com/google/uuid"
	"github.com/stretchr/testify/assert"
	"github.com/stretchr/testify/require"
	"google.golang.org/grpc"
	"google.golang.org/grpc/credentials/insecure"
	"google.golang.org/protobuf/types/known/timestamppb"
)

// Test configuration
const (
	BankSimulatorAddress = "localhost:50050"
	UpiCoreAddress       = "localhost:50052"
	TestBankCode         = "HDFC"
	TestMobileNumber     = "+919876543210"
	TestEmail            = "test@hdfc.com"
	InitialDepositPaisa  = 100000 // 1000 INR
	TransactionAmount    = 50000   // 500 INR
)

// Test suite structure
type IntegrationTestSuite struct {
	bankSimClient BankSimulatorClient
	upiCoreClient UpiCoreClient
	testAccounts  []string
	testVPAs      []string
}

// Setup test suite
func setupTestSuite() (*IntegrationTestSuite, error) {
	// Connect to Bank Simulator
	bankConn, err := grpc.Dial(BankSimulatorAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to Bank Simulator: %v", err)
	}
	bankSimClient := NewBankSimulatorClient(bankConn)

	// Connect to UPI Core
	upiConn, err := grpc.Dial(UpiCoreAddress, grpc.WithTransportCredentials(insecure.NewCredentials()))
	if err != nil {
		return nil, fmt.Errorf("failed to connect to UPI Core: %v", err)
	}
	upiCoreClient := NewUpiCoreClient(upiConn)

	return &IntegrationTestSuite{
		bankSimClient: bankSimClient,
		upiCoreClient: upiCoreClient,
		testAccounts:  make([]string, 0),
		testVPAs:      make([]string, 0),
	}, nil
}

// Cleanup test data
func (suite *IntegrationTestSuite) cleanup() {
	// Note: In a real implementation, we would have cleanup methods
	// For now, we'll just log the cleanup
	log.Printf("Cleaning up test data: %d accounts, %d VPAs", len(suite.testAccounts), len(suite.testVPAs))
}

// Test 1: Service Health Checks
func TestServiceHealthChecks(t *testing.T) {
	suite, err := setupTestSuite()
	require.NoError(t, err)
	defer suite.cleanup()

	t.Run("BankSimulator_HealthCheck", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		req := &BankHealthRequest{
			BankCode: TestBankCode,
		}

		resp, err := suite.bankSimClient.CheckBankHealth(ctx, req)
		require.NoError(t, err)
		assert.NotNil(t, resp)
		assert.Equal(t, TestBankCode, resp.BankCode)
		assert.Equal(t, HealthStatus_HEALTH_STATUS_HEALTHY, resp.HealthStatus)
		
		t.Logf("Bank Health Status: %v, Success Rate: %d%%, Avg Response Time: %dms", 
			resp.HealthStatus, resp.SuccessRatePercent, resp.AvgResponseTimeMs)
	})

	t.Run("UpiCore_HealthCheck", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		req := &HealthCheckRequest{
			Service: "upi-core",
		}

		resp, err := suite.upiCoreClient.HealthCheck(ctx, req)
		require.NoError(t, err)
		assert.NotNil(t, resp)
		assert.Equal(t, HealthStatus_HEALTH_STATUS_SERVING, resp.Status)
		
		t.Logf("UPI Core Health Status: %v", resp.Status)
	})
}

// Test 2: Bank Account Creation Flow
func TestAccountCreationFlow(t *testing.T) {
	suite, err := setupTestSuite()
	require.NoError(t, err)
	defer suite.cleanup()

	t.Run("CreateAccount_Success", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		customerID := fmt.Sprintf("CUST_%s", uuid.New().String()[:8])
		
		req := &CreateAccountRequest{
			BankCode:    TestBankCode,
			CustomerId:  customerID,
			AccountType: AccountType_ACCOUNT_TYPE_SAVINGS,
			MobileNumber: TestMobileNumber,
			Email:       TestEmail,
			KycDetails: &CustomerKYC{
				Pan:            "ABCDE1234F",
				AadhaarMasked:  "****5678",
				FullName:       "Test Customer",
				DateOfBirth:    "1990-01-01",
				Address:        "Test Address, Test City",
			},
			InitialDepositPaisa: InitialDepositPaisa,
		}

		resp, err := suite.bankSimClient.CreateAccount(ctx, req)
		require.NoError(t, err)
		assert.NotNil(t, resp)
		assert.NotEmpty(t, resp.AccountNumber)
		assert.NotEmpty(t, resp.IfscCode)
		assert.Equal(t, AccountStatus_ACCOUNT_STATUS_ACTIVE, resp.Status)

		// Store for cleanup
		suite.testAccounts = append(suite.testAccounts, resp.AccountNumber)

		t.Logf("Created account: %s, IFSC: %s", resp.AccountNumber, resp.IfscCode)
	})

	t.Run("GetAccountDetails_AfterCreation", func(t *testing.T) {
		// First create an account
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		customerID := fmt.Sprintf("CUST_%s", uuid.New().String()[:8])
		createReq := &CreateAccountRequest{
			BankCode:     TestBankCode,
			CustomerId:   customerID,
			AccountType:  AccountType_ACCOUNT_TYPE_SAVINGS,
			MobileNumber: TestMobileNumber,
			Email:        TestEmail,
			KycDetails: &CustomerKYC{
				Pan:         "ABCDE1234F",
				AadhaarMasked: "****5678",
				FullName:    "Test Customer",
				DateOfBirth: "1990-01-01",
				Address:     "Test Address, Test City",
			},
			InitialDepositPaisa: InitialDepositPaisa,
		}

		createResp, err := suite.bankSimClient.CreateAccount(ctx, createReq)
		require.NoError(t, err)
		suite.testAccounts = append(suite.testAccounts, createResp.AccountNumber)

		// Now get account details
		detailsReq := &AccountDetailsRequest{
			BankCode:      TestBankCode,
			AccountNumber: createResp.AccountNumber,
		}

		detailsResp, err := suite.bankSimClient.GetAccountDetails(ctx, detailsReq)
		require.NoError(t, err)
		assert.Equal(t, createResp.AccountNumber, detailsResp.AccountNumber)
		assert.Equal(t, createResp.IfscCode, detailsResp.IfscCode)
		assert.Equal(t, int64(InitialDepositPaisa), detailsResp.AvailableBalancePaisa)
		assert.Equal(t, AccountStatus_ACCOUNT_STATUS_ACTIVE, detailsResp.Status)

		t.Logf("Account Details - Balance: %d paisa, Status: %v", 
			detailsResp.AvailableBalancePaisa, detailsResp.Status)
	})
}

// Test 3: VPA Resolution Flow
func TestVPAResolutionFlow(t *testing.T) {
	suite, err := setupTestSuite()
	require.NoError(t, err)
	defer suite.cleanup()

	var testAccountNumber string

	t.Run("CreateAccount_ForVPA", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		customerID := fmt.Sprintf("CUST_%s", uuid.New().String()[:8])
		req := &CreateAccountRequest{
			BankCode:     TestBankCode,
			CustomerId:   customerID,
			AccountType:  AccountType_ACCOUNT_TYPE_SAVINGS,
			MobileNumber: TestMobileNumber,
			Email:        TestEmail,
			KycDetails: &CustomerKYC{
				Pan:         "ABCDE1234F",
				AadhaarMasked: "****5678",
				FullName:    "Test Customer VPA",
				DateOfBirth: "1990-01-01",
				Address:     "Test Address, Test City",
			},
			InitialDepositPaisa: InitialDepositPaisa,
		}

		resp, err := suite.bankSimClient.CreateAccount(ctx, req)
		require.NoError(t, err)
		testAccountNumber = resp.AccountNumber
		suite.testAccounts = append(suite.testAccounts, resp.AccountNumber)
	})

	t.Run("LinkVPA_Success", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		testVPA := fmt.Sprintf("test%s@hdfc", uuid.New().String()[:8])
		
		req := &LinkVPARequest{
			Vpa:           testVPA,
			BankCode:      TestBankCode,
			AccountNumber: testAccountNumber,
			IsPrimary:     true,
		}

		resp, err := suite.bankSimClient.LinkVPA(ctx, req)
		require.NoError(t, err)
		assert.True(t, resp.Success)

		suite.testVPAs = append(suite.testVPAs, testVPA)

		t.Logf("Linked VPA: %s to account: %s", testVPA, testAccountNumber)
	})

	t.Run("ResolveVPA_BankSimulator", func(t *testing.T) {
		if len(suite.testVPAs) == 0 {
			t.Skip("No VPAs available for testing")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		testVPA := suite.testVPAs[0]
		
		req := &ResolveVPARequest{
			Vpa: testVPA,
		}

		resp, err := suite.bankSimClient.ResolveVPA(ctx, req)
		require.NoError(t, err)
		assert.True(t, resp.Exists)
		assert.Equal(t, TestBankCode, resp.BankCode)
		assert.NotEmpty(t, resp.AccountNumber)
		assert.NotEmpty(t, resp.AccountHolderName)
		assert.True(t, resp.IsActive)

		t.Logf("Resolved VPA: %s -> Account: %s, Bank: %s", 
			testVPA, resp.AccountNumber, resp.BankCode)
	})

	t.Run("ResolveVPA_UpiCore", func(t *testing.T) {
		if len(suite.testVPAs) == 0 {
			t.Skip("No VPAs available for testing")
		}

		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		testVPA := suite.testVPAs[0]
		
		req := &ResolveVPARequest{
			Vpa: testVPA,
		}

		resp, err := suite.upiCoreClient.ResolveVPA(ctx, req)
		require.NoError(t, err)
		assert.True(t, resp.Exists)
		assert.Equal(t, TestBankCode, resp.BankCode)
		assert.NotEmpty(t, resp.AccountNumber)
		assert.True(t, resp.IsActive)

		t.Logf("UPI Core resolved VPA: %s -> Account: %s", testVPA, resp.AccountNumber)
	})
}

// Test 4: Transaction Processing Flow
func TestTransactionProcessingFlow(t *testing.T) {
	suite, err := setupTestSuite()
	require.NoError(t, err)
	defer suite.cleanup()

	var payerAccount, payeeAccount string
	var payerVPA, payeeVPA string

	t.Run("Setup_PayerAndPayeeAccounts", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		// Create payer account
		payerCustomerID := fmt.Sprintf("PAYER_%s", uuid.New().String()[:8])
		payerReq := &CreateAccountRequest{
			BankCode:     TestBankCode,
			CustomerId:   payerCustomerID,
			AccountType:  AccountType_ACCOUNT_TYPE_SAVINGS,
			MobileNumber: "+919876543210",
			Email:        "payer@hdfc.com",
			KycDetails: &CustomerKYC{
				Pan:         "PAYER1234F",
				AadhaarMasked: "****1234",
				FullName:    "Payer Customer",
				DateOfBirth: "1990-01-01",
				Address:     "Payer Address, Test City",
			},
			InitialDepositPaisa: InitialDepositPaisa * 2, // More money for payer
		}

		payerResp, err := suite.bankSimClient.CreateAccount(ctx, payerReq)
		require.NoError(t, err)
		payerAccount = payerResp.AccountNumber
		suite.testAccounts = append(suite.testAccounts, payerAccount)

		// Create payee account
		payeeCustomerID := fmt.Sprintf("PAYEE_%s", uuid.New().String()[:8])
		payeeReq := &CreateAccountRequest{
			BankCode:     TestBankCode,
			CustomerId:   payeeCustomerID,
			AccountType:  AccountType_ACCOUNT_TYPE_SAVINGS,
			MobileNumber: "+919876543211",
			Email:        "payee@hdfc.com",
			KycDetails: &CustomerKYC{
				Pan:         "PAYEE1234F",
				AadhaarMasked: "****5678",
				FullName:    "Payee Customer",
				DateOfBirth: "1991-01-01",
				Address:     "Payee Address, Test City",
			},
			InitialDepositPaisa: InitialDepositPaisa,
		}

		payeeResp, err := suite.bankSimClient.CreateAccount(ctx, payeeReq)
		require.NoError(t, err)
		payeeAccount = payeeResp.AccountNumber
		suite.testAccounts = append(suite.testAccounts, payeeAccount)

		t.Logf("Created payer account: %s, payee account: %s", payerAccount, payeeAccount)
	})

	t.Run("Setup_VPAs", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		// Create payer VPA
		payerVPA = fmt.Sprintf("payer%s@hdfc", uuid.New().String()[:8])
		payerVPAReq := &LinkVPARequest{
			Vpa:           payerVPA,
			BankCode:      TestBankCode,
			AccountNumber: payerAccount,
			IsPrimary:     true,
		}

		payerVPAResp, err := suite.bankSimClient.LinkVPA(ctx, payerVPAReq)
		require.NoError(t, err)
		assert.True(t, payerVPAResp.Success)
		suite.testVPAs = append(suite.testVPAs, payerVPA)

		// Create payee VPA
		payeeVPA = fmt.Sprintf("payee%s@hdfc", uuid.New().String()[:8])
		payeeVPAReq := &LinkVPARequest{
			Vpa:           payeeVPA,
			BankCode:      TestBankCode,
			AccountNumber: payeeAccount,
			IsPrimary:     true,
		}

		payeeVPAResp, err := suite.bankSimClient.LinkVPA(ctx, payeeVPAReq)
		require.NoError(t, err)
		assert.True(t, payeeVPAResp.Success)
		suite.testVPAs = append(suite.testVPAs, payeeVPA)

		t.Logf("Created VPAs - Payer: %s, Payee: %s", payerVPA, payeeVPA)
	})

	t.Run("ProcessTransaction_BankSimulator_Debit", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		transactionID := fmt.Sprintf("TXN_%s", uuid.New().String())

		req := &TransactionRequest{
			TransactionId: transactionID,
			BankCode:      TestBankCode,
			AccountNumber: payerAccount,
			AmountPaisa:   TransactionAmount,
			Type:          TransactionType_TRANSACTION_TYPE_DEBIT,
			Reference:     "P2P_TRANSFER",
			Description:   "Test P2P transfer payment",
			Metadata: map[string]string{
				"receiver_vpa": payeeVPA,
				"purpose":      "test",
			},
			InitiatedAt: timestamppb.Now(),
		}

		resp, err := suite.bankSimClient.ProcessTransaction(ctx, req)
		require.NoError(t, err)
		assert.Equal(t, transactionID, resp.TransactionId)
		assert.Equal(t, TransactionStatus_TRANSACTION_STATUS_SUCCESS, resp.Status)
		assert.NotEmpty(t, resp.BankReferenceId)

		t.Logf("Debit transaction processed: %s, Bank Ref: %s, New Balance: %d paisa", 
			resp.TransactionId, resp.BankReferenceId, resp.AccountBalancePaisa)
	})

	t.Run("ProcessTransaction_BankSimulator_Credit", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		transactionID := fmt.Sprintf("TXN_%s", uuid.New().String())

		req := &TransactionRequest{
			TransactionId: transactionID,
			BankCode:      TestBankCode,
			AccountNumber: payeeAccount,
			AmountPaisa:   TransactionAmount,
			Type:          TransactionType_TRANSACTION_TYPE_CREDIT,
			Reference:     "P2P_TRANSFER",
			Description:   "Test P2P transfer receipt",
			Metadata: map[string]string{
				"sender_vpa": payerVPA,
				"purpose":    "test",
			},
			InitiatedAt: timestamppb.Now(),
		}

		resp, err := suite.bankSimClient.ProcessTransaction(ctx, req)
		require.NoError(t, err)
		assert.Equal(t, transactionID, resp.TransactionId)
		assert.Equal(t, TransactionStatus_TRANSACTION_STATUS_SUCCESS, resp.Status)
		assert.NotEmpty(t, resp.BankReferenceId)

		t.Logf("Credit transaction processed: %s, Bank Ref: %s, New Balance: %d paisa", 
			resp.TransactionId, resp.BankReferenceId, resp.AccountBalancePaisa)
	})

	t.Run("ProcessTransaction_UpiCore_E2E", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		transactionID := fmt.Sprintf("UPI_%s", uuid.New().String())
		rrn := fmt.Sprintf("RRN_%s", uuid.New().String()[:12])

		req := &TransactionRequest{
			TransactionId: transactionID,
			Rrn:           rrn,
			PayerVpa:      payerVPA,
			PayeeVpa:      payeeVPA,
			AmountPaisa:   TransactionAmount,
			Currency:      "INR",
			Type:          TransactionType_TRANSACTION_TYPE_P2P,
			Description:   "UPI Integration Test Transfer",
			Reference:     "INTEGRATION_TEST",
			Signature:     "dummy_signature",
			InitiatedAt:   timestamppb.Now(),
			Metadata: map[string]string{
				"test_type": "integration",
				"source":    "automated_test",
			},
		}

		resp, err := suite.upiCoreClient.ProcessTransaction(ctx, req)
		require.NoError(t, err)
		assert.Equal(t, transactionID, resp.TransactionId)
		assert.Equal(t, rrn, resp.Rrn)
		assert.NotEmpty(t, resp.PayerBankCode)
		assert.NotEmpty(t, resp.PayeeBankCode)
		
		// UPI transactions might be async, so status could be PENDING or SUCCESS
		assert.Contains(t, []TransactionStatus{
			TransactionStatus_TRANSACTION_STATUS_PENDING,
			TransactionStatus_TRANSACTION_STATUS_SUCCESS,
		}, resp.Status)

		t.Logf("UPI transaction processed: %s, RRN: %s, Status: %v, Payer Bank: %s, Payee Bank: %s", 
			resp.TransactionId, resp.Rrn, resp.Status, resp.PayerBankCode, resp.PayeeBankCode)
	})
}

// Test 5: Error Handling and Edge Cases
func TestErrorHandlingAndEdgeCases(t *testing.T) {
	suite, err := setupTestSuite()
	require.NoError(t, err)
	defer suite.cleanup()

	t.Run("ResolveVPA_NonExistent", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		req := &ResolveVPARequest{
			Vpa: "nonexistent@unknown",
		}

		resp, err := suite.bankSimClient.ResolveVPA(ctx, req)
		require.NoError(t, err)
		assert.False(t, resp.Exists)
		assert.NotEmpty(t, resp.ErrorCode)

		t.Logf("Non-existent VPA resolution: %s, Error: %s", req.Vpa, resp.ErrorMessage)
	})

	t.Run("ProcessTransaction_InsufficientFunds", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 30*time.Second)
		defer cancel()

		// First create an account with low balance
		customerID := fmt.Sprintf("POOR_%s", uuid.New().String()[:8])
		createReq := &CreateAccountRequest{
			BankCode:     TestBankCode,
			CustomerId:   customerID,
			AccountType:  AccountType_ACCOUNT_TYPE_SAVINGS,
			MobileNumber: "+919876543299",
			Email:        "poor@hdfc.com",
			KycDetails: &CustomerKYC{
				Pan:         "POOR12345F",
				AadhaarMasked: "****9999",
				FullName:    "Poor Customer",
				DateOfBirth: "1990-01-01",
				Address:     "Poor Address, Test City",
			},
			InitialDepositPaisa: 1000, // Only 10 INR
		}

		createResp, err := suite.bankSimClient.CreateAccount(ctx, createReq)
		require.NoError(t, err)
		suite.testAccounts = append(suite.testAccounts, createResp.AccountNumber)

		// Try to debit more than available
		transactionID := fmt.Sprintf("FAIL_%s", uuid.New().String())
		txnReq := &TransactionRequest{
			TransactionId: transactionID,
			BankCode:      TestBankCode,
			AccountNumber: createResp.AccountNumber,
			AmountPaisa:   100000, // 1000 INR - more than available
			Type:          TransactionType_TRANSACTION_TYPE_DEBIT,
			Reference:     "INSUFFICIENT_FUNDS_TEST",
			Description:   "Test insufficient funds scenario",
			InitiatedAt:   timestamppb.Now(),
		}

		txnResp, err := suite.bankSimClient.ProcessTransaction(ctx, txnReq)
		require.NoError(t, err)
		assert.Equal(t, TransactionStatus_TRANSACTION_STATUS_INSUFFICIENT_FUNDS, txnResp.Status)
		assert.NotEmpty(t, txnResp.ErrorCode)

		t.Logf("Insufficient funds test: Status: %v, Error: %s", txnResp.Status, txnResp.ErrorMessage)
	})

	t.Run("GetAccountDetails_NonExistent", func(t *testing.T) {
		ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
		defer cancel()

		req := &AccountDetailsRequest{
			BankCode:      TestBankCode,
			AccountNumber: "99999999999999",
		}

		resp, err := suite.bankSimClient.GetAccountDetails(ctx, req)
		// This should either return an error or a response with error code
		if err == nil {
			assert.NotEmpty(t, resp.ErrorCode)
			t.Logf("Non-existent account: Error Code: %s, Message: %s", resp.ErrorCode, resp.ErrorMessage)
		} else {
			t.Logf("Non-existent account query failed as expected: %v", err)
		}
	})
}

// Test 6: Performance and Load Testing
func TestPerformanceBaseline(t *testing.T) {
	suite, err := setupTestSuite()
	require.NoError(t, err)
	defer suite.cleanup()

	t.Run("VPA_Resolution_Performance", func(t *testing.T) {
		// Create account and VPA for testing
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		customerID := fmt.Sprintf("PERF_%s", uuid.New().String()[:8])
		createReq := &CreateAccountRequest{
			BankCode:     TestBankCode,
			CustomerId:   customerID,
			AccountType:  AccountType_ACCOUNT_TYPE_SAVINGS,
			MobileNumber: "+919876543298",
			Email:        "perf@hdfc.com",
			KycDetails: &CustomerKYC{
				Pan:         "PERF12345F",
				AadhaarMasked: "****9998",
				FullName:    "Performance Test Customer",
				DateOfBirth: "1990-01-01",
				Address:     "Performance Test Address",
			},
			InitialDepositPaisa: InitialDepositPaisa,
		}

		createResp, err := suite.bankSimClient.CreateAccount(ctx, createReq)
		require.NoError(t, err)
		suite.testAccounts = append(suite.testAccounts, createResp.AccountNumber)

		testVPA := fmt.Sprintf("perf%s@hdfc", uuid.New().String()[:8])
		vpaReq := &LinkVPARequest{
			Vpa:           testVPA,
			BankCode:      TestBankCode,
			AccountNumber: createResp.AccountNumber,
			IsPrimary:     true,
		}

		_, err = suite.bankSimClient.LinkVPA(ctx, vpaReq)
		require.NoError(t, err)
		suite.testVPAs = append(suite.testVPAs, testVPA)

		// Performance test: Multiple VPA resolutions
		const iterations = 10
		totalDuration := time.Duration(0)

		for i := 0; i < iterations; i++ {
			start := time.Now()
			
			resolveReq := &ResolveVPARequest{Vpa: testVPA}
			resp, err := suite.bankSimClient.ResolveVPA(ctx, resolveReq)
			
			duration := time.Since(start)
			totalDuration += duration

			require.NoError(t, err)
			assert.True(t, resp.Exists)
		}

		avgDuration := totalDuration / iterations
		t.Logf("VPA Resolution Performance: %d iterations, Avg: %v, Total: %v", 
			iterations, avgDuration, totalDuration)

		// Performance requirement: VPA resolution should be < 300ms
		assert.Less(t, avgDuration.Milliseconds(), int64(300), 
			"VPA resolution took longer than 300ms on average")
	})

	t.Run("Transaction_Processing_Performance", func(t *testing.T) {
		// Create account for testing
		ctx, cancel := context.WithTimeout(context.Background(), 60*time.Second)
		defer cancel()

		customerID := fmt.Sprintf("TXNPERF_%s", uuid.New().String()[:8])
		createReq := &CreateAccountRequest{
			BankCode:     TestBankCode,
			CustomerId:   customerID,
			AccountType:  AccountType_ACCOUNT_TYPE_SAVINGS,
			MobileNumber: "+919876543297",
			Email:        "txnperf@hdfc.com",
			KycDetails: &CustomerKYC{
				Pan:         "TXNPR1234F",
				AadhaarMasked: "****9997",
				FullName:    "Transaction Performance Test",
				DateOfBirth: "1990-01-01",
				Address:     "Transaction Performance Address",
			},
			InitialDepositPaisa: InitialDepositPaisa * 10, // More balance for multiple transactions
		}

		createResp, err := suite.bankSimClient.CreateAccount(ctx, createReq)
		require.NoError(t, err)
		suite.testAccounts = append(suite.testAccounts, createResp.AccountNumber)

		// Performance test: Multiple small transactions
		const iterations = 5
		const txnAmount = 1000 // 10 INR each
		totalDuration := time.Duration(0)

		for i := 0; i < iterations; i++ {
			start := time.Now()
			
			transactionID := fmt.Sprintf("PERF_%d_%s", i, uuid.New().String()[:8])
			txnReq := &TransactionRequest{
				TransactionId: transactionID,
				BankCode:      TestBankCode,
				AccountNumber: createResp.AccountNumber,
				AmountPaisa:   txnAmount,
				Type:          TransactionType_TRANSACTION_TYPE_DEBIT,
				Reference:     "PERFORMANCE_TEST",
				Description:   fmt.Sprintf("Performance test transaction %d", i),
				InitiatedAt:   timestamppb.Now(),
			}

			resp, err := suite.bankSimClient.ProcessTransaction(ctx, txnReq)
			
			duration := time.Since(start)
			totalDuration += duration

			require.NoError(t, err)
			assert.Equal(t, TransactionStatus_TRANSACTION_STATUS_SUCCESS, resp.Status)
		}

		avgDuration := totalDuration / iterations
		t.Logf("Transaction Processing Performance: %d iterations, Avg: %v, Total: %v", 
			iterations, avgDuration, totalDuration)

		// Performance requirement: Transaction processing should be < 500ms
		assert.Less(t, avgDuration.Milliseconds(), int64(500), 
			"Transaction processing took longer than 500ms on average")
	})
}

// Benchmark tests
func BenchmarkVPAResolution(b *testing.B) {
	suite, err := setupTestSuite()
	if err != nil {
		b.Fatalf("Failed to setup test suite: %v", err)
	}
	defer suite.cleanup()

	// Setup a test VPA
	ctx := context.Background()
	customerID := fmt.Sprintf("BENCH_%s", uuid.New().String()[:8])
	createReq := &CreateAccountRequest{
		BankCode:     TestBankCode,
		CustomerId:   customerID,
		AccountType:  AccountType_ACCOUNT_TYPE_SAVINGS,
		MobileNumber: "+919876543296",
		Email:        "bench@hdfc.com",
		KycDetails: &CustomerKYC{
			Pan:         "BENCH1234F",
			AadhaarMasked: "****9996",
			FullName:    "Benchmark Test Customer",
			DateOfBirth: "1990-01-01",
			Address:     "Benchmark Test Address",
		},
		InitialDepositPaisa: InitialDepositPaisa,
	}

	createResp, err := suite.bankSimClient.CreateAccount(ctx, createReq)
	if err != nil {
		b.Fatalf("Failed to create account: %v", err)
	}

	testVPA := fmt.Sprintf("bench%s@hdfc", uuid.New().String()[:8])
	vpaReq := &LinkVPARequest{
		Vpa:           testVPA,
		BankCode:      TestBankCode,
		AccountNumber: createResp.AccountNumber,
		IsPrimary:     true,
	}

	_, err = suite.bankSimClient.LinkVPA(ctx, vpaReq)
	if err != nil {
		b.Fatalf("Failed to link VPA: %v", err)
	}

	b.ResetTimer()

	b.Run("BankSimulator_ResolveVPA", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			req := &ResolveVPARequest{Vpa: testVPA}
			_, err := suite.bankSimClient.ResolveVPA(ctx, req)
			if err != nil {
				b.Errorf("VPA resolution failed: %v", err)
			}
		}
	})

	b.Run("UpiCore_ResolveVPA", func(b *testing.B) {
		for i := 0; i < b.N; i++ {
			req := &ResolveVPARequest{Vpa: testVPA}
			_, err := suite.upiCoreClient.ResolveVPA(ctx, req)
			if err != nil {
				b.Errorf("UPI Core VPA resolution failed: %v", err)
			}
		}
	})
}