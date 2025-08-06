# VOD (Video-on-Demand) Service TODO

> High-performance video processing and streaming service with FFmpeg transcoding and adaptive bitrate streaming

## Implementation Timeline (Weeks 13-18)

### Week 13: Core Video Processing Infrastructure
- [x] Setup FFmpeg transcoding pipeline
- [ ] Implement video upload and validation
- [ ] Basic transcoding queue with Bull
- [ ] S3/GCS storage integration
- [ ] Video metadata extraction and storage

### Week 14: Multi-Quality Transcoding
- [ ] Adaptive bitrate transcoding (240p, 360p, 720p, 1080p, 4K)
- [ ] Audio track processing and normalization
- [ ] Thumbnail generation at multiple timestamps
- [ ] Video duration and size optimization
- [ ] Parallel processing for faster transcoding

### Week 15: HLS/DASH Streaming Implementation
- [ ] HLS (HTTP Live Streaming) manifest generation
- [ ] DASH (Dynamic Adaptive Streaming) support
- [ ] Segment-based streaming with CDN optimization
- [ ] Encryption and DRM integration (Widevine, FairPlay)
- [ ] Subtitle and caption processing

### Week 16: Advanced Features
- [ ] Video watermarking and branding
- [ ] Content-aware transcoding optimization
- [ ] AI-powered video analysis (scenes, objects, faces)
- [ ] Chapter marking and timestamp indexing
- [ ] Multi-language audio track support

### Week 17: Performance & Scaling
- [ ] Distributed transcoding across multiple workers
- [ ] GPU acceleration for faster processing
- [ ] Caching strategies for popular content
- [ ] Geographic distribution optimization
- [ ] Auto-scaling based on queue depth

### Week 18: Testing & Optimization
- [ ] Load testing with 10,000+ concurrent streams
- [ ] Quality assessment automation
- [ ] Performance monitoring and alerting
- [ ] CDN integration testing
- [ ] Security and DRM validation

## Technical Architecture

### Core Components

#### Video Processing Pipeline
```typescript
interface VideoProcessingJob {
  id: string;
  sourceUrl: string;
  outputBucket: string;
  qualityLevels: QualityLevel[];
  processingOptions: {
    extractThumbnails: boolean;
    generatePreview: boolean;
    addWatermark: boolean;
    enableDRM: boolean;
  };
  metadata: VideoMetadata;
}

class VideoProcessor {
  private ffmpegQueue: Queue;
  private storageClient: StorageClient;
  
  async processVideo(job: VideoProcessingJob): Promise<ProcessingResult> {
    const inputPath = await this.downloadSource(job.sourceUrl);
    const outputs: TranscodingOutput[] = [];
    
    // Process multiple quality levels in parallel
    const promises = job.qualityLevels.map(level => 
      this.transcodeToQuality(inputPath, level)
    );
    
    const results = await Promise.all(promises);
    
    // Generate HLS playlist
    const hlsManifest = await this.generateHLSPlaylist(results);
    
    return {
      outputs: results,
      hlsManifest,
      thumbnails: await this.generateThumbnails(inputPath),
      duration: await this.getVideoDuration(inputPath)
    };
  }
}
```

#### Adaptive Bitrate Configuration
```typescript
interface QualityLevel {
  name: string;
  width: number;
  height: number;
  videoBitrate: number; // bits per second
  audioBitrate: number;
  framerate: number;
  codec: 'h264' | 'h265' | 'vp9' | 'av1';
  profile: string;
}

const QUALITY_PRESETS: QualityLevel[] = [
  {
    name: '240p',
    width: 426,
    height: 240,
    videoBitrate: 400_000,
    audioBitrate: 64_000,
    framerate: 25,
    codec: 'h264',
    profile: 'baseline'
  },
  {
    name: '360p', 
    width: 640,
    height: 360,
    videoBitrate: 800_000,
    audioBitrate: 96_000,
    framerate: 30,
    codec: 'h264',
    profile: 'main'
  },
  {
    name: '720p',
    width: 1280,
    height: 720, 
    videoBitrate: 2_500_000,
    audioBitrate: 128_000,
    framerate: 30,
    codec: 'h264',
    profile: 'high'
  },
  {
    name: '1080p',
    width: 1920,
    height: 1080,
    videoBitrate: 5_000_000,
    audioBitrate: 192_000,
    framerate: 30,
    codec: 'h264',
    profile: 'high'
  },
  {
    name: '4K',
    width: 3840,
    height: 2160,
    videoBitrate: 15_000_000,
    audioBitrate: 256_000,
    framerate: 30,
    codec: 'h265',
    profile: 'main'
  }
];
```

