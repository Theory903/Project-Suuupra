import { check, group } from 'k6';
import grpc from 'k6/net/grpc';
import { Trend, Rate, Counter } from 'k6/metrics';

// Custom metrics
const vpaResolutionTrend = new Trend('vpa_resolution_duration');
const transactionTrend = new Trend('transaction_processing_duration');
const successRate = new Rate('success_rate');
const errorCounter = new Counter('error_count');

// Test configuration
export let options = {
  scenarios: {
    // VPA Resolution Load Test
    vpa_resolution: {
      executor: 'constant-vus',
      vus: 10,
      duration: '30s',
      exec: 'vpaResolutionTest',
      tags: { test_type: 'vpa_resolution' },
    },
    
    // Transaction Processing Load Test
    transaction_processing: {
      executor: 'constant-vus', 
      vus: 5,
      duration: '30s',
      exec: 'transactionProcessingTest',
      tags: { test_type: 'transaction_processing' },
      startTime: '35s', // Start after VPA resolution test
    },
    
    // Stress Test - Ramp up load
    stress_test: {
      executor: 'ramping-vus',
      startVUs: 0,
      stages: [
        { duration: '10s', target: 20 },
        { duration: '30s', target: 20 },
        { duration: '10s', target: 0 },
      ],
      exec: 'stressTest',
      tags: { test_type: 'stress' },
      startTime: '70s',
    },
  },
  
  thresholds: {
    'vpa_resolution_duration': ['p(95)<300'], // 95% of VPA resolutions should be under 300ms
    'transaction_processing_duration': ['p(95)<500'], // 95% of transactions should be under 500ms
    'success_rate': ['rate>0.95'], // 95% success rate required
    'error_count': ['count<50'], // Less than 50 errors total
  },
};

// gRPC client setup
const bankSimulatorClient = new grpc.Client();
const upiCoreClient = new grpc.Client();

export function setup() {
  console.log('Setting up gRPC connections...');
  
  // Load proto files (note: in a real scenario, you'd load actual proto files)
  bankSimulatorClient.load(['../proto'], 'bank_simulator.proto');
  upiCoreClient.load(['../proto'], 'upi_core.proto');
  
  // Connect to services
  bankSimulatorClient.connect('localhost:50050', { plaintext: true });
  upiCoreClient.connect('localhost:50052', { plaintext: true });
  
  // Create test accounts for load testing
  console.log('Creating test accounts...');
  
  const testAccounts = [];
  const testVPAs = [];
  
  for (let i = 0; i < 20; i++) {
    const accountReq = {
      bank_code: 'HDFC',
      customer_id: `LOAD_TEST_${i}_${Date.now()}`,
      account_type: 1, // SAVINGS
      mobile_number: `+9187654${String(i).padStart(5, '0')}`,
      email: `loadtest${i}@hdfc.com`,
      kyc_details: {
        pan: `LOAD${String(i).padStart(5, '0')}F`,
        aadhaar_masked: '****1234',
        full_name: `Load Test Customer ${i}`,
        date_of_birth: '1990-01-01',
        address: `Load Test Address ${i}`,
      },
      initial_deposit_paisa: 1000000, // 10,000 INR
    };
    
    try {
      const response = bankSimulatorClient.invoke('bank_simulator.BankSimulator/CreateAccount', accountReq);
      
      if (response.status === grpc.StatusOK) {
        testAccounts.push({
          accountNumber: response.message.account_number,
          ifscCode: response.message.ifsc_code,
        });
        
        // Create VPA for this account
        const vpaReq = {
          vpa: `loadtest${i}@hdfc`,
          bank_code: 'HDFC',
          account_number: response.message.account_number,
          is_primary: true,
        };
        
        const vpaResponse = bankSimulatorClient.invoke('bank_simulator.BankSimulator/LinkVPA', vpaReq);
        if (vpaResponse.status === grpc.StatusOK && vpaResponse.message.success) {
          testVPAs.push(`loadtest${i}@hdfc`);
        }
      }
    } catch (error) {
      console.error(`Failed to create test account ${i}:`, error);
    }
  }
  
  console.log(`Created ${testAccounts.length} test accounts and ${testVPAs.length} VPAs`);
  
  return {
    accounts: testAccounts,
    vpas: testVPAs,
  };
}

export function vpaResolutionTest(data) {
  if (!data.vpas || data.vpas.length === 0) {
    console.error('No VPAs available for testing');
    return;
  }
  
  group('VPA Resolution Load Test', function () {
    const vpa = data.vpas[Math.floor(Math.random() * data.vpas.length)];
    
    const request = {
      vpa: vpa,
    };
    
    const start = Date.now();
    
    try {
      const response = bankSimulatorClient.invoke('bank_simulator.BankSimulator/ResolveVPA', request);
      
      const duration = Date.now() - start;
      vpaResolutionTrend.add(duration);
      
      const success = check(response, {
        'VPA resolution status is OK': (r) => r.status === grpc.StatusOK,
        'VPA exists': (r) => r.message && r.message.exists === true,
        'Has bank code': (r) => r.message && r.message.bank_code !== '',
        'Has account number': (r) => r.message && r.message.account_number !== '',
        'Response time < 300ms': () => duration < 300,
      });
      
      successRate.add(success);
      
      if (!success) {
        errorCounter.add(1);
        console.error(`VPA resolution failed for ${vpa}:`, response.error || 'Unknown error');
      }
      
    } catch (error) {
      errorCounter.add(1);
      successRate.add(false);
      console.error('VPA resolution error:', error);
    }
  });
}

