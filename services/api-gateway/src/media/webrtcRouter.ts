/**
 * What: WebRTC SFU routing with regional selection for live streaming
 * Why: Optimize real-time media delivery with intelligent SFU selection
 * How: SFU discovery, capacity management, regional routing, session management
 */

import { EventEmitter } from 'events';

export interface SFUInstance {
  id: string;
  region: string;
  endpoint: string;
  capacity: number;
  currentSessions: number;
  capabilities: string[]; // e.g., ['audio', 'video', 'screen-share', 'recording']
  healthy: boolean;
  lastHealthCheck: number;
  metadata: Record<string, any>;
}

export interface WebRTCSession {
  id: string;
  roomId: string;
  userId: string;
  sfuId: string;
  sessionType: 'publisher' | 'subscriber' | 'both';
  mediaTypes: string[]; // e.g., ['audio', 'video']
  createdAt: number;
  lastActivity: number;
  metadata: Record<string, any>;
}

export interface WebRTCRoom {
  id: string;
  name: string;
  sfuId: string;
  maxParticipants: number;
  currentParticipants: number;
  recordingEnabled: boolean;
  createdAt: number;
  metadata: Record<string, any>;
}

export interface WebRTCRoutingConfig {
  strategy: 'nearest' | 'least-loaded' | 'balanced' | 'sticky';
  healthCheckInterval: number;
  sessionTimeout: number;
  enableRecording: boolean;
  maxParticipantsPerRoom: number;
  preferredRegions: string[];
}

export interface SFUSelectionContext {
  userId: string;
  roomId: string;
  userRegion?: string;
  mediaTypes: string[];
  sessionType: 'publisher' | 'subscriber' | 'both';
  metadata?: Record<string, any>;
}

export interface SFUSelectionResult {
  sfu: SFUInstance;
  reason: string;
  estimatedLatency?: number;
}

const DEFAULT_CONFIG: WebRTCRoutingConfig = {
  strategy: 'balanced',
  healthCheckInterval: 30000, // 30 seconds
  sessionTimeout: 300000, // 5 minutes
  enableRecording: false,
  maxParticipantsPerRoom: 100,
  preferredRegions: [],
};

export class WebRTCRouter extends EventEmitter {
  private config: WebRTCRoutingConfig;
  private sfuInstances = new Map<string, SFUInstance>();
  private sessions = new Map<string, WebRTCSession>();
  private rooms = new Map<string, WebRTCRoom>();
  private healthCheckTimer?: NodeJS.Timeout;
  private sessionCleanupTimer?: NodeJS.Timeout;

  constructor(config: Partial<WebRTCRoutingConfig> = {}) {
    super();
    this.config = { ...DEFAULT_CONFIG, ...config };
    this.startHealthChecks();
    this.startSessionCleanup();
  }

  addSFU(sfu: SFUInstance): void {
    this.sfuInstances.set(sfu.id, sfu);
    this.emit('sfu_added', { sfu });
  }

  removeSFU(sfuId: string): void {
    const sfu = this.sfuInstances.get(sfuId);
    if (!sfu) return;

    // Migrate sessions from this SFU
    this.migrateSessions(sfuId);
    
    this.sfuInstances.delete(sfuId);
    this.emit('sfu_removed', { sfuId });
  }

  updateSFUHealth(sfuId: string, healthy: boolean): void {
    const sfu = this.sfuInstances.get(sfuId);
    if (sfu) {
      sfu.healthy = healthy;
      sfu.lastHealthCheck = Date.now();
      this.emit('sfu_health_changed', { sfuId, healthy });
    }
  }

  updateSFULoad(sfuId: string, currentSessions: number): void {
    const sfu = this.sfuInstances.get(sfuId);
    if (sfu) {
      sfu.currentSessions = currentSessions;
    }
  }

