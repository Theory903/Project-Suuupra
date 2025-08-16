# Live Classes Service

## Overview
A service that handles live class scheduling, real-time interaction, and streaming capabilities.

## Key Features
- Class scheduling and management
- Real-time chat and interaction between students and instructors
- Live streaming integration
- Class recording and archiving
- Student attendance tracking

## Getting Started
1. Clone the repository
2. Run the setup script
3. Configure the service with your preferred streaming provider
4. Start the service

## Configuration
```yaml
# Example configuration
live_classes:
  streaming_provider: "agora"
  api_key: "your_api_key"
  api_secret: "your_api_secret"
  recording_enabled: true
  max_concurrent_classes: 50
```

## API Reference
- `/api/v1/classes` - List all classes
- `/api/v1/classes/{id}` - Get class details
- `/api/v1/classes/create` - Create a new class
- `/api/v1/classes/join/{class_id}` - Join a class

## Development
- Use the provided Dockerfile for local development
- Run tests with the test script
