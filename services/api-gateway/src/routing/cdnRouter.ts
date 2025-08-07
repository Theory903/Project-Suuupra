/**
 * What: CDN-aware routing for media content with geo/RTT-based selection
 * Why: Optimize media delivery by routing to nearest/fastest CDN edge
 * How: Geo-location detection, RTT measurement, CDN endpoint selection
 */

import { FastifyRequest } from 'fastify';
import { ServiceInstance } from '../discovery/providers';

export interface CDNEndpoint extends ServiceInstance {
  region: string;
  country: string;
  city?: string;
  latitude: number;
  longitude: number;
  capabilities: string[]; // e.g., ['video', 'audio', 'images', 'live-streaming']
  bandwidth: number; // Mbps
  cost: number; // Cost per GB
  priority: number; // Higher = preferred
}

export interface GeoLocation {
  country: string;
  region: string;
  city?: string;
  latitude: number;
  longitude: number;
  timezone?: string;
}

export interface CDNRoutingConfig {
  strategy: 'nearest' | 'fastest' | 'cheapest' | 'balanced';
  fallbackStrategy: 'nearest' | 'fastest';
  rttThresholdMs: number; // Consider RTT above this as slow
  enableGeoBlocking: boolean;
  allowedCountries?: string[];
  blockedCountries?: string[];
  cacheRttMs: number; // Cache RTT measurements for this duration
}

export interface RTTMeasurement {
  endpointId: string;
  rttMs: number;
  timestamp: number;
  success: boolean;
}

const DEFAULT_CONFIG: CDNRoutingConfig = {
  strategy: 'balanced',
  fallbackStrategy: 'nearest',
  rttThresholdMs: 200,
  enableGeoBlocking: false,
  cacheRttMs: 300000, // 5 minutes
};

export class CDNRouter {
  private config: CDNRoutingConfig;
  private endpoints = new Map<string, CDNEndpoint>();
  private rttCache = new Map<string, RTTMeasurement>();
  private geoCache = new Map<string, GeoLocation>();

  constructor(config: Partial<CDNRoutingConfig> = {}) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  addEndpoint(endpoint: CDNEndpoint): void {
    this.endpoints.set(endpoint.id, endpoint);
  }

  removeEndpoint(endpointId: string): void {
    this.endpoints.delete(endpointId);
    this.rttCache.delete(endpointId);
  }

  async selectEndpoint(
    request: FastifyRequest,
    capability: string
  ): Promise<CDNEndpoint | null> {
    const clientGeo = await this.getClientGeoLocation(request);
    
    // Apply geo-blocking if enabled
    if (this.config.enableGeoBlocking && !this.isGeoAllowed(clientGeo)) {
      throw new Error(`Access blocked for country: ${clientGeo.country}`);
    }

    const eligibleEndpoints = this.getEligibleEndpoints(capability);
    
    if (eligibleEndpoints.length === 0) {
      return null;
    }

    if (eligibleEndpoints.length === 1) {
      return eligibleEndpoints[0];
    }

    // Apply routing strategy
    return await this.applyRoutingStrategy(eligibleEndpoints, clientGeo, request);
  }

  private async getClientGeoLocation(request: FastifyRequest): Promise<GeoLocation> {
    const clientIp = this.getClientIp(request);
    
    // Check cache first
    const cached = this.geoCache.get(clientIp);
    if (cached) {
      return cached;
    }

    // In a real implementation, this would call a geo-location service
    const geoLocation = await this.lookupGeoLocation(clientIp);
    
    // Cache the result
    this.geoCache.set(clientIp, geoLocation);
    
    return geoLocation;
  }

  private getClientIp(request: FastifyRequest): string {
    // Check various headers for real client IP
    const xForwardedFor = request.headers['x-forwarded-for'] as string;
    if (xForwardedFor) {
      return xForwardedFor.split(',')[0].trim();
    }

    const xRealIp = request.headers['x-real-ip'] as string;
    if (xRealIp) {
      return xRealIp;
    }

    const cfConnectingIp = request.headers['cf-connecting-ip'] as string;
    if (cfConnectingIp) {
      return cfConnectingIp;
    }

    return request.ip;
  }

  private async lookupGeoLocation(ip: string): Promise<GeoLocation> {
    // Mock geo-location lookup - in production, use MaxMind, IPinfo, etc.
    const mockGeoData: Record<string, GeoLocation> = {
      '127.0.0.1': {
        country: 'US',
        region: 'CA',
        city: 'San Francisco',
        latitude: 37.7749,
        longitude: -122.4194,
      },
      'default': {
        country: 'US',
        region: 'VA',
        city: 'Ashburn',
        latitude: 39.0438,
        longitude: -77.4874,
      },
    };

    return mockGeoData[ip] || mockGeoData.default;
  }