#### FFmpeg Integration
```typescript
class FFmpegTranscoder {
  async transcodeVideo(
    inputPath: string,
    outputPath: string,
    quality: QualityLevel,
    options: TranscodeOptions = {}
  ): Promise<TranscodeResult> {
    
    const command = ffmpeg(inputPath)
      .output(outputPath)
      .videoCodec(this.getCodecString(quality.codec))
      .videoBitrate(quality.videoBitrate)
      .size(`${quality.width}x${quality.height}`)
      .fps(quality.framerate)
      .audioCodec('aac')
      .audioBitrate(quality.audioBitrate)
      .audioChannels(2)
      .audioFrequency(48000);
      
    // Add codec-specific options
    if (quality.codec === 'h264') {
      command
        .addOption('-profile:v', quality.profile)
        .addOption('-preset', 'fast')
        .addOption('-crf', '23')
        .addOption('-x264opts', 'keyint=60:min-keyint=60:scenecut=-1');
    }
    
    // Add GPU acceleration if available
    if (options.enableGPU) {
      command.addOption('-hwaccel', 'cuda');
    }
    
    // Progress tracking
    return new Promise((resolve, reject) => {
      let progress: TranscodeProgress = { percent: 0, fps: 0, speed: 0 };
      
      command
        .on('progress', (info) => {
          progress = {
            percent: info.percent || 0,
            fps: info.currentFps || 0,
            speed: parseFloat(info.currentKbps) || 0
          };
          this.emitProgress(quality.name, progress);
        })
        .on('end', () => resolve({ success: true, outputPath, progress }))
        .on('error', reject)
        .run();
    });
  }
}
```

### Data Structures & Algorithms

#### Priority Queue for Processing Jobs
```typescript
interface ProcessingJob {
  id: string;
  priority: number; // 1 (highest) to 10 (lowest)
  estimatedDuration: number;
  submitTime: Date;
  requiredResources: {
    cpu: number;
    memory: number;
    gpu?: boolean;
  };
}

class VideoProcessingQueue {
  private heap: ProcessingJob[] = [];
  
  enqueue(job: ProcessingJob): void {
    this.heap.push(job);
    this.bubbleUp(this.heap.length - 1);
  }
  
  dequeue(): ProcessingJob | null {
    if (this.heap.length === 0) return null;
    
    const result = this.heap[0];
    const last = this.heap.pop()!;
    
    if (this.heap.length > 0) {
      this.heap[0] = last;
      this.bubbleDown(0);
    }
    
    return result;
  }
  
  // Custom comparator considering priority, wait time, and resource efficiency
  private compare(a: ProcessingJob, b: ProcessingJob): boolean {
    // Calculate composite priority score
    const aScore = this.calculatePriorityScore(a);
    const bScore = this.calculatePriorityScore(b);
    return aScore > bScore;
  }
  
  private calculatePriorityScore(job: ProcessingJob): number {
    const waitTime = Date.now() - job.submitTime.getTime();
    const waitPenalty = Math.min(waitTime / (1000 * 60 * 60), 10); // Max 10 hours
    
    // Higher priority = lower number, so invert
    const priorityScore = (11 - job.priority) * 10;
    const waitScore = waitPenalty * 2;
    const efficiencyScore = 100 / job.estimatedDuration; // Favor shorter jobs
    
    return priorityScore + waitScore + efficiencyScore;
  }
}
```

