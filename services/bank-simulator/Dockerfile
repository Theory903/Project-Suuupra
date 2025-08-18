# Multi-stage build for optimized production image
FROM node:20-alpine AS base

# Install OpenSSL for Prisma compatibility
RUN apk add --no-cache openssl libc6-compat

# Install dependencies only when needed
FROM base AS deps
WORKDIR /app

# Copy package files
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Build the source code
FROM base AS builder
WORKDIR /app

# Copy package files and install all dependencies (including devDependencies)
COPY package.json package-lock.json* ./
RUN npm install --legacy-peer-deps

# Copy source code
COPY . .

# Generate Prisma client
RUN npx prisma generate

# Build the application
RUN npm run build

# Production image
FROM base AS runner
WORKDIR /app

# Create non-root user for security
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 bankapp

# Copy necessary files from previous stages
COPY --from=deps --chown=bankapp:nodejs /app/node_modules ./node_modules
COPY --from=builder --chown=bankapp:nodejs /app/dist ./dist
COPY --from=builder --chown=bankapp:nodejs /app/package.json ./
COPY --from=builder --chown=bankapp:nodejs /app/prisma ./prisma
COPY --from=builder --chown=bankapp:nodejs /app/proto ./proto

# Install production dependencies for Prisma
RUN npm install prisma --save-dev --legacy-peer-deps && npx prisma generate

# Create directories for logs and temp files
RUN mkdir -p /app/logs && chown -R bankapp:nodejs /app/logs
RUN mkdir -p /app/tmp && chown -R bankapp:nodejs /app/tmp

# Switch to non-root user
USER bankapp

# Expose ports
EXPOSE 3000 50051 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
  CMD node -e "require('http').get('http://localhost:3000/health', (res) => { process.exit(res.statusCode === 200 ? 0 : 1) })"

# Start the application
CMD ["node", "dist/index.js"]
