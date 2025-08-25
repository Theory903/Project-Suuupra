/**
 * Stub implementation for OpenTelemetry observability
 */

export enum SpanStatusCode {
  OK = 1,
  ERROR = 2,
}

export interface TraceContext {
  traceId?: string;
  spanId?: string;
}

export class OpenTelemetryManager {
  constructor(private config: any) {
    console.log('[OpenTelemetry] Initialized stub manager');
  }

  getCurrentTraceContext(): TraceContext | null {
    return {
      traceId: `trace-${Date.now()}`,
      spanId: `span-${Math.random().toString(36).substr(2, 9)}`,
    };
  }

  createSpan(name: string, options?: any) {
    return {
      setStatus: (status: SpanStatusCode) => {},
      setAttributes: (attrs: any) => {},
      recordException: (error: Error) => {},
      end: () => {},
    };
  }

  startActiveSpan(name: string, callback: (span: any) => any) {
    const span = this.createSpan(name);
    try {
      return callback(span);
    } finally {
      span.end();
    }
  }
}

// Stub for observability metrics
export const httpRequestDuration = {
  observe: (labels: any, duration: number) => {},
};

export const httpRequestsTotal = {
  inc: (labels: any) => {},
};

export const httpServerErrorsTotal = {
  inc: (labels: any) => {},
};

export function exposeMetricsRoute() {
  return (req: any, reply: any) => {
    reply.type('text/plain');
    reply.send('# No metrics available in stub mode\n');
  };
}
