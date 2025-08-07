import * as fs from 'fs/promises';
import * as path from 'path';
import { createHash, createHmac } from 'crypto';
import { EventEmitter } from 'events';

export interface AuditEvent {
  id: string;
  timestamp: Date;
  eventType: string;
  actor: {
    type: 'user' | 'service' | 'system';
    id: string;
    ip?: string;
    userAgent?: string;
  };
  resource: {
    type: string;
    id: string;
    attributes?: Record<string, any>;
  };
  action: string;
  outcome: 'success' | 'failure' | 'error';
  details?: Record<string, any>;
  metadata?: Record<string, any>;
}

export interface AuditLogEntry {
  event: AuditEvent;
  sequence: number;
  previousHash: string;
  hash: string;
  signature?: string;
}

export interface AuditSinkConfig {
  enabled: boolean;
  storage: {
    type: 'file' | 'database' | 's3';
    path: string;
    maxFileSize: number;
    rotationPolicy: 'size' | 'time' | 'both';
    retentionDays: number;
  };
  integrity: {
    hashChaining: boolean;
    signing: boolean;
    signingKey?: string;
    algorithm: 'sha256' | 'sha512';
  };
  filtering: {
    eventTypes: string[];
    excludeEventTypes: string[];
    minSeverity?: 'low' | 'medium' | 'high' | 'critical';
  };
  buffering: {
    enabled: boolean;
    maxSize: number;
    flushInterval: number; // seconds
    flushOnCritical: boolean;
  };
}

export interface AuditQuery {
  startTime?: Date;
  endTime?: Date;
  eventTypes?: string[];
  actors?: string[];
  resources?: string[];
  actions?: string[];
  outcomes?: string[];
  limit?: number;
  offset?: number;
}

export class AuditSink extends EventEmitter {
  private config: AuditSinkConfig;
  private buffer: AuditEvent[] = [];
  private sequence: number = 0;
  private lastHash: string = '0';
  private flushTimer?: NodeJS.Timeout;
  private currentLogFile?: string;

  constructor(config: AuditSinkConfig) {
    super();
    this.config = config;
    this.initialize();
  }

  private async initialize(): Promise<void> {
    if (!this.config.enabled) return;

    // Load last sequence and hash from storage
    await this.loadLastState();

    // Setup buffering if enabled
    if (this.config.buffering.enabled) {
      this.setupBuffering();
    }

    // Ensure storage directory exists
    if (this.config.storage.type === 'file') {
      await fs.mkdir(path.dirname(this.config.storage.path), { recursive: true });
    }

    console.log('Audit sink initialized');
  }

  private async loadLastState(): Promise<void> {
    try {
      if (this.config.storage.type === 'file') {
        const stateFile = path.join(path.dirname(this.config.storage.path), '.audit-state');
        const state = JSON.parse(await fs.readFile(stateFile, 'utf8'));
        this.sequence = state.sequence || 0;
        this.lastHash = state.lastHash || '0';
      }
    } catch (error) {
      // State file doesn't exist or is corrupted, start fresh
      this.sequence = 0;
      this.lastHash = '0';
    }
  }

  private async saveState(): Promise<void> {
    if (this.config.storage.type === 'file') {
      const stateFile = path.join(path.dirname(this.config.storage.path), '.audit-state');
      await fs.writeFile(stateFile, JSON.stringify({
        sequence: this.sequence,
        lastHash: this.lastHash,
        timestamp: new Date().toISOString()
      }));
    }
  }

  private setupBuffering(): void {
    const flushInterval = this.config.buffering.flushInterval * 1000;
    
    this.flushTimer = setInterval(async () => {
      await this.flush();
    }, flushInterval);
  }

  async logEvent(event: AuditEvent): Promise<void> {
    if (!this.config.enabled) return;

    // Apply filtering
    if (!this.shouldLogEvent(event)) return;

    // Add to buffer or write immediately
    if (this.config.buffering.enabled) {
      this.buffer.push(event);
      
      // Check if buffer is full or critical event
      if (this.buffer.length >= this.config.buffering.maxSize ||
          (this.config.buffering.flushOnCritical && this.isCriticalEvent(event))) {
        await this.flush();
      }
    } else {
      await this.writeEvent(event);
    }
  }