#### Consistent Hashing for CDN Distribution
```typescript
class CDNDistributionManager {
  private cdnNodes: Map<string, CDNNode> = new Map();
  private ring: Array<{hash: number, nodeId: string}> = [];
  private virtualNodes = 150; // Virtual nodes per physical node
  
  addCDNNode(node: CDNNode): void {
    const nodeId = node.id;
    
    // Add virtual nodes for better distribution
    for (let i = 0; i < this.virtualNodes; i++) {
      const hash = this.hash(`${nodeId}:${i}`);
      this.ring.push({hash, nodeId});
    }
    
    this.ring.sort((a, b) => a.hash - b.hash);
    this.cdnNodes.set(nodeId, node);
  }
  
  selectCDNForContent(contentId: string, userLocation: GeoLocation): CDNNode {
    const hash = this.hash(contentId);
    let index = this.findClosestNode(hash);
    
    // Check if selected node serves user's region efficiently
    let node = this.cdnNodes.get(this.ring[index].nodeId)!;
    let attempts = 0;
    
    while (!this.isOptimalForLocation(node, userLocation) && attempts < 5) {
      index = (index + 1) % this.ring.length;
      node = this.cdnNodes.get(this.ring[index].nodeId)!;
      attempts++;
    }
    
    return node;
  }
  
  private isOptimalForLocation(node: CDNNode, location: GeoLocation): boolean {
    const distance = this.calculateDistance(node.location, location);
    const latency = node.averageLatency;
    const load = node.currentLoad / node.maxCapacity;
    
    // Composite score considering distance, latency, and load
    return distance < 500 && latency < 100 && load < 0.8; // km, ms, ratio
  }
}
```

### HLS/DASH Implementation

#### HLS Manifest Generation
```typescript
interface HLSSegment {
  duration: number;
  url: string;
  byteRange?: { length: number; offset: number };
}

class HLSManifestGenerator {
  generateMasterPlaylist(variants: QualityVariant[]): string {
    let manifest = '#EXTM3U\n#EXT-X-VERSION:6\n\n';
    
    variants.forEach(variant => {
      manifest += `#EXT-X-STREAM-INF:BANDWIDTH=${variant.bandwidth},`;
      manifest += `RESOLUTION=${variant.width}x${variant.height},`;
      manifest += `FRAME-RATE=${variant.framerate},`;
      manifest += `CODECS="${variant.codecs}"\n`;
      manifest += `${variant.playlistUrl}\n\n`;
    });
    
    return manifest;
  }
  
  generateMediaPlaylist(segments: HLSSegment[], targetDuration: number): string {
    let manifest = '#EXTM3U\n';
    manifest += `#EXT-X-VERSION:6\n`;
    manifest += `#EXT-X-TARGETDURATION:${targetDuration}\n`;
    manifest += `#EXT-X-MEDIA-SEQUENCE:0\n\n`;
    
    segments.forEach(segment => {
      manifest += `#EXTINF:${segment.duration.toFixed(6)},\n`;
      if (segment.byteRange) {
        manifest += `#EXT-X-BYTERANGE:${segment.byteRange.length}@${segment.byteRange.offset}\n`;
      }
      manifest += `${segment.url}\n`;
    });
    
    manifest += '#EXT-X-ENDLIST\n';
    return manifest;
  }
}
```

#### DASH Manifest (MPD) Generation
```typescript
class DASHManifestGenerator {
  generateMPD(adaptationSets: AdaptationSet[]): string {
    const mpd = `<?xml version="1.0" encoding="UTF-8"?>
<MPD xmlns="urn:mpeg:dash:schema:mpd:2011"
     profiles="urn:mpeg:dash:profile:isoff-live:2011"
     type="static"
     mediaPresentationDuration="PT${this.formatDuration(this.totalDuration)}S"
     minBufferTime="PT2S">
  <Period>
${adaptationSets.map(set => this.generateAdaptationSet(set)).join('\n')}
  </Period>
</MPD>`;
    
    return mpd;
  }
  
