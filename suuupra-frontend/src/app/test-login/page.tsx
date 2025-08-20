'use client';

import { useState } from 'react';

export default function TestLoginPage() {
  const [result, setResult] = useState<string>('');
  const [loading, setLoading] = useState(false);

  const testDirectAPI = async () => {
    setLoading(true);
    try {
      console.log('🚀 Testing API URL:', process.env.NEXT_PUBLIC_API_URL);
      
      const response = await fetch('http://localhost:8080/identity/api/v1/auth/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'newuser@example.com',
          password: 'SecurePass123!'
        })
      });
      
      console.log('📡 Response status:', response.status);
      const data = await response.json();
      console.log('📊 Response data:', data);
      
      setResult(`✅ SUCCESS: ${JSON.stringify(data, null, 2)}`);
    } catch (error: any) {
      console.error('❌ Error details:', error);
      setResult(`❌ ERROR: ${error.message}\nType: ${error.name}\nStack: ${error.stack}`);
    } finally {
      setLoading(false);
    }
  };

  const testWithAxios = async () => {
    setLoading(true);
    try {
      const { AuthService } = await import('@/lib/api');
      console.log('🚀 Testing with AuthService...');
      
      const result = await AuthService.login('newuser@example.com', 'SecurePass123!');
      console.log('📊 AuthService result:', result);
      
      setResult(`✅ AUTHSERVICE SUCCESS: ${JSON.stringify(result, null, 2)}`);
    } catch (error: any) {
      console.error('❌ AuthService Error:', error);
      setResult(`❌ AUTHSERVICE ERROR: ${error.message}\nResponse: ${JSON.stringify(error.response?.data)}\nStatus: ${error.response?.status}`);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8 text-center">🔧 API Debug Page</h1>
        
        <div className="grid gap-6">
          <div className="bg-white/10 p-6 rounded-lg">
            <h2 className="text-xl font-semibold mb-4">Environment Check</h2>
            <div className="space-y-2 text-sm">
              <div>NEXT_PUBLIC_API_URL: <code className="bg-white/20 px-2 py-1 rounded">{process.env.NEXT_PUBLIC_API_URL || 'undefined'}</code></div>
              <div>Fallback URL: <code className="bg-white/20 px-2 py-1 rounded">http://localhost:8080</code></div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <button
              onClick={testDirectAPI}
              disabled={loading}
              className="bg-blue-600 hover:bg-blue-700 px-6 py-4 rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? '⏳' : '🧪'} Test Direct Fetch API
            </button>
            
            <button
              onClick={testWithAxios}
              disabled={loading}
              className="bg-purple-600 hover:bg-purple-700 px-6 py-4 rounded-lg font-semibold disabled:opacity-50"
            >
              {loading ? '⏳' : '📡'} Test AuthService (Axios)
            </button>
          </div>
        </div>

        <div className="mt-8 bg-white/10 p-6 rounded-lg">
          <h2 className="text-xl font-semibold mb-4">Test Results</h2>
          <pre className="text-sm overflow-auto bg-black/50 p-4 rounded whitespace-pre-wrap">
            {result || 'No test run yet...'}
          </pre>
        </div>
      </div>
    </div>
  );
}