  private shouldLogEvent(event: AuditEvent): boolean {
    const { filtering } = this.config;

    // Check event type inclusion
    if (filtering.eventTypes.length > 0 && 
        !filtering.eventTypes.includes(event.eventType)) {
      return false;
    }

    // Check event type exclusion
    if (filtering.excludeEventTypes.includes(event.eventType)) {
      return false;
    }

    // Check minimum severity (if specified)
    if (filtering.minSeverity && event.metadata?.severity) {
      const severityLevels = { low: 1, medium: 2, high: 3, critical: 4 };
      const eventSeverity = severityLevels[event.metadata.severity as keyof typeof severityLevels] || 1;
      const minSeverity = severityLevels[filtering.minSeverity];
      
      if (eventSeverity < minSeverity) {
        return false;
      }
    }

    return true;
  }

  private isCriticalEvent(event: AuditEvent): boolean {
    return event.metadata?.severity === 'critical' ||
           event.outcome === 'error' ||
           event.eventType.includes('security') ||
           event.eventType.includes('auth');
  }

  private async flush(): Promise<void> {
    if (this.buffer.length === 0) return;

    const eventsToWrite = [...this.buffer];
    this.buffer = [];

    try {
      for (const event of eventsToWrite) {
        await this.writeEvent(event);
      }
    } catch (error) {
      // Put events back in buffer on failure
      this.buffer.unshift(...eventsToWrite);
      throw error;
    }
  }

  private async writeEvent(event: AuditEvent): Promise<void> {
    this.sequence++;
    
    // Create audit log entry with hash chaining
    const logEntry: AuditLogEntry = {
      event,
      sequence: this.sequence,
      previousHash: this.lastHash,
      hash: '',
      signature: undefined
    };

    // Calculate hash
    if (this.config.integrity.hashChaining) {
      logEntry.hash = this.calculateHash(logEntry);
      this.lastHash = logEntry.hash;
    }

    // Sign entry if configured
    if (this.config.integrity.signing && this.config.integrity.signingKey) {
      logEntry.signature = this.signEntry(logEntry);
    }

    // Write to storage
    await this.writeToStorage(logEntry);

    // Save state
    await this.saveState();

    // Emit event
    this.emit('eventLogged', logEntry);
  }

  private calculateHash(entry: AuditLogEntry): string {
    const data = JSON.stringify({
      event: entry.event,
      sequence: entry.sequence,
      previousHash: entry.previousHash
    });

    return createHash(this.config.integrity.algorithm)
      .update(data)
      .digest('hex');
  }

  private signEntry(entry: AuditLogEntry): string {
    if (!this.config.integrity.signingKey) {
      throw new Error('Signing key not configured');
    }

    const data = JSON.stringify({
      event: entry.event,
      sequence: entry.sequence,
      hash: entry.hash
    });

    return createHmac(this.config.integrity.algorithm, this.config.integrity.signingKey)
      .update(data)
      .digest('hex');
  }

  private async writeToStorage(entry: AuditLogEntry): Promise<void> {
    switch (this.config.storage.type) {
      case 'file':
        await this.writeToFile(entry);
        break;
      case 'database':
        await this.writeToDatabase(entry);
        break;
      case 's3':
        await this.writeToS3(entry);
        break;
      default:
        throw new Error(`Unsupported storage type: ${this.config.storage.type}`);
    }
  }

  private async writeToFile(entry: AuditLogEntry): Promise<void> {
    const logLine = JSON.stringify(entry) + '\n';
    
    // Check if we need to rotate the log file
    await this.rotateLogFileIfNeeded();
    
    // Append to current log file
    const logFile = this.getCurrentLogFile();
    await fs.appendFile(logFile, logLine);
  }

