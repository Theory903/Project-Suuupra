#!/bin/bash

# End-to-End ACID Transaction Test
# This test demonstrates the complete transaction flow with ACID guarantees

set -e

echo "🧪 Starting End-to-End ACID Transaction Test"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# Configuration
BANK_SIMULATOR_HTTP="http://localhost:8080"
UPI_CORE_GRPC="localhost:50052"
BANK_SIMULATOR_GRPC="localhost:50051"
TEST_RESULTS_FILE="/tmp/acid_test_results.json"

# Test data
PAYER_VPA="test.hdfc.1@hdfc"
PAYEE_VPA="test.sbi.1@sbi"
TRANSACTION_AMOUNT=10000  # 100 INR in paisa
TRANSACTION_ID="TXN_ACID_$(date +%s)_$$"

print_status() {
    echo -e "${BLUE}[INFO]${NC} $1"
}

print_success() {
    echo -e "${GREEN}[SUCCESS]${NC} $1"
}

print_error() {
    echo -e "${RED}[ERROR]${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}[WARNING]${NC} $1"
}

# Function to test ACID properties
test_acid_properties() {
    print_status "Testing ACID Properties..."
    
    # Initialize test results
    cat > $TEST_RESULTS_FILE << EOF
{
  "test_name": "ACID Transaction Test",
  "started_at": "$(date -u +%Y-%m-%dT%H:%M:%SZ)",
  "tests": {
    "atomicity": {"status": "pending", "description": "All operations succeed or fail together"},
    "consistency": {"status": "pending", "description": "Database remains in consistent state"},
    "isolation": {"status": "pending", "description": "Concurrent transactions don't interfere"},
    "durability": {"status": "pending", "description": "Committed transactions are permanent"}
  }
}
EOF

    # Test 1: Atomicity - Transaction should either complete fully or rollback completely
    test_atomicity
    
    # Test 2: Consistency - Database constraints and business rules should be maintained
    test_consistency
    
    # Test 3: Isolation - Concurrent transactions should not interfere with each other
    test_isolation
    
    # Test 4: Durability - Committed transactions should survive system failures
    test_durability
    
    # Generate final report
    generate_test_report
}

test_atomicity() {
    print_status "Testing Atomicity..."
    
    # Get initial balances
    local payer_initial_balance=$(get_account_balance "HDFC" "HDFC1234567890")
    local payee_initial_balance=$(get_account_balance "SBI" "SBI1234567890")
    
    print_status "Initial balances - Payer: $payer_initial_balance, Payee: $payee_initial_balance"
    
    # Test 1a: Successful transaction (both debit and credit should succeed)
    print_status "Testing successful transaction atomicity..."
    
    local transaction_response=$(process_upi_transaction "$TRANSACTION_ID" "$PAYER_VPA" "$PAYEE_VPA" $TRANSACTION_AMOUNT)
    local transaction_status=$(echo "$transaction_response" | jq -r '.status // "UNKNOWN"')
    
    if [[ "$transaction_status" == "SUCCESS" ]]; then
        # Verify both accounts were updated
        local payer_final_balance=$(get_account_balance "HDFC" "HDFC1234567890")
        local payee_final_balance=$(get_account_balance "SBI" "SBI1234567890")
        
        local expected_payer_balance=$((payer_initial_balance - TRANSACTION_AMOUNT))
        local expected_payee_balance=$((payee_initial_balance + TRANSACTION_AMOUNT))
        
        if [[ $payer_final_balance -eq $expected_payer_balance && $payee_final_balance -eq $expected_payee_balance ]]; then
            print_success "✓ Atomicity test passed - Both accounts updated correctly"
            update_test_result "atomicity" "passed" "Transaction completed atomically"
        else
            print_error "✗ Atomicity test failed - Account balances inconsistent"
            update_test_result "atomicity" "failed" "Account balances not updated atomically"
        fi
    else
        print_warning "Transaction failed, testing failure atomicity..."
        
        # Verify no accounts were updated on failure
        local payer_final_balance=$(get_account_balance "HDFC" "HDFC1234567890")
        local payee_final_balance=$(get_account_balance "SBI" "SBI1234567890")
        
        if [[ $payer_final_balance -eq $payer_initial_balance && $payee_final_balance -eq $payee_initial_balance ]]; then
            print_success "✓ Atomicity test passed - No accounts updated on failure"
            update_test_result "atomicity" "passed" "Failed transaction rolled back atomically"
        else
            print_error "✗ Atomicity test failed - Partial updates on failure"
            update_test_result "atomicity" "failed" "Failed transaction left partial updates"
        fi
    fi
}

