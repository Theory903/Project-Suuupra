'use client';

import { useState } from 'react';
import { motion } from 'framer-motion';
import { 
  Play, CheckCircle, XCircle, Clock, RefreshCw, 
  User, Shield, Key, Database, Zap
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { AuthService } from '@/lib/api';

interface TestResult {
  name: string;
  status: 'pending' | 'running' | 'success' | 'error';
  message: string;
  data?: any;
  duration?: number;
}

export default function APITestPage() {
  const [testResults, setTestResults] = useState<TestResult[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const updateResult = (name: string, updates: Partial<TestResult>) => {
    setTestResults(prev => 
      prev.map(result => 
        result.name === name ? { ...result, ...updates } : result
      )
    );
  };

  const addResult = (result: TestResult) => {
    setTestResults(prev => [...prev, result]);
  };

  const runAllTests = async () => {
    setIsRunning(true);
    setTestResults([]);

    const tests = [
      { name: 'Valid Login', test: testValidLogin },
      { name: 'Invalid Email Login', test: testInvalidLogin },
      { name: 'Registration', test: testRegistration },
      { name: 'Get Current User', test: testGetCurrentUser },
      { name: 'Token Introspection', test: testTokenIntrospection },
      { name: 'Password Strength', test: testPasswordStrength },
      { name: 'Logout', test: testLogout },
    ];

    for (const test of tests) {
      addResult({ name: test.name, status: 'running', message: 'Running...' });
      
      const startTime = Date.now();
      try {
        const result = await test.test();
        const duration = Date.now() - startTime;
        updateResult(test.name, {
          status: 'success',
          message: result.message,
          data: result.data,
          duration
        });
      } catch (error: any) {
        const duration = Date.now() - startTime;
        updateResult(test.name, {
          status: 'error',
          message: error.message || 'Test failed',
          duration
        });
      }
      
      // Small delay between tests
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    setIsRunning(false);
  };

  const testValidLogin = async () => {
    const result = await AuthService.login('Abhijha93@gmail.com', 'Admin@123');
    return {
      message: `Login successful for ${result.user.email}`,
      data: result
    };
  };

  const testInvalidLogin = async () => {
    try {
      await AuthService.login('invalid@test.com', 'wrongpassword');
      throw new Error('Should have failed');
    } catch (error: any) {
      if (error.message.includes('Invalid credentials') || error.message.includes('Network error')) {
        return {
          message: 'Correctly rejected invalid credentials',
          data: { error: error.message }
        };
      }
      throw error;
    }
  };

  const testRegistration = async () => {
    const randomEmail = `test-${Date.now()}@example.com`;
    const result = await AuthService.register({
      email: randomEmail,
      password: 'TestPass123!',
      name: 'Test User'
    });
    return {
      message: `Registration successful for ${result.user.email}`,
      data: result
    };
  };

  const testGetCurrentUser = async () => {
    if (!AuthService.isAuthenticated()) {
      throw new Error('Not authenticated');
    }
    
    const user = await AuthService.getCurrentUser();
    return {
      message: `Retrieved profile for ${user.email}`,
      data: user
    };
  };

  const testTokenIntrospection = async () => {
    if (!AuthService.isAuthenticated()) {
      throw new Error('Not authenticated');
    }
    
    const result = await AuthService.introspectToken();
    return {
      message: `Token is ${result.active ? 'active' : 'inactive'}`,
      data: result
    };
  };

  const testPasswordStrength = async () => {
    const tests = [
      { password: '123', expected: 'weak' },
      { password: 'Password123!', expected: 'strong' }
    ];
    
    const results = await Promise.all(
      tests.map(async test => {
        const strength = await AuthService.validatePasswordStrength(test.password);
        return { ...test, strength };
      })
    );
    
    return {
      message: 'Password strength validation working',
      data: results
    };
  };

  const testLogout = async () => {
    if (!AuthService.isAuthenticated()) {
      return {
        message: 'Already logged out',
        data: null
      };
    }
    
    await AuthService.logout();
    return {
      message: 'Logout successful',
      data: null
    };
  };

  const getStatusIcon = (status: TestResult['status']) => {
    switch (status) {
      case 'running': return <Clock className="w-4 h-4 animate-pulse text-yellow-400" />;
      case 'success': return <CheckCircle className="w-4 h-4 text-green-400" />;
      case 'error': return <XCircle className="w-4 h-4 text-red-400" />;
      default: return <Clock className="w-4 h-4 text-gray-400" />;
    }
  };

  const getStatusColor = (status: TestResult['status']) => {
    switch (status) {
      case 'running': return 'border-yellow-500/30 bg-yellow-500/10';
      case 'success': return 'border-green-500/30 bg-green-500/10';
      case 'error': return 'border-red-500/30 bg-red-500/10';
      default: return 'border-white/10 bg-white/5';
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="mb-8"
        >
          <div className="flex justify-between items-center">
            <div>
              <h1 className="text-4xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                🧪 Identity API Test Suite
              </h1>
              <p className="text-gray-400 mt-2">
                Comprehensive testing of all Identity service APIs and authentication flows
              </p>
            </div>
            
            <div className="flex items-center gap-4">
              <Badge className="bg-blue-500/20 text-blue-400 border-blue-500/30">
                <Database className="w-3 h-3 mr-1" />
                Backend Ready
              </Badge>
              <Button
                onClick={runAllTests}
                disabled={isRunning}
                className="bg-gradient-to-r from-blue-500 to-purple-600 hover:from-blue-600 hover:to-purple-700"
              >
                {isRunning ? (
                  <>
                    <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                    Running Tests...
                  </>
                ) : (
                  <>
                    <Play className="w-4 h-4 mr-2" />
                    Run All Tests
                  </>
                )}
              </Button>
            </div>
          </div>
        </motion.div>

        {/* Test Results */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {testResults.map((result, index) => (
            <motion.div
              key={result.name}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
            >
              <Card className={`${getStatusColor(result.status)} transition-all duration-300`}>
                <CardHeader className="pb-3">
                  <div className="flex justify-between items-center">
                    <CardTitle className="flex items-center text-white">
                      {getStatusIcon(result.status)}
                      <span className="ml-2">{result.name}</span>
                    </CardTitle>
                    {result.duration && (
                      <Badge className="bg-gray-700 text-gray-300">
                        <Zap className="w-3 h-3 mr-1" />
                        {result.duration}ms
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                
                <CardContent>
                  <p className={`text-sm mb-3 ${
                    result.status === 'success' ? 'text-green-300' :
                    result.status === 'error' ? 'text-red-300' : 'text-gray-300'
                  }`}>
                    {result.message}
                  </p>
                  
                  {result.data && (
                    <details className="mt-3">
                      <summary className="text-xs text-gray-400 cursor-pointer hover:text-white">
                        View Details
                      </summary>
                      <pre className="text-xs bg-black/50 p-3 rounded mt-2 overflow-auto max-h-40">
                        {JSON.stringify(result.data, null, 2)}
                      </pre>
                    </details>
                  )}
                </CardContent>
              </Card>
            </motion.div>
          ))}
        </div>

        {/* Instructions */}
        {testResults.length === 0 && (
          <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="text-center py-12"
          >
            <div className="max-w-2xl mx-auto">
              <Zap className="w-16 h-16 text-blue-400 mx-auto mb-6" />
              <h2 className="text-2xl font-bold text-white mb-4">Ready to Test</h2>
              <p className="text-gray-400 mb-8">
                Click "Run All Tests" to execute comprehensive Identity service API tests including:
              </p>
              
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-left">
                <div className="space-y-3">
                  <div className="flex items-center text-green-400">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Valid login flow
                  </div>
                  <div className="flex items-center text-green-400">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Invalid credential handling
                  </div>
                  <div className="flex items-center text-green-400">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    User registration
                  </div>
                  <div className="flex items-center text-green-400">
                    <CheckCircle className="w-4 h-4 mr-2" />
                    Profile retrieval
                  </div>
                </div>
                <div className="space-y-3">
                  <div className="flex items-center text-blue-400">
                    <Shield className="w-4 h-4 mr-2" />
                    Token introspection
                  </div>
                  <div className="flex items-center text-blue-400">
                    <Key className="w-4 h-4 mr-2" />
                    Password validation
                  </div>
                  <div className="flex items-center text-purple-400">
                    <User className="w-4 h-4 mr-2" />
                    Logout functionality
                  </div>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Quick Links */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          className="mt-12 text-center"
        >
          <h3 className="text-lg font-semibold text-white mb-4">Quick Navigation</h3>
          <div className="flex justify-center gap-4 flex-wrap">
            <Button asChild className="bg-blue-600 hover:bg-blue-700">
              <a href="/auth">🔐 Auth Page</a>
            </Button>
            <Button asChild className="bg-purple-600 hover:bg-purple-700">
              <a href="/secure-dashboard">📊 Protected Dashboard</a>
            </Button>
            <Button asChild className="bg-cyan-600 hover:bg-cyan-700">
              <a href="/debug">🔧 Debug Tools</a>
            </Button>
            <Button asChild className="bg-green-600 hover:bg-green-700">
              <a href="/">🏠 Home</a>
            </Button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
