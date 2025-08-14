import http from 'k6/http';
import grpc from 'k6/net/grpc';
import { check, sleep } from 'k6';
import { Rate } from 'k6/metrics';

// Custom metrics
const errorRate = new Rate('errors');

// Test configuration
export const options = {
  stages: [
    { duration: '30s', target: 10 },  // Ramp up to 10 users
    { duration: '1m', target: 50 },   // Stay at 50 users
    { duration: '30s', target: 0 },   // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'], // 95% of requests must complete below 500ms
    errors: ['rate<0.1'],             // Error rate must be below 10%
  },
};

const BANK_SIMULATOR_HTTP = 'http://localhost:8080';
const UPI_CORE_GRPC = 'localhost:50052';

export function setup() {
  // Setup phase - create test data if needed
  console.log('Setting up integration test...');
  
  // Check if services are healthy
  const healthCheck = http.get(`${BANK_SIMULATOR_HTTP}/health`);
  check(healthCheck, {
    'Bank Simulator is healthy': (r) => r.status === 200,
  });
  
  return {
    testData: {
      payerVPA: 'test.hdfc.1@hdfc',
      payeeVPA: 'test.sbi.1@sbi',
      amount: 10000, // 100 INR in paisa
    }
  };
}

export default function (data) {
  const testData = data.testData;
  
  // Test 1: Get supported banks via HTTP API
  testGetBanks();
  
  // Test 2: Process transaction via UPI Core gRPC
  testProcessTransaction(testData);
  
  // Test 3: Check transaction status
  testTransactionStatus();
  
  sleep(1);
}

function testGetBanks() {
  const response = http.get(`${BANK_SIMULATOR_HTTP}/api/banks/`);
  
  const success = check(response, {
    'Get banks status is 200': (r) => r.status === 200,
    'Get banks response time < 200ms': (r) => r.timings.duration < 200,
    'Banks data is returned': (r) => {
      const data = JSON.parse(r.body);
      return data.success && data.data && data.data.length > 0;
    },
  });
  
  if (!success) {
    errorRate.add(1);
  }
}

function testProcessTransaction(testData) {
  const client = new grpc.Client();
  client.load(['../proto'], 'upi_core.proto');
  
  try {
    client.connect(UPI_CORE_GRPC, { plaintext: true });
    
    const transactionRequest = {
      transaction_id: `TXN${Date.now()}${Math.random().toString(36).substr(2, 5)}`,
      payer_vpa: testData.payerVPA,
      payee_vpa: testData.payeeVPA,
      amount_paisa: testData.amount,
      currency: 'INR',
      type: 'TRANSACTION_TYPE_P2P',
      description: 'Integration test transaction',
      signature: 'test_signature',
      initiated_at: {
        seconds: Math.floor(Date.now() / 1000),
        nanos: 0,
      },
    };
    
    const response = client.invoke('upi_core.UpiCore/ProcessTransaction', transactionRequest);
    
    const success = check(response, {
      'Transaction processing gRPC call successful': (r) => r && r.status === grpc.StatusOK,
      'Transaction response contains transaction_id': (r) => r && r.message && r.message.transaction_id,
      'Transaction status is success': (r) => r && r.message && r.message.status === 'TRANSACTION_STATUS_SUCCESS',
    });
    
    if (!success) {
      errorRate.add(1);
    }
    
    // Store transaction ID for status check
    if (response && response.message) {
      __ENV.LAST_TRANSACTION_ID = response.message.transaction_id;
    }
    
  } catch (error) {
    console.error('gRPC transaction error:', error);
    errorRate.add(1);
  } finally {
    client.close();
  }
}

function testTransactionStatus() {
  if (!__ENV.LAST_TRANSACTION_ID) {
    console.log('No transaction ID available for status check');
    return;
  }
  
  const client = new grpc.Client();
  client.load(['../proto'], 'upi_core.proto');
  
  try {
    client.connect(UPI_CORE_GRPC, { plaintext: true });
    
    const statusRequest = {
      transaction_id: __ENV.LAST_TRANSACTION_ID,
    };
    
    const response = client.invoke('upi_core.UpiCore/GetTransactionStatus', statusRequest);
    
    const success = check(response, {
      'Transaction status gRPC call successful': (r) => r && r.status === grpc.StatusOK,
      'Status response contains transaction data': (r) => r && r.message && r.message.transaction_id,
    });
    
    if (!success) {
      errorRate.add(1);
    }
    
  } catch (error) {
    console.error('gRPC status check error:', error);
    errorRate.add(1);
  } finally {
    client.close();
  }
}

export function teardown(data) {
  console.log('Tearing down integration test...');
  // Cleanup if needed
}