  async selectSFU(context: SFUSelectionContext): Promise<SFUSelectionResult> {
    const eligibleSFUs = this.getEligibleSFUs(context);
    
    if (eligibleSFUs.length === 0) {
      throw new Error('No eligible SFU instances available');
    }

    if (eligibleSFUs.length === 1) {
      return {
        sfu: eligibleSFUs[0],
        reason: 'only_available',
      };
    }

    return await this.applyRoutingStrategy(eligibleSFUs, context);
  }

  async createSession(context: SFUSelectionContext): Promise<WebRTCSession> {
    const selection = await this.selectSFU(context);
    const sessionId = this.generateSessionId();
    
    const session: WebRTCSession = {
      id: sessionId,
      roomId: context.roomId,
      userId: context.userId,
      sfuId: selection.sfu.id,
      sessionType: context.sessionType,
      mediaTypes: context.mediaTypes,
      createdAt: Date.now(),
      lastActivity: Date.now(),
      metadata: context.metadata || {},
    };

    this.sessions.set(sessionId, session);
    
    // Update SFU load
    selection.sfu.currentSessions++;
    
    // Update room participant count
    const room = this.rooms.get(context.roomId);
    if (room) {
      room.currentParticipants++;
    }

    this.emit('session_created', { session, sfu: selection.sfu });
    return session;
  }

  async createRoom(roomId: string, options: {
    name?: string;
    maxParticipants?: number;
    recordingEnabled?: boolean;
    preferredSFU?: string;
    metadata?: Record<string, any>;
  } = {}): Promise<WebRTCRoom> {
    if (this.rooms.has(roomId)) {
      throw new Error(`Room ${roomId} already exists`);
    }

    let sfuId = options.preferredSFU;
    if (!sfuId) {
      // Select SFU for the room
      const context: SFUSelectionContext = {
        userId: 'system',
        roomId,
        mediaTypes: ['audio', 'video'],
        sessionType: 'both',
      };
      const selection = await this.selectSFU(context);
      sfuId = selection.sfu.id;
    }

    const room: WebRTCRoom = {
      id: roomId,
      name: options.name || roomId,
      sfuId,
      maxParticipants: options.maxParticipants || this.config.maxParticipantsPerRoom,
      currentParticipants: 0,
      recordingEnabled: options.recordingEnabled || this.config.enableRecording,
      createdAt: Date.now(),
      metadata: options.metadata || {},
    };

    this.rooms.set(roomId, room);
    this.emit('room_created', { room });
    return room;
  }

  endSession(sessionId: string): void {
    const session = this.sessions.get(sessionId);
    if (!session) return;

    // Update SFU load
    const sfu = this.sfuInstances.get(session.sfuId);
    if (sfu) {
      sfu.currentSessions = Math.max(0, sfu.currentSessions - 1);
    }

    // Update room participant count
    const room = this.rooms.get(session.roomId);
    if (room) {
      room.currentParticipants = Math.max(0, room.currentParticipants - 1);
    }

    this.sessions.delete(sessionId);
    this.emit('session_ended', { sessionId, session });
  }

  private getEligibleSFUs(context: SFUSelectionContext): SFUInstance[] {
    const eligible: SFUInstance[] = [];
    
    for (const sfu of this.sfuInstances.values()) {
      // Check health
      if (!sfu.healthy) continue;

      // Check capacity
      if (sfu.currentSessions >= sfu.capacity) continue;

      // Check capabilities
      const hasRequiredCapabilities = context.mediaTypes.every(type => 
        sfu.capabilities.includes(type)
      );
      if (!hasRequiredCapabilities) continue;

      eligible.push(sfu);
    }

    return eligible;
  }

  private async applyRoutingStrategy(
    sfus: SFUInstance[],
    context: SFUSelectionContext
  ): Promise<SFUSelectionResult> {
    switch (this.config.strategy) {
      case 'nearest':
        return this.selectNearestSFU(sfus, context);
      
      case 'least-loaded':
        return this.selectLeastLoadedSFU(sfus);
      
      case 'balanced':
        return this.selectBalancedSFU(sfus, context);
      
      case 'sticky':
        return this.selectStickySFU(sfus, context);
      
      default:
        return this.selectBalancedSFU(sfus, context);
    }
  }

