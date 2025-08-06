# Live Classes Service TODO

> Interactive streaming platform with WebRTC SFU implementation for real-time education

## Implementation Timeline (Weeks 13-18)

### Week 13: Core WebRTC Infrastructure
- [x] Setup mediasoup server infrastructure
- [ ] Implement SFU (Selective Forwarding Unit) core
- [ ] WebRTC peer connection management
- [ ] Room management system
- [ ] Basic signaling server with Socket.IO

### Week 14: Real-time Communication Features
- [ ] Multi-participant video/audio streaming
- [ ] Screen sharing capabilities
- [ ] Chat system with message persistence
- [ ] Whiteboard collaborative features
- [ ] Participant controls (mute/unmute, video on/off)

### Week 15: Recording Pipeline
- [ ] Multi-quality stream recording (360p, 720p, 1080p)
- [ ] Real-time stream composition
- [ ] Recording state management
- [ ] Cloud storage integration (S3/GCS)
- [ ] Post-processing pipeline

### Week 16: Advanced Features
- [ ] Breakout room functionality
- [ ] Hand raise and presenter controls
- [ ] File sharing and annotations
- [ ] Attendance tracking
- [ ] Session analytics collection

### Week 17: Performance & Scaling
- [ ] Load balancing for mediasoup workers
- [ ] Connection quality monitoring
- [ ] Adaptive bitrate for poor networks
- [ ] Geographic load distribution
- [ ] Auto-scaling based on room occupancy

### Week 18: Testing & Optimization
- [ ] Load testing with 1000+ concurrent users
- [ ] Network resilience testing
- [ ] Mobile client optimization
- [ ] Performance monitoring dashboard
- [ ] Security audit and penetration testing

## Technical Architecture

### Core Components

#### WebRTC SFU with Mediasoup
```typescript
// Core mediasoup router configuration
interface RouterConfig {
  mediaCodecs: MediaCodec[];
  webRtcTransportOptions: WebRtcTransportOptions;
  plainTransportOptions: PlainTransportOptions;
}

// Room management
class LiveClassRoom {
  private router: Router;
  private transports: Map<string, Transport>;
  private producers: Map<string, Producer>;
  private consumers: Map<string, Consumer>;
  
  async createWebRtcTransport(socketId: string): Promise<Transport>;
  async produce(transportId: string, rtpParameters: RtpParameters): Promise<Producer>;
  async consume(producerId: string, rtpCapabilities: RtpCapabilities): Promise<Consumer>;
}
```

#### Real-time Chat System
```typescript
// Chat message structure
interface ChatMessage {
  id: string;
  roomId: string;
  userId: string;
  message: string;
  timestamp: Date;
  messageType: 'text' | 'emoji' | 'file' | 'poll';
  metadata?: Record<string, any>;
}

// Chat service with message ordering
class ChatService {
  private messageQueue: PriorityQueue<ChatMessage>;
  
  async sendMessage(message: ChatMessage): Promise<void>;
  async getMessageHistory(roomId: string, limit: number): Promise<ChatMessage[]>;
  async moderateMessage(messageId: string, action: 'delete' | 'flag'): Promise<void>;
}
```

#### Recording Pipeline
```typescript
// Multi-quality recording configuration
interface RecordingConfig {
  qualities: Array<{
    width: number;
    height: number;
    bitrate: number;
    framerate: number;
  }>;
  audioConfig: {
    sampleRate: number;
    channels: number;
    bitrate: number;
  };
  outputFormat: 'mp4' | 'webm' | 'hls';
}

class RecordingPipeline {
  private ffmpegProcesses: Map<string, ChildProcess>;
  
  async startRecording(roomId: string, config: RecordingConfig): Promise<void>;
  async stopRecording(roomId: string): Promise<string[]>; // Returns file URLs
  async composeStreams(streams: MediaStream[], layout: string): Promise<MediaStream>;
}
```

### Data Structures & Algorithms

#### Priority Queue for Message Ordering
```typescript
class MessagePriorityQueue {
  private heap: ChatMessage[] = [];
  
  // Ensures messages are delivered in timestamp order
  enqueue(message: ChatMessage): void {
    this.heap.push(message);
    this.bubbleUp(this.heap.length - 1);
  }
  
  dequeue(): ChatMessage | null {
    if (this.heap.length === 0) return null;
    
    const result = this.heap[0];
    const last = this.heap.pop()!;
    
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    
    return result;
  }
  
  private compare(a: ChatMessage, b: ChatMessage): boolean {
    return a.timestamp.getTime() < b.timestamp.getTime();
  }
}
```