  private isGeoAllowed(geo: GeoLocation): boolean {
    if (this.config.blockedCountries?.includes(geo.country)) {
      return false;
    }

    if (this.config.allowedCountries && !this.config.allowedCountries.includes(geo.country)) {
      return false;
    }

    return true;
  }

  private getEligibleEndpoints(capability: string): CDNEndpoint[] {
    return Array.from(this.endpoints.values()).filter(endpoint => {
      return endpoint.healthy && endpoint.capabilities.includes(capability);
    });
  }

  private async applyRoutingStrategy(
    endpoints: CDNEndpoint[],
    clientGeo: GeoLocation,
    request: FastifyRequest
  ): Promise<CDNEndpoint> {
    switch (this.config.strategy) {
      case 'nearest':
        return this.selectNearestEndpoint(endpoints, clientGeo);
      
      case 'fastest':
        return await this.selectFastestEndpoint(endpoints, request);
      
      case 'cheapest':
        return this.selectCheapestEndpoint(endpoints);
      
      case 'balanced':
        return await this.selectBalancedEndpoint(endpoints, clientGeo, request);
      
      default:
        return this.selectNearestEndpoint(endpoints, clientGeo);
    }
  }

  private selectNearestEndpoint(endpoints: CDNEndpoint[], clientGeo: GeoLocation): CDNEndpoint {
    return endpoints.reduce((nearest, current) => {
      const nearestDistance = this.calculateDistance(clientGeo, nearest);
      const currentDistance = this.calculateDistance(clientGeo, current);
      
      return currentDistance < nearestDistance ? current : nearest;
    });
  }

  private async selectFastestEndpoint(endpoints: CDNEndpoint[], request: FastifyRequest): Promise<CDNEndpoint> {
    const rttPromises = endpoints.map(endpoint => this.measureRTT(endpoint, request));
    const rttResults = await Promise.allSettled(rttPromises);
    
    let fastestEndpoint = endpoints[0];
    let fastestRTT = Infinity;
    
    for (let i = 0; i < endpoints.length; i++) {
      const result = rttResults[i];
      if (result.status === 'fulfilled' && result.value.rttMs < fastestRTT) {
        fastestRTT = result.value.rttMs;
        fastestEndpoint = endpoints[i];
      }
    }
    
    return fastestEndpoint;
  }

  private selectCheapestEndpoint(endpoints: CDNEndpoint[]): CDNEndpoint {
    return endpoints.reduce((cheapest, current) => {
      return current.cost < cheapest.cost ? current : cheapest;
    });
  }

  private async selectBalancedEndpoint(
    endpoints: CDNEndpoint[],
    clientGeo: GeoLocation,
    request: FastifyRequest
  ): Promise<CDNEndpoint> {
    // Balanced strategy considers distance, RTT, cost, and priority
    const scores = await Promise.all(
      endpoints.map(async endpoint => {
        const distance = this.calculateDistance(clientGeo, endpoint);
        const rttMeasurement = await this.measureRTT(endpoint, request);
        
        // Normalize scores (lower is better for distance/RTT/cost, higher for priority)
        const distanceScore = Math.max(0, 1 - distance / 20000); // Max distance ~20,000km
        const rttScore = Math.max(0, 1 - rttMeasurement.rttMs / 1000); // Max RTT 1000ms
        const costScore = Math.max(0, 1 - endpoint.cost / 0.1); // Max cost $0.10/GB
        const priorityScore = endpoint.priority / 10; // Priority 0-10
        
        // Weighted combination
        const totalScore = (
          distanceScore * 0.3 +
          rttScore * 0.4 +
          costScore * 0.2 +
          priorityScore * 0.1
        );
        
        return { endpoint, score: totalScore };
      })
    );
    
    // Select endpoint with highest score
    const bestScore = scores.reduce((best, current) => {
      return current.score > best.score ? current : best;
    });
    
    return bestScore.endpoint;
  }

  private calculateDistance(geo1: GeoLocation, geo2: { latitude: number; longitude: number }): number {
    // Haversine formula for distance calculation
    const R = 6371; // Earth's radius in kilometers
    const dLat = this.toRadians(geo2.latitude - geo1.latitude);
    const dLon = this.toRadians(geo2.longitude - geo1.longitude);
    
    const a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
              Math.cos(this.toRadians(geo1.latitude)) * Math.cos(this.toRadians(geo2.latitude)) *
              Math.sin(dLon / 2) * Math.sin(dLon / 2);
    
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }

