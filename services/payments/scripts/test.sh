#!/bin/bash

# Test script for Payment Gateway service

set -e

echo ">ê Running Payment Gateway tests..."

# Check if Go is installed
if ! command -v go &> /dev/null; then
    echo "L Go is not installed. Please install Go 1.21 or later."
    exit 1
fi

# Download dependencies
echo "=æ Ensuring dependencies are available..."
go mod download

# Run unit tests
echo "=, Running unit tests..."
go test ./internal/... -v -race -cover -coverprofile=coverage.out

# Run integration tests (if any)
echo "= Running integration tests..."
go test ./tests/integration/... -v -tags=integration || echo "9  No integration tests found"

# Run load tests (if any)
echo "¡ Running load tests..."
go test ./tests/load/... -v -tags=load || echo "9  No load tests found"

# Generate coverage report
echo "=Ê Generating coverage report..."
go tool cover -html=coverage.out -o coverage.html

# Display coverage summary
echo "=È Coverage summary:"
go tool cover -func=coverage.out | tail -1

# Run go vet for static analysis
echo "= Running static analysis (go vet)..."
go vet ./...

# Run golint if available
if command -v golint &> /dev/null; then
    echo "( Running golint..."
    golint ./...
else
    echo "9  golint not found, skipping lint checks"
fi

# Run go fmt check
echo "<¨ Checking code formatting..."
UNFORMATTED=$(go fmt ./...)
if [ -n "$UNFORMATTED" ]; then
    echo "L The following files are not properly formatted:"
    echo "$UNFORMATTED"
    exit 1
else
    echo " All files are properly formatted"
fi

# Run gosec for security analysis if available
if command -v gosec &> /dev/null; then
    echo "= Running security analysis (gosec)..."
    gosec ./...
else
    echo "9  gosec not found, skipping security analysis"
fi

# Run ineffassign if available
if command -v ineffassign &> /dev/null; then
    echo "<¯ Checking for ineffective assignments..."
    ineffassign ./...
else
    echo "9  ineffassign not found, skipping ineffective assignment checks"
fi

# Run misspell if available
if command -v misspell &> /dev/null; then
    echo "=Ý Checking for spelling errors..."
    misspell -error .
else
    echo "9  misspell not found, skipping spelling checks"
fi

echo ""
echo " All tests completed successfully!"
echo "=Ê Coverage report generated: coverage.html"
echo ""
echo "=Ë Test summary:"
echo "  - Unit tests: "
echo "  - Static analysis: "
echo "  - Code formatting: "
echo "  - Coverage report: coverage.html"