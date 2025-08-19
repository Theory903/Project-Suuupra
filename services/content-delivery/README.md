# Content Delivery Network Service

## Overview
High-performance CDN service for delivering static and media content across the Suuupra platform.

## Features
- **Fast Content Delivery**: Global edge locations for minimal latency
- **Auto-scaling**: Dynamic resource allocation based on demand
- **Cache Management**: Intelligent caching with invalidation support
- **Multi-format Support**: Images, videos, documents, and static assets
- **Security**: DDoS protection and access controls

## API Endpoints
- `GET /health` - Health check
- `GET /api/v1/content/{id}` - Serve content
- `POST /api/v1/upload` - Upload content
- `POST /api/v1/cache/invalidate` - Cache invalidation

## Configuration
Set environment variables:
```bash
PORT=3004
CDN_BUCKET=suuupra-cdn
CACHE_TTL=3600
```

## Usage
```bash
npm install
npm start
```