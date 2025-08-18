# Multi-stage Dockerfile for Suuupra Creator Studio
FROM node:20-alpine AS base

# Install security updates and basic tools
RUN apk update && apk upgrade && \
    apk add --no-cache dumb-init curl ffmpeg && \
    rm -rf /var/cache/apk/*

# Create app user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S creator -u 1001 -G nodejs

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig*.json ./

# Production dependencies stage
FROM base AS deps
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# Build stage
FROM base AS build
RUN npm ci --legacy-peer-deps
COPY . .
RUN npm run build && \
    npm prune --production

# Production stage
FROM base AS production
RUN apk add --no-cache curl ffmpeg && rm -rf /var/cache/apk/*

# Copy built app and dependencies
COPY --from=deps --chown=creator:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=creator:nodejs /app/dist ./dist
COPY --from=build --chown=creator:nodejs /app/package.json ./

# Create necessary directories
RUN mkdir -p /app/logs /app/uploads /app/temp && \
    chown -R creator:nodejs /app

USER creator

EXPOSE 8093

HEALTHCHECK --interval=30s --timeout=10s --start-period=20s --retries=3 \
    CMD curl -f http://localhost:8093/health || exit 1

CMD ["dumb-init", "node", "dist/index.js"]
