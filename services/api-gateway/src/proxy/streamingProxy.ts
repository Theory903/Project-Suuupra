/**
 * What: SSE/chunked streaming proxy for AI endpoints with cancellation support
 * Why: Enable real-time streaming responses from LLM services with proper cleanup
 * How: Pipe streams with abort controllers, handle SSE format, support cancellation
 */

import * as http from 'http';
import { FastifyRequest, FastifyReply } from 'fastify';
import { Transform } from 'stream';

export interface StreamingProxyOptions {
  timeout?: number;
  bufferSize?: number;
  enableCancellation?: boolean;
}

export class SSETransform extends Transform {
  private buffer = '';

  _transform(chunk: any, encoding: BufferEncoding, callback: Function) {
    this.buffer += chunk.toString();
    
    // Process complete lines
    const lines = this.buffer.split('\n');
    this.buffer = lines.pop() || ''; // Keep incomplete line in buffer
    
    for (const line of lines) {
      if (line.startsWith('data: ')) {
        // Forward SSE data lines
        this.push(line + '\n');
      } else if (line.startsWith('event: ') || line.startsWith('id: ') || line.startsWith('retry: ')) {
        // Forward other SSE control lines
        this.push(line + '\n');
      } else if (line.trim() === '') {
        // Forward empty lines (message separators)
        this.push('\n');
      } else {
        // Wrap non-SSE content as data
        this.push(`data: ${line}\n\n`);
      }
    }
    
    callback();
  }

  _flush(callback: Function) {
    if (this.buffer.trim()) {
      this.push(`data: ${this.buffer}\n\n`);
    }
    callback();
  }
}

export async function streamingProxyAction(
  req: FastifyRequest,
  reply: FastifyReply,
  serviceUrl: string,
  options: StreamingProxyOptions = {}
): Promise<void> {
  return new Promise((resolve, reject) => {
    const url = new URL(serviceUrl);
    const path = (req.params as any)['*'];
    const originalUrl = req.raw.url || '/';
    const originalSearch = originalUrl.includes('?')
      ? originalUrl.substring(originalUrl.indexOf('?'))
      : '';
    const fullPath = `/${path}${originalSearch}`;

    const headers = { ...req.headers } as Record<string, string | string[] | undefined>;
    delete (headers as any).host;
    
    // Add streaming-specific headers
    headers['accept'] = 'text/event-stream, text/plain, */*';
    headers['cache-control'] = 'no-cache';

    const abortController = new AbortController();
    const timeout = options.timeout || 30000;

    const timeoutId = setTimeout(() => {
      abortController.abort();
      reject(new Error('Streaming request timeout'));
    }, timeout);

    // Handle client disconnect
    req.raw.on('close', () => {
      if (options.enableCancellation) {
        abortController.abort();
      }
    });

    const requestOptions = {
      hostname: url.hostname,
      port: url.port,
      path: fullPath,
      method: req.method,
      headers,
      signal: abortController.signal,
    };

    const upstreamReq = http.request(requestOptions, (res) => {
      clearTimeout(timeoutId);
      
      if (res.statusCode && res.statusCode >= 400) {
        reject(new Error(`Service returned status ${res.statusCode}`));
        return;
      }

      // Set streaming response headers
      reply.header('content-type', res.headers['content-type'] || 'text/event-stream');
      reply.header('cache-control', 'no-cache');
      reply.header('connection', 'keep-alive');
      reply.header('access-control-allow-origin', '*');
      reply.header('access-control-allow-headers', 'Cache-Control');

      // Copy other response headers
      const hopByHop = new Set(['connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization', 'te', 'trailers', 'transfer-encoding', 'upgrade']);
      for (const [key, value] of Object.entries(res.headers)) {
        if (!hopByHop.has(key.toLowerCase()) && key !== 'content-type' && key !== 'cache-control') {
          reply.header(key, value as string);
        }
      }

      reply.status(res.statusCode || 200);

      // Check if response is SSE format
      const contentType = res.headers['content-type'] || '';
      const isSSE = contentType.includes('text/event-stream');
      
      if (isSSE) {
        // Direct pipe for SSE
        res.pipe(reply.raw);
      } else {
        // Transform to SSE format
        const sseTransform = new SSETransform();
        res.pipe(sseTransform).pipe(reply.raw);
      }

      res.on('end', () => {
        resolve();
      });

      res.on('error', (err) => {
        reject(err);
      });
    });

    upstreamReq.on('error', (err) => {
      clearTimeout(timeoutId);
      reject(err);
    });

    // Pipe request body if present
    if (req.method !== 'GET' && req.method !== 'HEAD') {
      req.raw.pipe(upstreamReq);
    } else {
      upstreamReq.end();
    }
  });
}

export function isStreamingRequest(req: FastifyRequest): boolean {
  const accept = req.headers.accept || '';
  const contentType = req.headers['content-type'] || '';
  
  return (
    accept.includes('text/event-stream') ||
    accept.includes('application/x-ndjson') ||
    contentType.includes('text/event-stream') ||
    req.headers['x-streaming'] === 'true'
  );
}
