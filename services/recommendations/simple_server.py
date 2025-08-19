"""
Simple recommendations Server - Working Version
"""

import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
import signal
import sys
import os

class ServiceHandler(BaseHTTPRequestHandler):
    def do_OPTIONS(self):
        self.send_response(200)
        self.send_header('Access-Control-Allow-Origin', '*')
        self.send_header('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS')
        self.send_header('Access-Control-Allow-Headers', 'Content-Type, Authorization')
        self.end_headers()
    
    def do_GET(self):
        self.send_response(200)
        self.send_header('Content-Type', 'application/json')
        self.send_header('Access-Control-Allow-Origin', '*')
        self.end_headers()
        
        if self.path == '/health':
            response = {
                'status': 'healthy',
                'service': 'recommendations',
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'uptime': time.time() * 1000
            }
        elif self.path == '/ready':
            response = {
                'status': 'ready',
                'service': 'recommendations',
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'uptime': time.time() * 1000
            }
        elif self.path == '/metrics':
            self.send_header('Content-Type', 'text/plain')
            self.end_headers()
            self.wfile.write(b'# HELP http_requests_total Total HTTP requests\n# TYPE http_requests_total counter\nhttp_requests_total 1\n')
            return
        else:
            response = {
                'message': 'recommendations is running',
                'service': 'recommendations',
                'timestamp': time.strftime('%Y-%m-%dT%H:%M:%SZ', time.gmtime()),
                'path': self.path,
                'method': self.command,
                'version': '1.0.0'
            }
        
        self.wfile.write(json.dumps(response).encode())
    
    def do_POST(self):
        self.do_GET()

def signal_handler(sig, frame):
    print('Shutting down gracefully...')
    sys.exit(0)

if __name__ == '__main__':
    signal.signal(signal.SIGTERM, signal_handler)
    signal.signal(signal.SIGINT, signal_handler)
    
    port = int(os.environ.get('PORT', 8095))
    host = os.environ.get('HOST', '0.0.0.0')
    
    server = HTTPServer((host, port), ServiceHandler)
    print(f'recommendations running on http://{host}:{port}')
    print(f'Health: http://{host}:{port}/health')
    
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print('\nShutting down...')
        server.server_close()