  private toRadians(degrees: number): number {
    return degrees * (Math.PI / 180);
  }

  private async measureRTT(endpoint: CDNEndpoint, request: FastifyRequest): Promise<RTTMeasurement> {
    const cacheKey = `${endpoint.id}_${this.getClientIp(request)}`;
    const cached = this.rttCache.get(cacheKey);
    
    if (cached && Date.now() - cached.timestamp < this.config.cacheRttMs) {
      return cached;
    }

    const startTime = Date.now();
    let rttMs = Infinity;
    let success = false;

    try {
      // Simple HTTP HEAD request to measure RTT
      const response = await fetch(`${endpoint.url}/health`, {
        method: 'HEAD',
        signal: AbortSignal.timeout(5000), // 5 second timeout
      });
      
      if (response.ok) {
        rttMs = Date.now() - startTime;
        success = true;
      }
    } catch (error) {
      // RTT measurement failed, use high value
      rttMs = 9999;
      success = false;
    }

    const measurement: RTTMeasurement = {
      endpointId: endpoint.id,
      rttMs,
      timestamp: Date.now(),
      success,
    };

    // Cache the measurement
    this.rttCache.set(cacheKey, measurement);
    
    return measurement;
  }

  getEndpointStats(): Record<string, any> {
    const stats: Record<string, any> = {};
    
    for (const [id, endpoint] of this.endpoints.entries()) {
      const rttMeasurements = Array.from(this.rttCache.values())
        .filter(m => m.endpointId === id);
      
      const avgRtt = rttMeasurements.length > 0
        ? rttMeasurements.reduce((sum, m) => sum + m.rttMs, 0) / rttMeasurements.length
        : 0;
      
      stats[id] = {
        region: endpoint.region,
        country: endpoint.country,
        city: endpoint.city,
        healthy: endpoint.healthy,
        capabilities: endpoint.capabilities,
        bandwidth: endpoint.bandwidth,
        cost: endpoint.cost,
        priority: endpoint.priority,
        avgRttMs: Math.round(avgRtt),
        rttMeasurements: rttMeasurements.length,
      };
    }
    
    return stats;
  }

  getCacheStats(): {
    geoCache: number;
    rttCache: number;
  } {
    return {
      geoCache: this.geoCache.size,
      rttCache: this.rttCache.size,
    };
  }

  clearCache(): void {
    this.geoCache.clear();
    this.rttCache.clear();
  }

  updateConfig(newConfig: Partial<CDNRoutingConfig>): void {
    this.config = { ...this.config, ...newConfig };
  }
}

// Global CDN routers per capability
const cdnRouters = new Map<string, CDNRouter>();

export function getCDNRouter(capability: string, config?: Partial<CDNRoutingConfig>): CDNRouter {
  let router = cdnRouters.get(capability);
  
  if (!router) {
    router = new CDNRouter(config);
    cdnRouters.set(capability, router);
  } else if (config) {
    router.updateConfig(config);
  }
  
  return router;
}

export function removeCDNRouter(capability: string): void {
  cdnRouters.delete(capability);
}

// Common CDN endpoint configurations
export const COMMON_CDN_ENDPOINTS: Record<string, Partial<CDNEndpoint>> = {
  CLOUDFLARE_US_WEST: {
    region: 'us-west-1',
    country: 'US',
    city: 'San Francisco',
    latitude: 37.7749,
    longitude: -122.4194,
    capabilities: ['video', 'audio', 'images', 'live-streaming'],
    bandwidth: 10000, // 10 Gbps
    cost: 0.08, // $0.08/GB
    priority: 9,
  },
  CLOUDFLARE_EU_WEST: {
    region: 'eu-west-1',
    country: 'IE',
    city: 'Dublin',
    latitude: 53.3498,
    longitude: -6.2603,
    capabilities: ['video', 'audio', 'images', 'live-streaming'],
    bandwidth: 10000,
    cost: 0.09,
    priority: 9,
  },
  CLOUDFLARE_AP_SOUTH: {
    region: 'ap-south-1',
    country: 'SG',
    city: 'Singapore',
    latitude: 1.3521,
    longitude: 103.8198,
    capabilities: ['video', 'audio', 'images', 'live-streaming'],
    bandwidth: 10000,
    cost: 0.12,
    priority: 9,
  },
} as const;
