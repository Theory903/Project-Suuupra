const express = require('express');
const app = express();
const PORT = process.env.PORT || 8084;
const METRICS_PORT = process.env.METRICS_PORT || 9095;

// Middleware
app.use(express.json());
app.use((req, res, next) => {
    console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
    next();
});

// Health check endpoint
app.get('/health', (req, res) => {
    res.json({ 
        status: 'healthy', 
        service: 'content-delivery',
        timestamp: new Date().toISOString(),
        uptime: process.uptime()
    });
});

// Basic content delivery endpoints
app.get('/', (req, res) => {
    res.json({ 
        service: 'Content Delivery Service',
        version: '1.0.0',
        status: 'running'
    });
});

// Stream endpoint placeholder
app.get('/stream/*', (req, res) => {
    res.json({ 
        message: 'Video streaming endpoint',
        path: req.path,
        status: 'placeholder'
    });
});

// Media endpoint placeholder
app.get('/media/*', (req, res) => {
    res.json({ 
        message: 'Media content endpoint',
        path: req.path,
        status: 'placeholder'
    });
});

// Metrics endpoint for monitoring
const metricsApp = express();
metricsApp.get('/metrics', (req, res) => {
    res.set('Content-Type', 'text/plain');
    res.send(`# HELP content_delivery_requests_total Total number of requests
# TYPE content_delivery_requests_total counter
content_delivery_requests_total 0

# HELP content_delivery_uptime_seconds Uptime in seconds  
# TYPE content_delivery_uptime_seconds gauge
content_delivery_uptime_seconds ${process.uptime()}
`);
});

// Start servers
app.listen(PORT, '0.0.0.0', () => {
    console.log(`Content Delivery Service running on port ${PORT}`);
});

metricsApp.listen(METRICS_PORT, '0.0.0.0', () => {
    console.log(`Metrics server running on port ${METRICS_PORT}`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
    console.log('SIGTERM received, shutting down gracefully');
    process.exit(0);
});

process.on('SIGINT', () => {
    console.log('SIGINT received, shutting down gracefully');
    process.exit(0);
});