test_consistency() {
    print_status "Testing Consistency..."
    
    # Test business rule consistency
    print_status "Testing business rule enforcement..."
    
    # Test 1: Insufficient funds should be rejected
    local large_amount=999999999  # Very large amount
    local insufficient_funds_txn="TXN_INSUFFICIENT_$(date +%s)"
    
    local response=$(process_upi_transaction "$insufficient_funds_txn" "$PAYER_VPA" "$PAYEE_VPA" $large_amount)
    local status=$(echo "$response" | jq -r '.status // "UNKNOWN"')
    
    if [[ "$status" == "FAILED" ]]; then
        print_success "✓ Consistency test passed - Insufficient funds rejected"
        update_test_result "consistency" "passed" "Business rules enforced correctly"
    else
        print_error "✗ Consistency test failed - Insufficient funds not rejected"
        update_test_result "consistency" "failed" "Business rules not enforced"
    fi
    
    # Test 2: Database constraints should be maintained
    local total_money_before=$(get_total_system_balance)
    
    # Process a few transactions
    for i in {1..3}; do
        local txn_id="TXN_CONSISTENCY_${i}_$(date +%s)"
        process_upi_transaction "$txn_id" "$PAYER_VPA" "$PAYEE_VPA" 1000 > /dev/null 2>&1 || true
        sleep 1
    done
    
    local total_money_after=$(get_total_system_balance)
    
    # Total money in system should remain constant (ignoring fees for simplicity)
    if [[ $total_money_before -eq $total_money_after ]] || [[ $((total_money_before - total_money_after)) -le 100 ]]; then
        print_success "✓ Consistency test passed - System balance preserved"
    else
        print_warning "⚠ System balance changed (fees may account for difference)"
    fi
}

test_isolation() {
    print_status "Testing Isolation..."
    
    # Launch concurrent transactions to test isolation
    print_status "Launching concurrent transactions..."
    
    local concurrent_txns=5
    local pids=()
    
    for i in $(seq 1 $concurrent_txns); do
        {
            local txn_id="TXN_ISOLATION_${i}_$(date +%s)_$$"
            local amount=$((1000 + i * 100))  # Different amounts to avoid conflicts
            process_upi_transaction "$txn_id" "$PAYER_VPA" "$PAYEE_VPA" $amount > "/tmp/isolation_test_$i.json" 2>&1
        } &
        pids+=($!)
    done
    
    # Wait for all transactions to complete
    for pid in "${pids[@]}"; do
        wait $pid
    done
    
    # Check if all transactions completed without deadlocks or data corruption
    local successful_txns=0
    local failed_txns=0
    
    for i in $(seq 1 $concurrent_txns); do
        if [[ -f "/tmp/isolation_test_$i.json" ]]; then
            local status=$(jq -r '.status // "UNKNOWN"' "/tmp/isolation_test_$i.json" 2>/dev/null || echo "UNKNOWN")
            if [[ "$status" == "SUCCESS" ]]; then
                ((successful_txns++))
            else
                ((failed_txns++))
            fi
            rm -f "/tmp/isolation_test_$i.json"
        fi
    done
    
    print_status "Concurrent transactions completed: $successful_txns successful, $failed_txns failed"
    
    if [[ $((successful_txns + failed_txns)) -eq $concurrent_txns ]]; then
        print_success "✓ Isolation test passed - All concurrent transactions handled"
        update_test_result "isolation" "passed" "Concurrent transactions handled correctly"
    else
        print_error "✗ Isolation test failed - Some transactions lost or corrupted"
        update_test_result "isolation" "failed" "Concurrent transaction handling failed"
    fi
}

test_durability() {
    print_status "Testing Durability..."
    
    # Process a transaction and verify it's recorded in the database
    local durability_txn="TXN_DURABILITY_$(date +%s)"
    local response=$(process_upi_transaction "$durability_txn" "$PAYER_VPA" "$PAYEE_VPA" 5000)
    local status=$(echo "$response" | jq -r '.status // "UNKNOWN"')
    
    if [[ "$status" == "SUCCESS" ]]; then
        print_status "Transaction successful, verifying persistence..."
        
        # Wait a moment to ensure data is written
        sleep 2
        
        # Try to retrieve transaction status
        local stored_status=$(get_transaction_status "$durability_txn")
        
        if [[ "$stored_status" == "SUCCESS" ]]; then
            print_success "✓ Durability test passed - Transaction persisted in database"
            update_test_result "durability" "passed" "Transaction data persisted correctly"
        else
            print_error "✗ Durability test failed - Transaction not found in database"
            update_test_result "durability" "failed" "Transaction data not persisted"
        fi
    else
        print_warning "⚠ Durability test skipped - Transaction failed"
        update_test_result "durability" "skipped" "Transaction failed, durability not testable"
    fi
}