  private generateAdaptationSet(set: AdaptationSet): string {
    return `    <AdaptationSet contentType="${set.contentType}" mimeType="${set.mimeType}">
${set.representations.map(rep => this.generateRepresentation(rep)).join('\n')}
    </AdaptationSet>`;
  }
}
```

### Performance Targets

#### Processing Speed
- **720p Video**: < 2x real-time (1 hour video processes in < 30 minutes)
- **1080p Video**: < 3x real-time (1 hour video processes in < 20 minutes)
- **4K Video**: < 5x real-time (1 hour video processes in < 12 minutes)
- **Thumbnail Generation**: < 10 seconds for 10 thumbnails

#### Streaming Performance
- **Startup Time**: < 2 seconds for video playback start
- **Seeking Latency**: < 1 second for seek operations
- **Concurrent Streams**: 10,000+ simultaneous streams
- **CDN Hit Ratio**: > 95% for popular content

#### Quality Metrics
- **PSNR**: > 40 dB for compressed videos
- **SSIM**: > 0.95 for perceptual quality
- **Bitrate Efficiency**: < 10% size increase vs reference encoders
- **Audio Quality**: THD+N < 0.01% for audio processing

## Media Processing Algorithms

### Content-Aware Encoding
```typescript
class ContentAwareEncoder {
  async analyzeContent(videoPath: string): Promise<ContentAnalysis> {
    // Use scene detection to optimize encoding parameters
    const scenes = await this.detectScenes(videoPath);
    const complexity = await this.calculateComplexity(videoPath);
    const motion = await this.analyzeMotion(videoPath);
    
    return {
      sceneChanges: scenes,
      averageComplexity: complexity,
      motionVector: motion,
      recommendedCRF: this.calculateOptimalCRF(complexity, motion),
      keyframeInterval: this.calculateKeyframeInterval(scenes)
    };
  }
  
  private calculateOptimalCRF(complexity: number, motion: number): number {
    // CRF (Constant Rate Factor): lower = higher quality
    const baseCRF = 23;
    
    // Adjust based on content complexity
    let crf = baseCRF;
    if (complexity > 0.8) crf -= 2; // High detail content
    if (complexity < 0.3) crf += 3; // Low detail content
    if (motion > 0.7) crf -= 1;     // High motion content
    
    return Math.max(18, Math.min(28, crf));
  }
}
```

### Perceptual Quality Optimization
```typescript
class PerceptualOptimizer {
  async optimizeBitrate(
    videoPath: string, 
    targetQuality: number // VMAF score 0-100
  ): Promise<BitrateRecommendation> {
    
    const samples = await this.extractSampleFrames(videoPath, 30); // 30 sample points
    const recommendations: BitratePoint[] = [];
    
    // Test different bitrates and measure VMAF
    for (const bitrate of this.testBitrates) {
      const encodedSample = await this.encodeAtBitrate(samples[0], bitrate);
      const vmafScore = await this.calculateVMAF(samples[0], encodedSample);
      
      recommendations.push({ bitrate, vmafScore });
      
      // Stop testing if we've exceeded target quality significantly
      if (vmafScore > targetQuality + 5) break;
    }
    
    // Find optimal bitrate using interpolation
    return this.findOptimalBitrate(recommendations, targetQuality);
  }
  
  private async calculateVMAF(reference: Frame, distorted: Frame): Promise<number> {
    // Use VMAF library for perceptual quality assessment
    const vmafResult = await vmaf.calculate(reference.path, distorted.path);
    return vmafResult.score;
  }
}
```

## DRM and Security Implementation

### Widevine DRM Integration
```typescript
class DRMManager {
  private keySystemConfigs = {
    widevine: {
      keySystem: 'com.widevine.alpha',
      licenseServerUrl: process.env.WIDEVINE_LICENSE_URL,
      certificateUrl: process.env.WIDEVINE_CERT_URL
    },
    fairplay: {
      keySystem: 'com.apple.fps.1_0',
      licenseServerUrl: process.env.FAIRPLAY_LICENSE_URL,
      certificateUrl: process.env.FAIRPLAY_CERT_URL
    }
  };
  
  async encryptContent(
    videoPath: string,
    contentId: string,
    keySystem: 'widevine' | 'fairplay'
  ): Promise<EncryptedContent> {
    
    // Generate content encryption key
    const cek = await this.generateContentKey();
    const keyId = await this.generateKeyId();
    
    // Encrypt using CENC (Common Encryption)
    const encryptedPath = await this.encryptWithCENC(videoPath, cek, keyId);
    
    // Store key metadata
    await this.storeKeyMetadata(contentId, keyId, keySystem);
    
    return {
      encryptedVideoPath: encryptedPath,
      keyId,
      psshData: await this.generatePSSH(keyId, keySystem)
    };
  }
  
