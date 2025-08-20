'use client';

import { useState } from 'react';

export default function DebugPage() {
  const [result, setResult] = useState<string>('');

  const checkEnvironment = () => {
    const envUrl = process.env.NEXT_PUBLIC_API_URL;
    const fallbackUrl = 'http://localhost:8080';
    
    setResult(`Environment Check:
NEXT_PUBLIC_API_URL: ${envUrl || 'undefined'}
Fallback URL: ${fallbackUrl}
Final API Base: ${envUrl || fallbackUrl}

Window Location: ${typeof window !== 'undefined' ? window.location.origin : 'SSR'}
`);
  };

  const testLogin = async () => {
    try {
      setResult('Testing login...');
      
      // Get the API URL
      const apiUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
      const endpoint = `${apiUrl}/identity/api/v1/auth/login`;
      
      console.log('🚀 API Endpoint:', endpoint);
      
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: 'Abhijha93@gmail.com',
          password: 'Admin@123'
        })
      });
      
      console.log('📡 Response status:', response.status);
      console.log('📡 Response headers:', response.headers);
      
      const data = await response.json();
      console.log('📊 Response data:', data);
      
      setResult(`✅ SUCCESS!
Endpoint: ${endpoint}
Status: ${response.status}
Response: ${JSON.stringify(data, null, 2)}`);
      
    } catch (error: any) {
      console.error('❌ Error:', error);
      setResult(`❌ ERROR: ${error.message}
Type: ${error.constructor.name}
Stack: ${error.stack}`);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white p-8">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold mb-8">🔧 Debug Authentication</h1>
        
        <div className="grid gap-4 mb-8">
          <button
            onClick={checkEnvironment}
            className="bg-blue-600 hover:bg-blue-700 px-6 py-3 rounded-lg"
          >
            🔍 Check Environment
          </button>
          
          <button
            onClick={testLogin}
            className="bg-green-600 hover:bg-green-700 px-6 py-3 rounded-lg"
          >
            🧪 Test Login (Abhijha93@gmail.com)
          </button>
        </div>

        <div className="bg-gray-900 p-6 rounded-lg">
          <pre className="text-sm overflow-auto whitespace-pre-wrap">
            {result || 'Click a button to start debugging...'}
          </pre>
        </div>
      </div>
    </div>
  );
}
