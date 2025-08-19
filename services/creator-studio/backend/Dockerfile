# Multi-stage build for production optimization
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    python3 \
    make \
    g++ \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
      npm ci --only=production --legacy-peer-deps; \
    else \
      npm install --only=production --legacy-peer-deps; \
    fi && npm cache clean --force

# Development stage
FROM base AS development
RUN if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi
COPY . .
EXPOSE 8089
CMD ["npm", "run", "dev"]

# Build stage
FROM base AS build
RUN if [ -f package-lock.json ] || [ -f npm-shrinkwrap.json ]; then \
      npm ci; \
    else \
      npm install; \
    fi
COPY . .
RUN npm run build

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache \
    ffmpeg \
    imagemagick \
    dumb-init \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && \
    adduser -S creator -u 1001 -G nodejs

WORKDIR /app

# Copy package files and install production dependencies
COPY package*.json ./
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# Copy built application
COPY --from=build --chown=creator:nodejs /app/dist ./dist
COPY --from=build --chown=creator:nodejs /app/public ./public

# Create necessary directories
RUN mkdir -p uploads temp logs && \
    chown -R creator:nodejs uploads temp logs

# Switch to non-root user
USER creator

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD node dist/scripts/healthcheck.js || exit 1

# Expose port
EXPOSE 8089

# Use dumb-init to handle signals properly
ENTRYPOINT ["dumb-init", "--"]
CMD ["node", "dist/index.js"]
