# Video-On-Demand (VOD) Service

## Overview
A service that handles video storage, transcoding, and streaming for on-demand content.

## Key Features
- Video transcoding and format conversion
- Content storage and management
- Adaptive streaming for different devices
- Content protection and DRM
- User viewing history and recommendations

## Getting Started
1. Clone the repository
2. Run the setup script
3. Configure the service with your preferred video storage provider
4. Start the service

## Configuration
```yaml
# Example configuration
vod:
  storage_provider: "aws_s3"
  bucket_name: "your_bucket_name"
  transcoding_enabled: true
  max_video_resolution: "1080p"
  content_protection: "drm"
```

## API Reference
- `/api/v1/videos` - List all videos
- `/api/v1/videos/{id}` - Get video details
- `/api/v1/videos/upload` - Upload a new video
- `/api/v1/videos/stream/{video_id}` - Start video streaming

## Development
- Use the provided Dockerfile for local development
- Run tests with the test script