  private selectNearestSFU(sfus: SFUInstance[], context: SFUSelectionContext): SFUSelectionResult {
    if (!context.userRegion) {
      // Fallback to least loaded if no region info
      return this.selectLeastLoadedSFU(sfus);
    }

    // Find SFU in the same region
    const sameRegionSFUs = sfus.filter(sfu => sfu.region === context.userRegion);
    if (sameRegionSFUs.length > 0) {
      const selected = this.selectLeastLoadedSFU(sameRegionSFUs).sfu;
      return {
        sfu: selected,
        reason: 'nearest_same_region',
        estimatedLatency: 50, // Mock latency
      };
    }

    // Find SFU in preferred regions
    for (const preferredRegion of this.config.preferredRegions) {
      const regionSFUs = sfus.filter(sfu => sfu.region === preferredRegion);
      if (regionSFUs.length > 0) {
        const selected = this.selectLeastLoadedSFU(regionSFUs).sfu;
        return {
          sfu: selected,
          reason: 'nearest_preferred_region',
          estimatedLatency: 100, // Mock latency
        };
      }
    }

    // Fallback to least loaded
    const selected = this.selectLeastLoadedSFU(sfus).sfu;
    return {
      sfu: selected,
      reason: 'nearest_fallback',
      estimatedLatency: 200, // Mock latency
    };
  }

  private selectLeastLoadedSFU(sfus: SFUInstance[]): SFUSelectionResult {
    const selected = sfus.reduce((least, current) => {
      const leastLoad = least.currentSessions / least.capacity;
      const currentLoad = current.currentSessions / current.capacity;
      return currentLoad < leastLoad ? current : least;
    });

    return {
      sfu: selected,
      reason: 'least_loaded',
    };
  }

  private selectBalancedSFU(sfus: SFUInstance[], context: SFUSelectionContext): SFUSelectionResult {
    // Balanced strategy considers region, load, and capacity
    const scores = sfus.map(sfu => {
      let score = 0;
      
      // Region preference (higher is better)
      if (context.userRegion === sfu.region) {
        score += 100;
      } else if (this.config.preferredRegions.includes(sfu.region)) {
        score += 50;
      }
      
      // Load factor (lower load is better)
      const loadFactor = sfu.currentSessions / sfu.capacity;
      score += (1 - loadFactor) * 50;
      
      // Capacity bonus (higher capacity is better for stability)
      score += Math.log(sfu.capacity) * 10;
      
      return { sfu, score };
    });

    const best = scores.reduce((best, current) => 
      current.score > best.score ? current : best
    );

    return {
      sfu: best.sfu,
      reason: 'balanced_selection',
    };
  }

  private selectStickySFU(sfus: SFUInstance[], context: SFUSelectionContext): SFUSelectionResult {
    // Check if user has existing sessions, prefer same SFU
    const userSessions = Array.from(this.sessions.values())
      .filter(session => session.userId === context.userId);
    
    if (userSessions.length > 0) {
      const existingSFUId = userSessions[0].sfuId;
      const existingSFU = sfus.find(sfu => sfu.id === existingSFUId);
      
      if (existingSFU) {
        return {
          sfu: existingSFU,
          reason: 'sticky_existing_session',
        };
      }
    }

    // Check if room has preferred SFU
    const room = this.rooms.get(context.roomId);
    if (room) {
      const roomSFU = sfus.find(sfu => sfu.id === room.sfuId);
      if (roomSFU) {
        return {
          sfu: roomSFU,
          reason: 'sticky_room_sfu',
        };
      }
    }

    // Fallback to balanced
    return this.selectBalancedSFU(sfus, context);
  }

  private migrateSessions(fromSFUId: string): void {
    const sessionsToMigrate = Array.from(this.sessions.values())
      .filter(session => session.sfuId === fromSFUId);

    for (const session of sessionsToMigrate) {
      try {
        // In a real implementation, this would coordinate with the SFU
        // to migrate the WebRTC session to a new SFU
        console.log(`Migrating session ${session.id} from SFU ${fromSFUId}`);
        
        // For now, just end the session
        this.endSession(session.id);
      } catch (error) {
        console.error(`Failed to migrate session ${session.id}:`, error);
      }
    }
  }