#### Consistent Hashing for Load Distribution
```typescript
class MediaServerRouter {
  private servers: Map<string, MediaServer> = new Map();
  private ring: Array<{hash: number, serverId: string}> = [];
  
  addServer(server: MediaServer): void {
    const serverId = server.id;
    
    // Add 150 virtual nodes per server
    for (let i = 0; i < 150; i++) {
      const hash = this.hash(`${serverId}:${i}`);
      this.ring.push({hash, serverId});
    }
    
    this.ring.sort((a, b) => a.hash - b.hash);
    this.servers.set(serverId, server);
  }
  
  getServer(roomId: string): MediaServer {
    const hash = this.hash(roomId);
    const index = this.findServerIndex(hash);
    const serverId = this.ring[index].serverId;
    return this.servers.get(serverId)!;
  }
}
```

### Performance Targets

#### Concurrent Users
- **Development**: 100 concurrent users per room
- **Production**: 1,000+ concurrent users per room
- **Scale Target**: 10,000+ concurrent users across all rooms

#### Latency Requirements
- **Signaling Latency**: < 100ms
- **Media Latency**: < 300ms (WebRTC P2P)
- **Chat Messages**: < 50ms delivery
- **Screen Share**: < 500ms

#### Quality Metrics
- **Video Quality**: Up to 1080p @ 30fps
- **Audio Quality**: 48kHz stereo, 128kbps
- **Connection Success Rate**: > 99.5%
- **Media Quality Score**: > 4.5/5 (MOS)

## Media Processing Algorithms

### Adaptive Bitrate Control
```typescript
class AdaptiveBitrateController {
  private networkStats: NetworkStats;
  private qualityLevels = [
    { width: 320, height: 240, bitrate: 150000 },   // 240p
    { width: 640, height: 360, bitrate: 400000 },   // 360p
    { width: 1280, height: 720, bitrate: 1200000 }, // 720p
    { width: 1920, height: 1080, bitrate: 2500000 } // 1080p
  ];
  
  selectOptimalQuality(availableBandwidth: number, rtt: number): QualityLevel {
    // Consider bandwidth, RTT, and packet loss
    const adjustedBandwidth = availableBandwidth * 0.8; // Safety margin
    
    return this.qualityLevels
      .filter(level => level.bitrate <= adjustedBandwidth)
      .pop() || this.qualityLevels[0];
  }
  
  async adjustProducerBitrate(producer: Producer, targetBitrate: number): Promise<void> {
    await producer.setMaxSpatialLayer(this.getSpatialLayer(targetBitrate));
  }
}
```

### Audio Processing Pipeline
```typescript
class AudioProcessor {
  // Noise suppression and echo cancellation
  async processAudioStream(inputStream: MediaStream): Promise<MediaStream> {
    const audioContext = new AudioContext();
    const source = audioContext.createMediaStreamSource(inputStream);
    
    // Apply noise gate
    const noiseGate = this.createNoiseGate(audioContext);
    // Apply compressor for consistent levels
    const compressor = audioContext.createDynamicsCompressor();
    // Apply EQ for voice clarity
    const eq = this.createVoiceEQ(audioContext);
    
    source.connect(noiseGate)
          .connect(compressor)
          .connect(eq)
          .connect(audioContext.destination);
    
    return audioContext.createMediaStreamDestination().stream;
  }
}
```

## CDN Distribution Strategy

### Multi-CDN Architecture
```typescript
interface CDNProvider {
  name: string;
  regions: string[];
  latencyThreshold: number;
  costPerGB: number;
  reliability: number;
}

class CDNOrchestrator {
  private providers: CDNProvider[] = [
    { name: 'CloudFront', regions: ['us-east-1', 'eu-west-1'], latencyThreshold: 50, costPerGB: 0.085, reliability: 0.999 },
    { name: 'Fastly', regions: ['us-west-1', 'ap-southeast-1'], latencyThreshold: 40, costPerGB: 0.12, reliability: 0.9995 },
    { name: 'Cloudflare', regions: ['global'], latencyThreshold: 45, costPerGB: 0.10, reliability: 0.9998 }
  ];
  
  selectOptimalCDN(userLocation: GeoLocation, contentSize: number): CDNProvider {
    return this.providers
      .filter(provider => this.isInRegion(userLocation, provider.regions))
      .sort((a, b) => this.calculateScore(a, userLocation) - this.calculateScore(b, userLocation))[0];
  }
}
```

## Security Implementation

