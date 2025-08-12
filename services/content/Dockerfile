# Multi-stage build for production optimization
FROM node:18-alpine AS base

# Install security updates and required packages
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init tini && \
    rm -rf /var/cache/apk/*

# Create app user for security
RUN addgroup -g 1001 -S nodejs && \
    adduser -S contentservice -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Development stage
FROM base AS development
ENV NODE_ENV=development
RUN npm ci --include=dev
COPY . .
RUN chown -R contentservice:nodejs /app
USER contentservice
EXPOSE 8082
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
ENV NODE_ENV=production
RUN npm ci --only=production && npm cache clean --force
COPY . .
RUN npm run build && \
    npm prune --production

# Production stage
FROM node:18-alpine AS production

# Install security updates and runtime dependencies
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init tini curl && \
    rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S contentservice -u 1001 -G nodejs

# Set working directory
WORKDIR /app

# Copy built application
COPY --from=build --chown=contentservice:nodejs /app/dist ./dist
COPY --from=build --chown=contentservice:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=contentservice:nodejs /app/package*.json ./

# Create logs directory
RUN mkdir -p logs && chown -R contentservice:nodejs logs

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8082/health || exit 1

# Switch to non-root user
USER contentservice

# Expose port
EXPOSE 8082

# Use tini as init system for proper signal handling
ENTRYPOINT ["/sbin/tini", "--"]

# Start application
CMD ["dumb-init", "node", "dist/server.js"]

# Labels for metadata
LABEL maintainer="Suuupra Platform Team" \
      version="1.0.0" \
      description="Content Management Service" \
      org.opencontainers.image.source="https://github.com/suuupra/platform" \
      org.opencontainers.image.vendor="Suuupra" \
      org.opencontainers.image.title="Content Service" \
      org.opencontainers.image.description="Production-grade content management service" \
      org.opencontainers.image.version="1.0.0"