  private async writeToDatabase(entry: AuditLogEntry): Promise<void> {
    // This would integrate with your database layer
    // For now, we'll just log it
    console.log('Writing audit entry to database:', entry.sequence);
  }

  private async writeToS3(entry: AuditLogEntry): Promise<void> {
    // This would integrate with AWS S3
    // For now, we'll just log it
    console.log('Writing audit entry to S3:', entry.sequence);
  }

  private async rotateLogFileIfNeeded(): Promise<void> {
    const { storage } = this.config;
    const currentFile = this.getCurrentLogFile();
    
    try {
      const stats = await fs.stat(currentFile);
      
      if (storage.rotationPolicy === 'size' || storage.rotationPolicy === 'both') {
        if (stats.size >= storage.maxFileSize) {
          await this.rotateLogFile();
        }
      }
      
      if (storage.rotationPolicy === 'time' || storage.rotationPolicy === 'both') {
        const ageInDays = (Date.now() - stats.mtime.getTime()) / (24 * 60 * 60 * 1000);
        if (ageInDays >= 1) { // Rotate daily
          await this.rotateLogFile();
        }
      }
    } catch (error) {
      // File doesn't exist, no need to rotate
    }
  }

  private async rotateLogFile(): Promise<void> {
    const currentFile = this.getCurrentLogFile();
    const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
    const rotatedFile = `${currentFile}.${timestamp}`;
    
    try {
      await fs.rename(currentFile, rotatedFile);
      this.currentLogFile = undefined; // Force new file creation
      console.log(`Audit log rotated: ${rotatedFile}`);
    } catch (error) {
      console.error('Failed to rotate audit log:', error);
    }
  }

