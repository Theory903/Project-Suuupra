# Multi-stage build for Counters Service
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git ca-certificates tzdata gcc musl-dev

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download && go mod verify

# Copy source code
COPY . .

# Build the application with optimizations
RUN CGO_ENABLED=1 GOOS=linux GOARCH=amd64 go build \
    -ldflags='-w -s -extldflags "-static"' \
    -a -installsuffix cgo \
    -o counters ./main.go

# Production stage
FROM alpine:3.18 AS production

# Install runtime dependencies
RUN apk --no-cache add \
    ca-certificates \
    tzdata \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S counters && \
    adduser -S counters -u 1001 -G counters

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder --chown=counters:counters /app/counters .

# Copy configuration files if they exist
COPY --from=builder --chown=counters:counters /app/config.yaml* ./
COPY --from=builder --chown=counters:counters /app/migrations/ ./migrations/

# Create directories for logs and data
RUN mkdir -p logs data && chown -R counters:counters logs data

# Switch to non-root user
USER counters

# Expose ports
EXPOSE 8086 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8086/health || exit 1

# Default command
CMD ["./counters"]

# Labels for metadata
LABEL maintainer="Suuupra Platform Team" \
      version="1.0.0" \
      description="Counters Service - High-performance distributed counters" \
      org.opencontainers.image.source="https://github.com/suuupra/platform" \
      org.opencontainers.image.vendor="Suuupra" \
      org.opencontainers.image.title="Counters Service" \
      org.opencontainers.image.description="Production-grade high-performance distributed counters service" \
      org.opencontainers.image.version="1.0.0"
