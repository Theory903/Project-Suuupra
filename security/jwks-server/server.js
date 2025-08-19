const http = require('http');
const crypto = require('crypto');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3000;

// Generate or load RSA key pair
function generateOrLoadKeys() {
    const keyPath = path.join(__dirname, 'keys', 'private.pem');
    const pubKeyPath = path.join(__dirname, 'keys', 'public.pem');
    
    if (!fs.existsSync(path.dirname(keyPath))) {
        fs.mkdirSync(path.dirname(keyPath), { recursive: true });
    }

    if (fs.existsSync(keyPath) && fs.existsSync(pubKeyPath)) {
        return {
            private: fs.readFileSync(keyPath, 'utf8'),
            public: fs.readFileSync(pubKeyPath, 'utf8')
        };
    }

    // Generate new key pair
    const { publicKey, privateKey } = crypto.generateKeyPairSync('rsa', {
        modulusLength: 2048,
        publicKeyEncoding: {
            type: 'spki',
            format: 'pem'
        },
        privateKeyEncoding: {
            type: 'pkcs8',
            format: 'pem'
        }
    });

    fs.writeFileSync(keyPath, privateKey);
    fs.writeFileSync(pubKeyPath, publicKey);

    return { private: privateKey, public: publicKey };
}

// Convert PEM to JWK format
function pemToJwk(publicKey) {
    const key = crypto.createPublicKey(publicKey);
    const jwk = key.export({ format: 'jwk' });
    
    return {
        kty: jwk.kty,
        use: 'sig',
        kid: 'suuupra-key-1',
        alg: 'RS256',
        n: jwk.n,
        e: jwk.e
    };
}

const keys = generateOrLoadKeys();
const jwk = pemToJwk(keys.public);

const jwks = {
    keys: [jwk]
};

const server = http.createServer((req, res) => {
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.writeHead(200);
        res.end();
        return;
    }

    if (req.url === '/.well-known/jwks.json' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify(jwks, null, 2));
        return;
    }

    if (req.url === '/health' && req.method === 'GET') {
        res.writeHead(200, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ status: 'healthy', timestamp: new Date().toISOString() }));
        return;
    }

    res.writeHead(404, { 'Content-Type': 'text/plain' });
    res.end('Not Found');
});

server.listen(PORT, '0.0.0.0', () => {
    console.log(`JWKS Server running on port ${PORT}`);
    console.log(`JWKS endpoint: http://localhost:${PORT}/.well-known/jwks.json`);
});

process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    server.close(() => {
        process.exit(0);
    });
});