### End-to-End Encryption for Chat
```typescript
class SecureChatService {
  private keyManager: CryptoKeyManager;
  
  async encryptMessage(message: string, roomId: string): Promise<EncryptedMessage> {
    const roomKey = await this.keyManager.getRoomKey(roomId);
    const iv = crypto.getRandomValues(new Uint8Array(16));
    
    const encryptedData = await crypto.subtle.encrypt(
      { name: 'AES-GCM', iv },
      roomKey,
      new TextEncoder().encode(message)
    );
    
    return {
      encryptedData: Array.from(new Uint8Array(encryptedData)),
      iv: Array.from(iv),
      timestamp: Date.now()
    };
  }
}
```

## Monitoring & Observability

### Real-time Metrics Collection
```typescript
interface StreamMetrics {
  roomId: string;
  participantCount: number;
  totalBandwidth: number;
  averageLatency: number;
  packetLossRate: number;
  qualityScore: number;
  cpuUsage: number;
  memoryUsage: number;
}

class MetricsCollector {
  private metricsBuffer: CircularBuffer<StreamMetrics>;
  
  async collectRoomMetrics(roomId: string): Promise<StreamMetrics> {
    const room = await this.getRoomInstance(roomId);
    
    return {
      roomId,
      participantCount: room.getParticipantCount(),
      totalBandwidth: room.calculateTotalBandwidth(),
      averageLatency: await room.calculateAverageLatency(),
      packetLossRate: room.getPacketLossRate(),
      qualityScore: room.calculateQualityScore(),
      cpuUsage: await this.getCPUUsage(),
      memoryUsage: await this.getMemoryUsage()
    };
  }
}
```

## Learning Concepts Focus

### 1. Priority Queues
- Message ordering in chat systems
- Quality adaptation algorithms
- Bandwidth allocation prioritization

### 2. Consistent Hashing
- Media server load distribution
- Room assignment optimization
- Failover and replica management

### 3. Media Codecs
- H.264/H.265 for video compression
- Opus audio codec optimization
- VP8/VP9 WebRTC standards

### 4. Real-time Systems
- Low-latency communication protocols
- Buffer management and jitter control
- Synchronization across multiple streams

## Development Environment Setup

### Required Dependencies
```json
{
  "dependencies": {
    "mediasoup": "^3.12.0",
    "socket.io": "^4.7.0",
    "express": "^4.18.0",
    "redis": "^4.6.0",
    "bull": "^4.10.0",
    "winston": "^3.8.0",
    "ffmpeg-static": "^5.1.0",
    "@types/node": "^18.15.0"
  },
  "devDependencies": {
    "jest": "^29.5.0",
    "supertest": "^6.3.0",
    "typescript": "^5.0.0"
  }
}
```

### Docker Configuration
```dockerfile
FROM node:18-alpine

# Install FFmpeg for media processing
RUN apk add --no-cache ffmpeg

# Install system dependencies for mediasoup
RUN apk add --no-cache \
  build-base \
  python3 \
  py3-pip \
  net-tools

WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production

COPY . .
EXPOSE 3000 40000-49999/udp

CMD ["npm", "start"]
```

## Testing Strategy

### Load Testing Scenarios
```javascript
// K6 load testing script
import ws from 'k6/ws';
import { check } from 'k6';

export let options = {
  stages: [
    { duration: '2m', target: 100 },   // Ramp up to 100 users
    { duration: '5m', target: 500 },   // Ramp up to 500 users  
    { duration: '10m', target: 1000 }, // Stay at 1000 users
    { duration: '2m', target: 0 }      // Ramp down
  ]
};

export default function() {
  const url = 'ws://localhost:3000/socket.io/';
  const response = ws.connect(url, {}, function(socket) {
    socket.on('open', () => {
      socket.send(JSON.stringify({
        event: 'join-room',
        data: { roomId: 'test-room-1', userId: 'user-${__VU}' }
      }));
    });
  });
  
  check(response, { 'Connected successfully': (r) => r && r.status === 101 });
}
```

## Deployment Architecture

### Kubernetes Manifests
- Mediasoup server pods with UDP port allocation
- Redis cluster for session management
- NGINX ingress for WebSocket termination
- Horizontal Pod Autoscaler based on CPU/memory
- Service mesh (Istio) for traffic management

### Monitoring Stack
- Prometheus metrics collection
- Grafana dashboards for real-time monitoring  
- Jaeger for distributed tracing
- Custom alerts for connection failures and quality degradation

---

**Next Phase**: Integration with VOD service for session recordings and Creator Studio for analytics dashboard.