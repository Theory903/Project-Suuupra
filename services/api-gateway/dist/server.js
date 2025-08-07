"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
// src/server.ts
const fastify_1 = __importDefault(require("fastify"));
const jwt_1 = __importDefault(require("@fastify/jwt"));
const oauth2_1 = __importDefault(require("@fastify/oauth2"));
const http_proxy_1 = __importDefault(require("@fastify/http-proxy"));
const opossum_1 = __importDefault(require("opossum"));
const app = (0, fastify_1.default)({ logger: true });
const port = 8080;
// const server = fastify();
// In a real application, this should be loaded from environment variables
const JWT_SECRET = "supersecretjwtkey";
app.register(jwt_1.default, {
    secret: JWT_SECRET,
});
// Placeholder for OAuth2 configuration. You'll need to replace these with your actual values.
// This example assumes a generic OAuth2 provider.
app.register(oauth2_1.default, {
    name: "googleOAuth2",
    scope: ["profile", "email"],
    credentials: {
        client: {
            id: "YOUR_GOOGLE_CLIENT_ID",
            secret: "YOUR_GOOGLE_CLIENT_SECRET",
        },
        auth: oauth2_1.default.GOOGLE_CONFIGURATION,
    },
    startRedirectPath: "/login/google",
    callbackUri: "http://localhost:8080/login/google/callback",
});
// Simulated Service Registry (in a real system, this would be dynamic)
const serviceRegistry = {
    identity: { url: "http://localhost:8081", circuitBreaker: null },
    content: { url: "http://localhost:8082", circuitBreaker: null },
    commerce: { url: "http://localhost:8083", circuitBreaker: null },
    payments: { url: "http://localhost:8084", circuitBreaker: null },
    ledger: { url: "http://localhost:8085", circuitBreaker: null },
    "live-classes": { url: "http://localhost:8086", circuitBreaker: null },
    vod: { url: "http://localhost:8087", circuitBreaker: null },
    "mass-live": { url: "http://localhost:8088", circuitBreaker: null },
    "creator-studio": { url: "http://localhost:8089", circuitBreaker: null },
    recommendations: { url: "http://localhost:8090", circuitBreaker: null },
    "search-crawler": { url: "http://localhost:8091", circuitBreaker: null },
    "llm-tutor": { url: "http://localhost:8092", circuitBreaker: null },
    analytics: { url: "http://localhost:8093", circuitBreaker: null },
    counters: { url: "http://localhost:8094", circuitBreaker: null },
    "live-tracking": { url: "http://localhost:8095", circuitBreaker: null },
    notifications: { url: "http://localhost:8096", circuitBreaker: null },
    admin: { url: "http://localhost:8097", circuitBreaker: null },
};
// Initialize Circuit Breakers for each service
for (const serviceName in serviceRegistry) {
    const service = serviceRegistry[serviceName];
    const options = {
        timeout: 3000, // If our service takes longer than 3 seconds, trigger a timeout
        errorThresholdPercentage: 50, // If 50% of requests fail, open the circuit
        resetTimeout: 10000, // After 10 seconds, try to close the circuit again
    };
    // The actual function executed by the circuit breaker will be the proxy call
    service.circuitBreaker = new opossum_1.default((request, reply) => {
        // This function is a placeholder. The actual proxying happens via fastify-http-proxy.
        // We just need a function for Opossum to wrap.
        return Promise.resolve();
    }, options);
    service.circuitBreaker.on("open", () => app.log.warn(`Circuit breaker for ${serviceName} opened!`));
    service.circuitBreaker.on("halfOpen", () => app.log.info(`Circuit breaker for ${serviceName} half-opened.`));
    service.circuitBreaker.on("close", () => app.log.info(`Circuit breaker for ${serviceName} closed.`));
    service.circuitBreaker.on("fallback", () => app.log.error(`Circuit breaker for ${serviceName} triggered fallback!`));
}
// Register HTTP Proxy for dynamic routing and circuit breaking
app.register(http_proxy_1.default, {
    // This upstream is a dummy, it will be overridden by preHandler
    upstream: "http://localhost:8080",
    prefix: "/",
    rewritePrefix: "/",
    preHandler: async (request, reply, done) => {
        const path = request.url;
        let targetService = null;
        let serviceName = null;
        // Simple path-based service discovery
        if (path.startsWith("/identity")) {
            targetService = serviceRegistry.identity;
            serviceName = "identity";
        }
        else if (path.startsWith("/content")) {
            targetService = serviceRegistry.content;
            serviceName = "content";
        }
        else if (path.startsWith("/commerce")) {
            targetService = serviceRegistry.commerce;
            serviceName = "commerce";
        }
        else if (path.startsWith("/payments")) {
            targetService = serviceRegistry.payments;
            serviceName = "payments";
        }
        else if (path.startsWith("/ledger")) {
            targetService = serviceRegistry.ledger;
            serviceName = "ledger";
        }
        else if (path.startsWith("/live-classes")) {
            targetService = serviceRegistry["live-classes"];
            serviceName = "live-classes";
        }
        else if (path.startsWith("/vod")) {
            targetService = serviceRegistry.vod;
            serviceName = "vod";
        }
        else if (path.startsWith("/mass-live")) {
            targetService = serviceRegistry["mass-live"];
            serviceName = "mass-live";
        }
        else if (path.startsWith("/creator-studio")) {
            targetService = serviceRegistry["creator-studio"];
            serviceName = "creator-studio";
        }
        else if (path.startsWith("/recommendations")) {
            targetService = serviceRegistry.recommendations;
            serviceName = "recommendations";
        }
        else if (path.startsWith("/search-crawler")) {
            targetService = serviceRegistry["search-crawler"];
            serviceName = "search-crawler";
        }
        else if (path.startsWith("/llm-tutor")) {
            targetService = serviceRegistry["llm-tutor"];
            serviceName = "llm-tutor";
        }
        else if (path.startsWith("/analytics")) {
            targetService = serviceRegistry.analytics;
            serviceName = "analytics";
        }
        else if (path.startsWith("/counters")) {
            targetService = serviceRegistry.counters;
            serviceName = "counters";
        }
        else if (path.startsWith("/live-tracking")) {
            targetService = serviceRegistry["live-tracking"];
            serviceName = "live-tracking";
        }
        else if (path.startsWith("/notifications")) {
            targetService = serviceRegistry.notifications;
            serviceName = "notifications";
        }
        else if (path.startsWith("/admin")) {
            targetService = serviceRegistry.admin;
            serviceName = "admin";
        }
        // Add more conditions for other services
        if (targetService && targetService.circuitBreaker) {
            try {
                // Execute the proxy request through the circuit breaker
                await targetService.circuitBreaker.fire(async () => {
                    // Set the upstream for this specific request
                    request.proxy = {
                        upstream: targetService.url,
                        rewritePrefix: `/${serviceName}`,
                    };
                    request.log.info(`Proxying request to ${targetService.url} with rewritePrefix /${serviceName}`);
                    done();
                }, request, reply); // Pass request and reply to the circuit breaker function
            }
            catch (err) {
                // Circuit breaker is open or request failed
                app.log.error(`Circuit breaker for ${serviceName} is open or request failed: ${err.message}`);
                reply.status(503).send({
                    error: "Service Unavailable",
                    message: `The service ${serviceName} is currently unavailable. Please try again later.`,
                });
            }
        }
        else {
            // No matching service found or circuit breaker not initialized, proceed with other routes or return 404
            done();
        }
    },
});
app.get("/healthz", (req, reply) => {
    reply.send({ suxxess: true });
});
// Authentication pre-handler
app.decorate("authenticate", async (request, reply) => {
    try {
        await request.jwtVerify();
    }
    catch (err) {
        reply.send(err);
    }
});
// Protected route
app.get("/protected", { preHandler: [app.authenticate] }, async (request, reply) => {
    reply.send({
        message: "Welcome to the protected route!",
        user: request.user,
    });
});
// OAuth2 callback route
app.get("/login/google/callback", async (request, reply) => {
    const token = await app.googleOAuth2.getAccessTokenFromAuthorizationCodeFlow(request);
    // In a real application, you would exchange this token for your own JWT
    reply.send({ access_token: token.token.access_token });
});
const start = async () => {
    try {
        await app.listen({ port });
    }
    catch (error) {
        app.log.error(error);
        process.exit(1);
    }
};
start();
