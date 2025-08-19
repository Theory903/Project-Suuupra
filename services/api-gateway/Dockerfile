# Multi-stage build for optimized API Gateway
FROM node:20-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init tini && \
    rm -rf /var/cache/apk/*

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S gateway -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
      npm ci --include=dev; \
    else \
      npm install --include=dev; \
    fi
COPY . .
RUN chown -R gateway:nodejs /app
USER gateway
EXPOSE 3001
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
ENV NODE_ENV=production
RUN if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
      npm ci --only=production --legacy-peer-deps; \
    else \
      npm install --only=production --legacy-peer-deps; \
    fi && npm cache clean --force
COPY . .
RUN npm run build && \
    npm prune --production

# Production stage
FROM node:20-alpine AS production

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init tini curl && \
    rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S gateway -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=build --chown=gateway:nodejs /app/dist ./dist
COPY --from=build --chown=gateway:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=gateway:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown -R gateway:nodejs logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3001/health || exit 1

# Switch to non-root user
USER gateway

# Expose port
EXPOSE 3001

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["dumb-init", "node", "dist/server.js"]

# Labels for metadata
LABEL maintainer="Suuupra Platform Team" \
      version="1.0.0" \
      description="API Gateway - Unified entry point for all microservices" \
      org.opencontainers.image.source="https://github.com/suuupra/platform" \
      org.opencontainers.image.vendor="Suuupra" \
      org.opencontainers.image.title="API Gateway" \
      org.opencontainers.image.description="Production-grade API gateway with authentication, rate limiting, and load balancing" \
      org.opencontainers.image.version="1.0.0"