  private async encryptWithCENC(
    videoPath: string,
    key: Uint8Array,
    keyId: Uint8Array
  ): Promise<string> {
    const outputPath = videoPath.replace('.mp4', '_encrypted.mp4');
    
    const command = ffmpeg(videoPath)
      .outputFormat('mp4')
      .addOption('-encryption_scheme', 'cenc-aes-ctr')
      .addOption('-encryption_key', Buffer.from(key).toString('hex'))
      .addOption('-encryption_kid', Buffer.from(keyId).toString('hex'))
      .output(outputPath);
      
    await this.runFFmpegCommand(command);
    return outputPath;
  }
}
```

### Token-Based Access Control
```typescript
class VideoAccessControl {
  async generateViewingToken(
    userId: string,
    videoId: string,
    permissions: ViewingPermissions
  ): Promise<ViewingToken> {
    
    const payload = {
      userId,
      videoId,
      permissions: {
        canView: permissions.canView,
        canDownload: permissions.canDownload,
        maxQuality: permissions.maxQuality,
        expiresAt: permissions.expiresAt
      },
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(permissions.expiresAt.getTime() / 1000)
    };
    
    const token = jwt.sign(payload, process.env.JWT_SECRET!, {
      algorithm: 'HS256'
    });
    
    // Store in Redis with TTL
    await this.redis.setex(
      `viewing_token:${userId}:${videoId}`,
      permissions.expiresAt.getTime() - Date.now(),
      token
    );
    
    return { token, expiresAt: permissions.expiresAt };
  }
}
```

## CDN Integration Strategy

### Multi-CDN Load Balancer
```typescript
class MultiCDNLoadBalancer {
  private cdnProviders: CDNProvider[] = [
    {
      name: 'CloudFront',
      endpoints: ['d1234.cloudfront.net', 'd5678.cloudfront.net'],
      healthcheckUrl: '/health',
      priority: 1,
      regions: ['us-east-1', 'us-west-2', 'eu-west-1']
    },
    {
      name: 'Fastly',
      endpoints: ['cdn.fastly.com'],
      healthcheckUrl: '/status',
      priority: 2,
      regions: ['us-west-1', 'ap-southeast-1']
    }
  ];
  
  async selectBestCDN(
    userLocation: GeoLocation,
    videoId: string
  ): Promise<CDNEndpoint> {
    
    // Get health status of all CDNs
    const healthChecks = await Promise.allSettled(
      this.cdnProviders.map(cdn => this.checkCDNHealth(cdn))
    );
    
    const healthyCDNs = this.cdnProviders.filter((_, index) => 
      healthChecks[index].status === 'fulfilled'
    );
    
    // Select based on user location and CDN performance
    const scores = await Promise.all(
      healthyCDNs.map(cdn => this.calculateCDNScore(cdn, userLocation))
    );
    
    const bestCDNIndex = scores.indexOf(Math.max(...scores));
    const bestCDN = healthyCDNs[bestCDNIndex];
    
    return {
      baseUrl: bestCDN.endpoints[0],
      region: this.selectClosestRegion(bestCDN.regions, userLocation),
      cacheKey: this.generateCacheKey(videoId, userLocation)
    };
  }
  
  private async calculateCDNScore(
    cdn: CDNProvider,
    userLocation: GeoLocation
  ): Promise<number> {
    const latency = await this.measureLatency(cdn.endpoints[0]);
    const distance = this.calculateDistance(cdn.regions[0], userLocation);
    const load = await this.getCDNLoad(cdn.name);
    
    // Weighted scoring: latency (50%), distance (30%), load (20%)
    const latencyScore = Math.max(0, 100 - latency);
    const distanceScore = Math.max(0, 100 - distance / 100);
    const loadScore = Math.max(0, 100 - load);
    
    return (latencyScore * 0.5) + (distanceScore * 0.3) + (loadScore * 0.2);
  }
}
```

## Monitoring & Analytics

### Real-time Processing Metrics
```typescript
interface ProcessingMetrics {
  jobsQueued: number;
  jobsProcessing: number;
  jobsCompleted: number;
  jobsFailed: number;
  averageProcessingTime: number;
  throughput: number; // jobs per hour
  resourceUtilization: {
    cpu: number;
    memory: number;
    disk: number;
    gpu?: number;
  };
}

