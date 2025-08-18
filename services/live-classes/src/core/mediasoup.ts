import * as mediasoup from 'mediasoup';
import { config } from '../config/index.js';
import { logger } from '../utils/logger.js';

export interface MediaSoupWorker {
  worker: mediasoup.types.Worker;
  routers: Map<string, mediasoup.types.Router>;
  load: number;
}

export class MediaSoupManager {
  private workers: MediaSoupWorker[] = [];
  private nextWorkerIndex = 0;

  async initialize(): Promise<void> {
    try {
      // Create multiple workers for load distribution
      const numWorkers = Math.max(1, Math.floor(require('os').cpus().length / 2));
      logger.info(`Creating ${numWorkers} MediaSoup workers`);

      for (let i = 0; i < numWorkers; i++) {
        const worker = await this.createWorker();
        this.workers.push({
          worker,
          routers: new Map(),
          load: 0
        });
      }

      logger.info(`✅ Created ${this.workers.length} MediaSoup workers`);
    } catch (error) {
      logger.error('Failed to initialize MediaSoup:', error);
      throw error;
    }
  }

  private async createWorker(): Promise<mediasoup.types.Worker> {
    const worker = await mediasoup.createWorker({
      logLevel: 'warn',
      rtcMinPort: config.mediaSoup.minPort,
      rtcMaxPort: config.mediaSoup.maxPort
    });

    worker.on('died', () => {
      logger.error('MediaSoup worker died, exiting process');
      process.exit(1);
    });

    return worker;
  }

  getWorker(): MediaSoupWorker {
    // Round-robin worker selection
    const worker = this.workers[this.nextWorkerIndex];
    this.nextWorkerIndex = (this.nextWorkerIndex + 1) % this.workers.length;
    return worker;
  }

  async createRouter(roomId: string): Promise<mediasoup.types.Router> {
    const workerData = this.getWorker();
    
    const router = await workerData.worker.createRouter({
      mediaCodecs: [
        {
          kind: 'audio',
          mimeType: 'audio/opus',
          clockRate: 48000,
          channels: 2
        },
        {
          kind: 'video',
          mimeType: 'video/VP8',
          clockRate: 90000,
          parameters: {
            'x-google-start-bitrate': 1000
          }
        },
        {
          kind: 'video',
          mimeType: 'video/VP9',
          clockRate: 90000,
          parameters: {
            'profile-id': 2,
            'x-google-start-bitrate': 1000
          }
        },
        {
          kind: 'video',
          mimeType: 'video/h264',
          clockRate: 90000,
          parameters: {
            'packetization-mode': 1,
            'profile-level-id': '4d0032',
            'level-asymmetry-allowed': 1,
            'x-google-start-bitrate': 1000
          }
        }
      ]
    });

    workerData.routers.set(roomId, router);
    workerData.load++;

    router.on('close', () => {
      workerData.routers.delete(roomId);
      workerData.load--;
    });

    return router;
  }

  getRouter(roomId: string): mediasoup.types.Router | null {
    for (const workerData of this.workers) {
      const router = workerData.routers.get(roomId);
      if (router) {
        return router;
      }
    }
    return null;
  }

  async createWebRtcTransport(router: mediasoup.types.Router): Promise<mediasoup.types.WebRtcTransport> {
    return await router.createWebRtcTransport({
      listenIps: [
        {
          ip: config.mediaSoup.listenIp,
          announcedIp: config.mediaSoup.announcedIp
        }
      ],
      enableUdp: true,
      enableTcp: true,
      preferUdp: true
    });
  }

  async getWorkerStats(): Promise<any[]> {
    const stats = [];
    for (let i = 0; i < this.workers.length; i++) {
      const workerData = this.workers[i];
      const resourceUsage = await workerData.worker.getResourceUsage();
      stats.push({
        workerId: i,
        load: workerData.load,
        routersCount: workerData.routers.size,
        resourceUsage
      });
    }
    return stats;
  }

  async shutdown(): Promise<void> {
    logger.info('Shutting down MediaSoup workers...');
    for (const workerData of this.workers) {
      workerData.worker.close();
    }
    this.workers = [];
  }
}
