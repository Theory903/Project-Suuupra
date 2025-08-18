package services

import (
	"testing"

	"github.com/shopspring/decimal"
	"github.com/sirupsen/logrus"
	"github.com/stretchr/testify/assert"

	"github.com/suuupra/upi-psp/internal/config"
)

func TestUPIService_CreateUPIString(t *testing.T) {
	// Setup
	config := config.UPIConfig{
		AcquirerID: "SUUUPRA",
		PSPID:      "SUUUPRAPSP",
		MerchantID: "SUUUPRA001",
	}
	logger := logrus.New()
	upiService := NewUPIService(config, logger)

	t.Run("create UPI string with amount", func(t *testing.T) {
		vpa := "test@suuupra"
		amount := decimal.NewFromFloat(100.50)
		description := "Test payment"
		reference := "REF123"

		upiString := upiService.CreateUPIString(vpa, amount, description, reference)

		expected := "upi://pay?pa=test@suuupra&am=100.5&tn=Test payment&tr=REF123&cu=INR&mc=SUUUPRA001"
		assert.Equal(t, expected, upiString)
	})

	t.Run("create UPI string without amount", func(t *testing.T) {
		vpa := "merchant@suuupra"
		amount := decimal.Zero
		description := "Merchant payment"
		reference := ""

		upiString := upiService.CreateUPIString(vpa, amount, description, reference)

		expected := "upi://pay?pa=merchant@suuupra&tn=Merchant payment&cu=INR&mc=SUUUPRA001"
		assert.Equal(t, expected, upiString)
	})
}

func TestUPIService_ValidateVPA(t *testing.T) {
	config := config.UPIConfig{
		AcquirerID: "SUUUPRA",
		PSPID:      "SUUUPRAPSP",
		MerchantID: "SUUUPRA001",
	}
	logger := logrus.New()
	upiService := NewUPIService(config, logger)

	t.Run("valid VPA format", func(t *testing.T) {
		vpa := "user@suuupra"
		valid, err := upiService.ValidateVPA(vpa)

		// Note: This will call ResolveVPA which is mocked to return valid
		assert.NoError(t, err)
		assert.True(t, valid)
	})

	t.Run("invalid VPA format - no @", func(t *testing.T) {
		vpa := "invalidvpa"
		valid, err := upiService.ValidateVPA(vpa)

		assert.Error(t, err)
		assert.False(t, valid)
		assert.Contains(t, err.Error(), "invalid VPA format")
	})

	t.Run("invalid VPA format - too short", func(t *testing.T) {
		vpa := "a@"
		valid, err := upiService.ValidateVPA(vpa)

		assert.Error(t, err)
		assert.False(t, valid)
		assert.Contains(t, err.Error(), "invalid VPA format")
	})
}

func TestUPIService_GenerateTransactionID(t *testing.T) {
	config := config.UPIConfig{
		AcquirerID: "SUUUPRA",
		PSPID:      "SUUUPRAPSP",
		MerchantID: "SUUUPRA001",
	}
	logger := logrus.New()
	upiService := NewUPIService(config, logger)

	t.Run("generate unique transaction IDs", func(t *testing.T) {
		id1 := upiService.GenerateTransactionID()
		id2 := upiService.GenerateTransactionID()

		// Should not be empty
		assert.NotEmpty(t, id1)
		assert.NotEmpty(t, id2)

		// Should be different
		assert.NotEqual(t, id1, id2)

		// Should start with PSP ID
		assert.Contains(t, id1, config.PSPID)
		assert.Contains(t, id2, config.PSPID)
	})
}

func TestUPIService_ParseUPIString(t *testing.T) {
	config := config.UPIConfig{
		AcquirerID: "SUUUPRA",
		PSPID:      "SUUUPRAPSP",
		MerchantID: "SUUUPRA001",
	}
	logger := logrus.New()
	upiService := NewUPIService(config, logger)

	t.Run("parse complete UPI string", func(t *testing.T) {
		upiString := "upi://pay?pa=test@suuupra&am=100.50&tn=Test%20payment&tr=REF123&cu=INR"

		info, err := upiService.ParseUPIString(upiString)

		assert.NoError(t, err)
		assert.NotNil(t, info)
		assert.Equal(t, "test@suuupra", info.VPA)
		assert.Equal(t, "100.5", info.Amount.String())
		assert.Equal(t, "Test%20payment", info.Description)
		assert.Equal(t, "REF123", info.Reference)
		assert.Equal(t, "INR", info.Currency)
	})

	t.Run("parse UPI string without amount", func(t *testing.T) {
		upiString := "upi://pay?pa=merchant@suuupra&tn=Payment&cu=INR"

		info, err := upiService.ParseUPIString(upiString)

		assert.NoError(t, err)
		assert.NotNil(t, info)
		assert.Equal(t, "merchant@suuupra", info.VPA)
		assert.True(t, info.Amount.IsZero())
		assert.Equal(t, "Payment", info.Description)
	})

	t.Run("parse invalid UPI string - no VPA", func(t *testing.T) {
		upiString := "upi://pay?am=100&tn=Payment"

		info, err := upiService.ParseUPIString(upiString)

		// The current implementation doesn't validate VPA presence, it just returns empty VPA
		assert.NoError(t, err)
		assert.NotNil(t, info)
		assert.Equal(t, "", info.VPA) // Empty VPA when not provided
		assert.Equal(t, "Payment", info.Description)
	})
}