class MetricsCollector {
  private metricsBuffer: CircularBuffer<ProcessingMetrics>;
  
  async collectSystemMetrics(): Promise<ProcessingMetrics> {
    const queueStats = await this.getQueueStatistics();
    const resourceStats = await this.getResourceUtilization();
    
    return {
      jobsQueued: queueStats.waiting,
      jobsProcessing: queueStats.active,
      jobsCompleted: queueStats.completed,
      jobsFailed: queueStats.failed,
      averageProcessingTime: await this.calculateAverageProcessingTime(),
      throughput: await this.calculateThroughput(),
      resourceUtilization: resourceStats
    };
  }
  
  async generatePerformanceReport(): Promise<PerformanceReport> {
    const last24h = this.metricsBuffer.getLastN(1440); // 24 hours of minute-by-minute data
    
    return {
      totalJobsProcessed: last24h.reduce((sum, m) => sum + m.jobsCompleted, 0),
      averageThroughput: this.calculateMean(last24h.map(m => m.throughput)),
      peakThroughput: Math.max(...last24h.map(m => m.throughput)),
      successRate: this.calculateSuccessRate(last24h),
      bottlenecks: await this.identifyBottlenecks(last24h)
    };
  }
}
```

## Development Environment

### Docker Configuration
```dockerfile
FROM node:18-alpine AS builder

# Install build dependencies
RUN apk add --no-cache \
  build-base \
  python3 \
  py3-pip \
  pkgconfig \
  nasm \
  yasm

WORKDIR /app
COPY package*.json ./
RUN npm ci

# Production stage
FROM node:18-alpine AS production

# Install FFmpeg with all codecs
RUN apk add --no-cache \
  ffmpeg \
  x264 \
  x265 \
  libvpx \
  opus \
  lame

# Install GPU support (optional)
RUN apk add --no-cache mesa-dri-gallium

COPY --from=builder /app/node_modules ./node_modules
COPY . .

EXPOSE 3000
CMD ["npm", "start"]
```

### Testing Framework
```typescript
describe('Video Processing Pipeline', () => {
  let processor: VideoProcessor;
  
  beforeEach(() => {
    processor = new VideoProcessor({
      tempDir: '/tmp/test-processing',
      outputBucket: 'test-videos',
      concurrency: 2
    });
  });
  
  it('should process 1080p video in under 30 minutes', async () => {
    const job: VideoProcessingJob = {
      id: 'test-job-1',
      sourceUrl: 's3://test-bucket/sample-1080p.mp4',
      outputBucket: 'test-output',
      qualityLevels: [QUALITY_PRESETS[3]], // 1080p
      processingOptions: {
        extractThumbnails: true,
        generatePreview: false,
        addWatermark: false,
        enableDRM: false
      }
    };
    
    const startTime = Date.now();
    const result = await processor.processVideo(job);
    const processingTime = Date.now() - startTime;
    
    expect(result.success).toBe(true);
    expect(processingTime).toBeLessThan(30 * 60 * 1000); // 30 minutes
    expect(result.outputs).toHaveLength(1);
    expect(result.hlsManifest).toBeDefined();
  }, 35 * 60 * 1000); // 35 minute timeout
});
```

## Learning Concepts Focus

### 1. Media Codecs & Compression
- H.264/H.265 video compression algorithms
- AAC/Opus audio codec optimization
- Bitrate control and quality assessment

### 2. Streaming Protocols
- HLS adaptive bitrate streaming
- DASH protocol implementation
- CDN distribution patterns

### 3. Priority Queues & Scheduling
- Job prioritization algorithms
- Resource-aware task scheduling
- Load balancing strategies

### 4. Content Delivery Networks
- Consistent hashing for content distribution
- Geographic routing optimization
- Multi-CDN orchestration

---

**Next Phase**: Integration with Live Classes for session recording processing and Creator Studio for analytics dashboard.