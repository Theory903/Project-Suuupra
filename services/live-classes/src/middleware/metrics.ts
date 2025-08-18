import { FastifyInstance, FastifyRequest, FastifyReply } from 'fastify';
import promClient from 'prom-client';
import { logger } from '../utils/logger.js';

// Metrics
const httpRequestDuration = new promClient.Histogram({
  name: 'http_request_duration_seconds',
  help: 'Duration of HTTP requests in seconds',
  labelNames: ['method', 'route', 'status_code'],
  buckets: [0.1, 0.5, 1, 2, 5, 10]
});

const httpRequestTotal = new promClient.Counter({
  name: 'http_requests_total',
  help: 'Total number of HTTP requests',
  labelNames: ['method', 'route', 'status_code']
});

const activeConnections = new promClient.Gauge({
  name: 'websocket_connections_active',
  help: 'Number of active WebSocket connections'
});

const roomsActive = new promClient.Gauge({
  name: 'rooms_active_total',
  help: 'Number of active rooms'
});

const participantsTotal = new promClient.Gauge({
  name: 'participants_total',
  help: 'Total number of participants across all rooms'
});

const recordingActive = new promClient.Gauge({
  name: 'recordings_active_total',
  help: 'Number of active recordings'
});

// Register default metrics
promClient.register.setDefaultLabels({
  service: 'live-classes'
});

promClient.collectDefaultMetrics({
  register: promClient.register,
  prefix: 'live_classes_'
});

export async function metricsMiddleware(app: FastifyInstance) {
  // Request metrics
  app.addHook('onRequest', async (request: FastifyRequest) => {
    (request as any).startTime = Date.now();
  });

  app.addHook('onResponse', async (request: FastifyRequest, reply: FastifyReply) => {
    const duration = (Date.now() - (request as any).startTime) / 1000;
    const route = request.routerPath || request.url;
    const method = request.method;
    const statusCode = reply.statusCode.toString();

    httpRequestDuration
      .labels(method, route, statusCode)
      .observe(duration);

    httpRequestTotal
      .labels(method, route, statusCode)
      .inc();
  });

  // Metrics endpoint
  app.get('/metrics', async (request, reply) => {
    reply.type('text/plain');
    return promClient.register.metrics();
  });
}

// Metrics helpers for WebSocket and MediaSoup
export const metrics = {
  incrementConnections: () => activeConnections.inc(),
  decrementConnections: () => activeConnections.dec(),
  setActiveRooms: (count: number) => roomsActive.set(count),
  setTotalParticipants: (count: number) => participantsTotal.set(count),
  setActiveRecordings: (count: number) => recordingActive.set(count),
  
  // Custom metrics
  recordRoomCreated: new promClient.Counter({
    name: 'rooms_created_total',
    help: 'Total number of rooms created'
  }),
  
  recordRoomEnded: new promClient.Counter({
    name: 'rooms_ended_total',
    help: 'Total number of rooms ended'
  }),
  
  recordParticipantJoined: new promClient.Counter({
    name: 'participants_joined_total',
    help: 'Total number of participants joined'
  }),
  
  recordParticipantLeft: new promClient.Counter({
    name: 'participants_left_total',
    help: 'Total number of participants left'
  }),
  
  recordingStarted: new promClient.Counter({
    name: 'recordings_started_total',
    help: 'Total number of recordings started'
  }),
  
  recordingStopped: new promClient.Counter({
    name: 'recordings_stopped_total',
    help: 'Total number of recordings stopped'
  }),
  
  chatMessagesSent: new promClient.Counter({
    name: 'chat_messages_sent_total',
    help: 'Total number of chat messages sent'
  }),
  
  webrtcConnectionsEstablished: new promClient.Counter({
    name: 'webrtc_connections_established_total',
    help: 'Total number of WebRTC connections established'
  }),
  
  webrtcConnectionsFailed: new promClient.Counter({
    name: 'webrtc_connections_failed_total',
    help: 'Total number of WebRTC connections failed'
  })
};
