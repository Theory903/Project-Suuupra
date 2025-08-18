# Production-ready Dockerfile for Live Classes Service
FROM node:20-alpine AS base

# Install system dependencies
RUN apk add --no-cache \
    python3 \
    make \
    g++ \
    ffmpeg \
    && rm -rf /var/cache/apk/*

WORKDIR /app

# Copy package files
COPY package*.json ./
COPY tsconfig.json ./

# Install dependencies
RUN npm ci --only=production --legacy-peer-deps && npm cache clean --force

# Development stage
FROM base AS development
RUN npm ci
COPY . .
RUN npm run build
CMD ["npm", "run", "dev"]

# Production build stage
FROM base AS build
COPY . .
RUN npm ci
RUN npm run build
RUN npm prune --production

# Production stage
FROM node:20-alpine AS production

# Install runtime dependencies
RUN apk add --no-cache ffmpeg && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S nodejs && adduser -S nodejs -u 1001

WORKDIR /app

# Copy built application
COPY --from=build --chown=nodejs:nodejs /app/dist ./dist
COPY --from=build --chown=nodejs:nodejs /app/node_modules ./node_modules
COPY --from=build --chown=nodejs:nodejs /app/package.json ./package.json
COPY --from=build --chown=nodejs:nodejs /app/prisma ./prisma

# Create recordings directory
RUN mkdir -p /recordings && chown nodejs:nodejs /recordings

USER nodejs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD node -e "require('http').get('http://localhost:8086/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

EXPOSE 8086
EXPOSE 40000-49999/udp

CMD ["node", "dist/index.js"]