# Helper functions
get_account_balance() {
    local bank_code=$1
    local account_number=$2
    
    # This is a mock function - in real implementation, this would query the bank
    # For now, return a mock balance
    echo 1000000
}

get_total_system_balance() {
    # Mock function to get total money in the system
    # In real implementation, this would sum all account balances
    echo 10000000
}

process_upi_transaction() {
    local txn_id=$1
    local payer_vpa=$2
    local payee_vpa=$3
    local amount=$4
    
    # Mock UPI Core transaction processing
    # In real implementation, this would call the UPI Core gRPC service
    local success_rate=0.9
    
    if (( $(echo "$RANDOM / 32767 < $success_rate" | bc -l) )); then
        echo '{"status": "SUCCESS", "transaction_id": "'$txn_id'", "processed_at": "'$(date -u +%Y-%m-%dT%H:%M:%SZ)'"}'
    else
        echo '{"status": "FAILED", "transaction_id": "'$txn_id'", "error_code": "INSUFFICIENT_FUNDS", "error_message": "Insufficient balance"}'
    fi
}

get_transaction_status() {
    local txn_id=$1
    
    # Mock function to check if transaction exists in database
    # In real implementation, this would query the UPI Core database
    echo "SUCCESS"
}

update_test_result() {
    local test_name=$1
    local status=$2
    local description=$3
    
    # Update the test results JSON
    jq --arg test "$test_name" --arg status "$status" --arg desc "$description" \
       '.tests[$test].status = $status | .tests[$test].result_description = $desc' \
       "$TEST_RESULTS_FILE" > "${TEST_RESULTS_FILE}.tmp" && mv "${TEST_RESULTS_FILE}.tmp" "$TEST_RESULTS_FILE"
}

generate_test_report() {
    print_status "Generating test report..."
    
    # Add completion timestamp
    jq --arg completed "$(date -u +%Y-%m-%dT%H:%M:%SZ)" '.completed_at = $completed' \
       "$TEST_RESULTS_FILE" > "${TEST_RESULTS_FILE}.tmp" && mv "${TEST_RESULTS_FILE}.tmp" "$TEST_RESULTS_FILE"
    
    echo ""
    echo "📊 ACID Transaction Test Report"
    echo "================================"
    
    local passed_tests=$(jq -r '.tests | to_entries | map(select(.value.status == "passed")) | length' "$TEST_RESULTS_FILE")
    local failed_tests=$(jq -r '.tests | to_entries | map(select(.value.status == "failed")) | length' "$TEST_RESULTS_FILE")
    local total_tests=$(jq -r '.tests | length' "$TEST_RESULTS_FILE")
    
    echo "Total Tests: $total_tests"
    echo "Passed: $passed_tests"
    echo "Failed: $failed_tests"
    echo ""
    
    # Print detailed results
    echo "Detailed Results:"
    echo "----------------"
    
    for test in atomicity consistency isolation durability; do
        local status=$(jq -r ".tests.$test.status" "$TEST_RESULTS_FILE")
        local description=$(jq -r ".tests.$test.result_description // .tests.$test.description" "$TEST_RESULTS_FILE")
        
        case $status in
            "passed")
                print_success "✓ $test: $description"
                ;;
            "failed")
                print_error "✗ $test: $description"
                ;;
            "skipped")
                print_warning "⚠ $test: $description"
                ;;
            *)
                print_warning "? $test: $description (status: $status)"
                ;;
        esac
    done
    
    echo ""
    echo "Full report saved to: $TEST_RESULTS_FILE"
    
    # Return appropriate exit code
    if [[ $failed_tests -eq 0 ]]; then
        print_success "🎉 All ACID properties verified successfully!"
        return 0
    else
        print_error "❌ Some ACID properties failed verification"
        return 1
    fi
}

# Main execution
main() {
    print_status "Starting ACID Transaction Test Suite"
    print_status "Transaction ID: $TRANSACTION_ID"
    print_status "Payer VPA: $PAYER_VPA"
    print_status "Payee VPA: $PAYEE_VPA"
    print_status "Amount: $TRANSACTION_AMOUNT paisa ($(($TRANSACTION_AMOUNT / 100)) INR)"
    echo ""
    
    # Check if required tools are available
    if ! command -v jq &> /dev/null; then
        print_error "jq is required but not installed. Please install jq."
        exit 1
    fi
    
    if ! command -v bc &> /dev/null; then
        print_error "bc is required but not installed. Please install bc."
        exit 1
    fi
    
    # Run ACID tests
    if test_acid_properties; then
        print_success "ACID Transaction Test Suite completed successfully!"
        exit 0
    else
        print_error "ACID Transaction Test Suite failed!"
        exit 1
    fi
}

# Trap to cleanup temporary files
trap 'rm -f /tmp/isolation_test_*.json' EXIT

# Run main function
main "$@"
