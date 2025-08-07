/**
 * What: Prompt batching processor for AI endpoints to optimize small requests
 * Why: Reduce latency and increase throughput by batching small prompts together
 * How: Queue small requests, batch them up to size/time limits, process together
 */

import { FastifyRequest } from 'fastify';
import { EventEmitter } from 'events';

export interface BatchRequest {
  id: string;
  request: FastifyRequest;
  prompt: string;
  metadata: Record<string, any>;
  timestamp: number;
  resolve: (response: any) => void;
  reject: (error: any) => void;
}

export interface BatchConfig {
  maxBatchSize: number;
  maxWaitTimeMs: number;
  maxPromptLength: number; // Only batch prompts shorter than this
  enabled: boolean;
}

export interface BatchResponse {
  responses: Array<{
    id: string;
    response: any;
    error?: string;
  }>;
}

const DEFAULT_BATCH_CONFIG: BatchConfig = {
  maxBatchSize: 10,
  maxWaitTimeMs: 100, // 100ms
  maxPromptLength: 500, // 500 characters
  enabled: false,
};

export class PromptBatchProcessor extends EventEmitter {
  private config: BatchConfig;
  private pendingRequests: BatchRequest[] = [];
  private batchTimer?: NodeJS.Timeout;
  private batchCounter = 0;

  constructor(config: Partial<BatchConfig> = {}) {
    super();
    this.config = { ...DEFAULT_BATCH_CONFIG, ...config };
  }

  async processRequest(
    request: FastifyRequest,
    prompt: string,
    metadata: Record<string, any> = {}
  ): Promise<any> {
    if (!this.config.enabled) {
      throw new Error('Batching is disabled');
    }

    // Don't batch large prompts
    if (prompt.length > this.config.maxPromptLength) {
      throw new Error('Prompt too large for batching');
    }

    const requestId = this.generateRequestId();
    
    return new Promise((resolve, reject) => {
      const batchRequest: BatchRequest = {
        id: requestId,
        request,
        prompt,
        metadata,
        timestamp: Date.now(),
        resolve,
        reject,
      };

      this.addToBatch(batchRequest);
    });
  }

  private addToBatch(request: BatchRequest): void {
    this.pendingRequests.push(request);

    // If we've reached max batch size, process immediately
    if (this.pendingRequests.length >= this.config.maxBatchSize) {
      this.processBatch();
      return;
    }

    // Set timer for batch processing if not already set
    if (!this.batchTimer) {
      this.batchTimer = setTimeout(() => {
        this.processBatch();
      }, this.config.maxWaitTimeMs);
    }
  }

  private async processBatch(): Promise<void> {
    if (this.pendingRequests.length === 0) return;

    // Clear timer
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    // Take current batch
    const batch = this.pendingRequests.splice(0);
    const batchId = `batch_${++this.batchCounter}_${Date.now()}`;

    try {
      const batchResponse = await this.executeBatch(batchId, batch);
      this.distributeBatchResponses(batch, batchResponse);
    } catch (error) {
      // If batch processing fails, reject all requests
      for (const request of batch) {
        request.reject(error);
      }
    }

    this.emit('batch_processed', {
      batchId,
      requestCount: batch.length,
      success: true,
    });
  }

  private async executeBatch(batchId: string, requests: BatchRequest[]): Promise<BatchResponse> {
    // Create batch payload
    const batchPayload = {
      batch_id: batchId,
      requests: requests.map(req => ({
        id: req.id,
        prompt: req.prompt,
        metadata: req.metadata,
      })),
    };

    // In a real implementation, this would call the AI service's batch endpoint
    // For now, we'll simulate batch processing
    const responses = await this.simulateBatchProcessing(batchPayload);

    return { responses };
  }

  private async simulateBatchProcessing(payload: any): Promise<Array<{ id: string; response: any; error?: string }>> {
    // Simulate processing delay
    await new Promise(resolve => setTimeout(resolve, 50));

    return payload.requests.map((req: any) => ({
      id: req.id,
      response: {
        text: `Batched response for: ${req.prompt}`,
        model: 'batch-processor-v1',
        usage: { tokens: req.prompt.length },
        batch_id: payload.batch_id,
      },
    }));
  }

  private distributeBatchResponses(requests: BatchRequest[], batchResponse: BatchResponse): void {
    const responseMap = new Map(batchResponse.responses.map(r => [r.id, r]));

    for (const request of requests) {
      const response = responseMap.get(request.id);
      
      if (response) {
        if (response.error) {
          request.reject(new Error(response.error));
        } else {
          request.resolve(response.response);
        }
      } else {
        request.reject(new Error('No response received for request'));
      }
    }
  }

  private generateRequestId(): string {
    return `req_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
  }

  getStats(): {
    pendingRequests: number;
    batchesProcessed: number;
    config: BatchConfig;
  } {
    return {
      pendingRequests: this.pendingRequests.length,
      batchesProcessed: this.batchCounter,
      config: { ...this.config },
    };
  }

  updateConfig(newConfig: Partial<BatchConfig>): void {
    this.config = { ...this.config, ...newConfig };
    
    // If batching is disabled, process any pending requests immediately
    if (!this.config.enabled && this.pendingRequests.length > 0) {
      this.processBatch();
    }
  }

  shutdown(): void {
    if (this.batchTimer) {
      clearTimeout(this.batchTimer);
      this.batchTimer = undefined;
    }

    // Process any remaining requests
    if (this.pendingRequests.length > 0) {
      this.processBatch();
    }
  }
}

// Global batch processor instances per route
const batchProcessors = new Map<string, PromptBatchProcessor>();

export function getBatchProcessor(routeId: string, config?: Partial<BatchConfig>): PromptBatchProcessor {
  let processor = batchProcessors.get(routeId);
  
  if (!processor) {
    processor = new PromptBatchProcessor(config);
    batchProcessors.set(routeId, processor);
  } else if (config) {
    processor.updateConfig(config);
  }
  
  return processor;
}

export function removeBatchProcessor(routeId: string): void {
  const processor = batchProcessors.get(routeId);
  if (processor) {
    processor.shutdown();
    batchProcessors.delete(routeId);
  }
}

export function getAllBatchProcessors(): Map<string, PromptBatchProcessor> {
  return new Map(batchProcessors);
}

// Helper function to determine if a request should be batched
export function shouldBatchRequest(
  request: FastifyRequest,
  config: BatchConfig
): { shouldBatch: boolean; reason?: string } {
  if (!config.enabled) {
    return { shouldBatch: false, reason: 'Batching disabled' };
  }

  const contentType = request.headers['content-type'] || '';
  if (!contentType.includes('application/json')) {
    return { shouldBatch: false, reason: 'Non-JSON content type' };
  }

  const body = request.body as any;
  if (!body || !body.prompt) {
    return { shouldBatch: false, reason: 'No prompt in request body' };
  }

  if (typeof body.prompt !== 'string') {
    return { shouldBatch: false, reason: 'Prompt is not a string' };
  }

  if (body.prompt.length > config.maxPromptLength) {
    return { shouldBatch: false, reason: 'Prompt too long for batching' };
  }

  // Don't batch streaming requests
  const accept = request.headers.accept || '';
  if (accept.includes('text/event-stream')) {
    return { shouldBatch: false, reason: 'Streaming request' };
  }

  return { shouldBatch: true };
}