  private startHealthChecks(): void {
    this.healthCheckTimer = setInterval(() => {
      this.performHealthChecks();
    }, this.config.healthCheckInterval);
  }

  private async performHealthChecks(): Promise<void> {
    for (const [sfuId, sfu] of this.sfuInstances.entries()) {
      try {
        // In a real implementation, this would ping the SFU
        const response = await fetch(`${sfu.endpoint}/health`, {
          method: 'GET',
          signal: AbortSignal.timeout(5000),
        });
        
        const healthy = response.ok;
        if (sfu.healthy !== healthy) {
          this.updateSFUHealth(sfuId, healthy);
        }
      } catch (error) {
        if (sfu.healthy) {
          this.updateSFUHealth(sfuId, false);
        }
      }
    }
  }

  private startSessionCleanup(): void {
    this.sessionCleanupTimer = setInterval(() => {
      this.cleanupInactiveSessions();
    }, 60000); // Check every minute
  }

  private cleanupInactiveSessions(): void {
    const now = Date.now();
    const timeout = this.config.sessionTimeout;
    
    for (const [sessionId, session] of this.sessions.entries()) {
      if (now - session.lastActivity > timeout) {
        console.log(`Cleaning up inactive session ${sessionId}`);
        this.endSession(sessionId);
      }
    }
  }

  private generateSessionId(): string {
    return `webrtc_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats(): {
    totalSFUs: number;
    healthySFUs: number;
    totalSessions: number;
    totalRooms: number;
    loadByRegion: Record<string, { sessions: number; capacity: number }>;
  } {
    const healthySFUs = Array.from(this.sfuInstances.values()).filter(sfu => sfu.healthy).length;
    
    const loadByRegion: Record<string, { sessions: number; capacity: number }> = {};
    for (const sfu of this.sfuInstances.values()) {
      if (!loadByRegion[sfu.region]) {
        loadByRegion[sfu.region] = { sessions: 0, capacity: 0 };
      }
      loadByRegion[sfu.region].sessions += sfu.currentSessions;
      loadByRegion[sfu.region].capacity += sfu.capacity;
    }

    return {
      totalSFUs: this.sfuInstances.size,
      healthySFUs,
      totalSessions: this.sessions.size,
      totalRooms: this.rooms.size,
      loadByRegion,
    };
  }

  updateConfig(newConfig: Partial<WebRTCRoutingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }

  shutdown(): void {
    if (this.healthCheckTimer) {
      clearInterval(this.healthCheckTimer);
    }
    if (this.sessionCleanupTimer) {
      clearInterval(this.sessionCleanupTimer);
    }
  }
}

// Global WebRTC router instance
let webrtcRouter: WebRTCRouter;

export function initializeWebRTCRouter(config: Partial<WebRTCRoutingConfig>): WebRTCRouter {
  webrtcRouter = new WebRTCRouter(config);
  return webrtcRouter;
}

export function getWebRTCRouter(): WebRTCRouter {
  if (!webrtcRouter) {
    webrtcRouter = new WebRTCRouter();
  }
  return webrtcRouter;
}

// Common SFU configurations
export const COMMON_SFU_CONFIGS = {
  US_WEST: {
    region: 'us-west-1',
    capacity: 1000,
    capabilities: ['audio', 'video', 'screen-share', 'recording'],
  },
  US_EAST: {
    region: 'us-east-1',
    capacity: 1000,
    capabilities: ['audio', 'video', 'screen-share', 'recording'],
  },
  EU_WEST: {
    region: 'eu-west-1',
    capacity: 800,
    capabilities: ['audio', 'video', 'screen-share', 'recording'],
  },
  AP_SOUTH: {
    region: 'ap-south-1',
    capacity: 600,
    capabilities: ['audio', 'video', 'screen-share'],
  },
} as const;