  private getCurrentLogFile(): string {
    if (!this.currentLogFile) {
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0];
      this.currentLogFile = `${this.config.storage.path}.${dateStr}.log`;
    }
    return this.currentLogFile;
  }

  async query(query: AuditQuery): Promise<AuditLogEntry[]> {
    if (this.config.storage.type !== 'file') {
      throw new Error('Query only supported for file storage currently');
    }

    const results: AuditLogEntry[] = [];
    const logFiles = await this.getLogFiles();
    
    for (const logFile of logFiles) {
      const entries = await this.queryLogFile(logFile, query);
      results.push(...entries);
    }

    // Apply limit and offset
    const offset = query.offset || 0;
    const limit = query.limit || results.length;
    
    return results.slice(offset, offset + limit);
  }

  private async getLogFiles(): Promise<string[]> {
    const dir = path.dirname(this.config.storage.path);
    const baseName = path.basename(this.config.storage.path);
    
    try {
      const files = await fs.readdir(dir);
      return files
        .filter(file => file.startsWith(baseName))
        .map(file => path.join(dir, file))
        .sort();
    } catch (error) {
      return [];
    }
  }

  private async queryLogFile(filePath: string, query: AuditQuery): Promise<AuditLogEntry[]> {
    const results: AuditLogEntry[] = [];
    
    try {
      const content = await fs.readFile(filePath, 'utf8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const entry: AuditLogEntry = JSON.parse(line);
          
          if (this.matchesQuery(entry, query)) {
            results.push(entry);
          }
        } catch (parseError) {
          console.warn('Failed to parse audit log line:', parseError);
        }
      }
    } catch (error) {
      console.warn('Failed to read audit log file:', filePath, error);
    }
    
    return results;
  }

  private matchesQuery(entry: AuditLogEntry, query: AuditQuery): boolean {
    const { event } = entry;
    
    // Time range
    if (query.startTime && event.timestamp < query.startTime) return false;
    if (query.endTime && event.timestamp > query.endTime) return false;
    
    // Event types
    if (query.eventTypes && !query.eventTypes.includes(event.eventType)) return false;
    
    // Actors
    if (query.actors && !query.actors.includes(event.actor.id)) return false;
    
    // Resources
    if (query.resources && !query.resources.includes(event.resource.id)) return false;
    
    // Actions
    if (query.actions && !query.actions.includes(event.action)) return false;
    
    // Outcomes
    if (query.outcomes && !query.outcomes.includes(event.outcome)) return false;
    
    return true;
  }

  async verifyIntegrity(startSequence?: number, endSequence?: number): Promise<{
    valid: boolean;
    errors: string[];
    verifiedEntries: number;
  }> {
    const errors: string[] = [];
    let verifiedEntries = 0;
    let expectedHash = '0';
    
    if (this.config.storage.type !== 'file') {
      throw new Error('Integrity verification only supported for file storage currently');
    }

    const logFiles = await this.getLogFiles();
    
    for (const logFile of logFiles) {
      const content = await fs.readFile(logFile, 'utf8');
      const lines = content.trim().split('\n');
      
      for (const line of lines) {
        if (!line.trim()) continue;
        
        try {
          const entry: AuditLogEntry = JSON.parse(line);
          
          // Skip if outside sequence range
          if (startSequence && entry.sequence < startSequence) continue;
          if (endSequence && entry.sequence > endSequence) continue;
          
          // Verify hash chain
          if (entry.previousHash !== expectedHash) {
            errors.push(`Sequence ${entry.sequence}: Hash chain broken. Expected previous hash: ${expectedHash}, got: ${entry.previousHash}`);
          }
          
          // Verify entry hash
          const calculatedHash = this.calculateHash(entry);
          if (entry.hash !== calculatedHash) {
            errors.push(`Sequence ${entry.sequence}: Hash mismatch. Expected: ${calculatedHash}, got: ${entry.hash}`);
          }
          
          // Verify signature if present
          if (entry.signature && this.config.integrity.signingKey) {
            const calculatedSignature = this.signEntry(entry);
            if (entry.signature !== calculatedSignature) {
              errors.push(`Sequence ${entry.sequence}: Signature verification failed`);
            }
          }
          
          expectedHash = entry.hash;
          verifiedEntries++;
          
        } catch (parseError) {
          errors.push(`Failed to parse entry: ${parseError}`);
        }
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
      verifiedEntries
    };
  }

  async cleanup(): Promise<void> {
    const retentionMs = this.config.storage.retentionDays * 24 * 60 * 60 * 1000;
    const cutoffDate = new Date(Date.now() - retentionMs);
    
    if (this.config.storage.type === 'file') {
      const logFiles = await this.getLogFiles();
      
      for (const logFile of logFiles) {
        try {
          const stats = await fs.stat(logFile);
          if (stats.mtime < cutoffDate) {
            await fs.unlink(logFile);
            console.log(`Deleted old audit log: ${logFile}`);
          }
        } catch (error) {
          console.warn(`Failed to process audit log file ${logFile}:`, error);
        }
      }
    }
  }

  async stop(): Promise<void> {
    if (this.flushTimer) {
      clearInterval(this.flushTimer);
      this.flushTimer = undefined;
    }
    
    // Flush any remaining buffered events
    if (this.config.buffering.enabled && this.buffer.length > 0) {
      await this.flush();
    }
    
    await this.saveState();
  }

  getStats() {
    return {
      sequence: this.sequence,
      lastHash: this.lastHash,
      bufferedEvents: this.buffer.length,
      enabled: this.config.enabled
    };
  }
}

// Helper functions for creating audit events
export function createAuditEvent(
  eventType: string,
  actor: AuditEvent['actor'],
  resource: AuditEvent['resource'],
  action: string,
  outcome: AuditEvent['outcome'],
  details?: Record<string, any>,
  metadata?: Record<string, any>
): AuditEvent {
  return {
    id: createHash('md5')
      .update(Date.now().toString() + Math.random().toString())
      .digest('hex'),
    timestamp: new Date(),
    eventType,
    actor,
    resource,
    action,
    outcome,
    details,
    metadata
  };
}

export function createAuditSink(config: AuditSinkConfig): AuditSink {
  return new AuditSink(config);
}