export function transactionProcessingTest(data) {
  if (!data.accounts || data.accounts.length < 2) {
    console.error('Need at least 2 accounts for transaction testing');
    return;
  }
  
  group('Transaction Processing Load Test', function () {
    const payerAccount = data.accounts[Math.floor(Math.random() * data.accounts.length)];
    const payeeAccount = data.accounts[Math.floor(Math.random() * data.accounts.length)];
    
    // Skip if same account
    if (payerAccount.accountNumber === payeeAccount.accountNumber) {
      return;
    }
    
    const transactionId = `LOAD_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    
    // Debit transaction
    const debitRequest = {
      transaction_id: transactionId + '_DEBIT',
      bank_code: 'HDFC',
      account_number: payerAccount.accountNumber,
      amount_paisa: 10000, // 100 INR
      type: 1, // DEBIT
      reference: 'LOAD_TEST',
      description: 'Load test transaction - debit',
      metadata: {
        test_type: 'load_test',
        payer: payerAccount.accountNumber,
        payee: payeeAccount.accountNumber,
      },
      initiated_at: {
        seconds: Math.floor(Date.now() / 1000),
        nanos: (Date.now() % 1000) * 1000000,
      },
    };
    
    const start = Date.now();
    
    try {
      const debitResponse = bankSimulatorClient.invoke('bank_simulator.BankSimulator/ProcessTransaction', debitRequest);
      
      const debitDuration = Date.now() - start;
      
      const debitSuccess = check(debitResponse, {
        'Debit transaction status is OK': (r) => r.status === grpc.StatusOK,
        'Debit transaction successful': (r) => r.message && r.message.status === 2, // SUCCESS
        'Has bank reference ID': (r) => r.message && r.message.bank_reference_id !== '',
        'Debit response time < 500ms': () => debitDuration < 500,
      });
      
      if (debitSuccess) {
        // Credit transaction
        const creditRequest = {
          transaction_id: transactionId + '_CREDIT',
          bank_code: 'HDFC',
          account_number: payeeAccount.accountNumber,
          amount_paisa: 10000, // 100 INR
          type: 2, // CREDIT
          reference: 'LOAD_TEST',
          description: 'Load test transaction - credit',
          metadata: {
            test_type: 'load_test',
            payer: payerAccount.accountNumber,
            payee: payeeAccount.accountNumber,
            debit_ref: debitResponse.message.bank_reference_id,
          },
          initiated_at: {
            seconds: Math.floor(Date.now() / 1000),
            nanos: (Date.now() % 1000) * 1000000,
          },
        };
        
        const creditStart = Date.now();
        const creditResponse = bankSimulatorClient.invoke('bank_simulator.BankSimulator/ProcessTransaction', creditRequest);
        const creditDuration = Date.now() - creditStart;
        
        const creditSuccess = check(creditResponse, {
          'Credit transaction status is OK': (r) => r.status === grpc.StatusOK,
          'Credit transaction successful': (r) => r.message && r.message.status === 2, // SUCCESS
          'Credit response time < 500ms': () => creditDuration < 500,
        });
        
        const totalDuration = debitDuration + creditDuration;
        transactionTrend.add(totalDuration);
        successRate.add(debitSuccess && creditSuccess);
        
        if (!creditSuccess) {
          errorCounter.add(1);
          console.error(`Credit transaction failed for ${transactionId}:`, creditResponse.error || 'Unknown error');
        }
      } else {
        errorCounter.add(1);
        successRate.add(false);
        console.error(`Debit transaction failed for ${transactionId}:`, debitResponse.error || 'Unknown error');
      }
      
    } catch (error) {
      errorCounter.add(1);
      successRate.add(false);
      console.error('Transaction processing error:', error);
    }
  });
}

export function stressTest(data) {
  // Stress test combines both VPA resolution and transaction processing
  if (Math.random() < 0.5) {
    vpaResolutionTest(data);
  } else {
    transactionProcessingTest(data);
  }
}

export function teardown(data) {
  console.log('Tearing down test environment...');
  
  // Close gRPC connections
  bankSimulatorClient.close();
  upiCoreClient.close();
  
  console.log('Test summary:');
  console.log(`- Created ${data.accounts ? data.accounts.length : 0} test accounts`);
  console.log(`- Created ${data.vpas ? data.vpas.length : 0} test VPAs`);
  console.log('Load test completed');
}

// Export functions for manual testing
export {
  bankSimulatorClient,
  upiCoreClient,
};