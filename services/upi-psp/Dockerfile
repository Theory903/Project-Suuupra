# Multi-stage build for UPI PSP Service
FROM golang:1.21-alpine AS builder

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
    -o upi-psp ./cmd/main.go

# Production stage
FROM alpine:3.18 AS production

# Install runtime dependencies
RUN apk --no-cache add \
    ca-certificates \
    tzdata \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S upipsp && \
    adduser -S upipsp -u 1001 -G upipsp

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder --chown=upipsp:upipsp /app/upi-psp .

# Copy configuration files
COPY --from=builder --chown=upipsp:upipsp /app/config.yaml* ./
COPY --from=builder --chown=upipsp:upipsp /app/migrations/ ./migrations/

# Create directories for logs and data
RUN mkdir -p logs data && chown -R upipsp:upipsp logs data

# Switch to non-root user
USER upipsp

# Expose ports
EXPOSE 8097 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
    CMD curl -f http://localhost:8097/health || exit 1

# Default command
CMD ["./upi-psp"]

# Labels for metadata
LABEL maintainer="Suuupra Platform Team" \
      version="1.0.0" \
      description="UPI PSP Service - UPI Payment Service Provider" \
      org.opencontainers.image.source="https://github.com/suuupra/platform" \
      org.opencontainers.image.vendor="Suuupra" \
      org.opencontainers.image.title="UPI PSP Service" \
      org.opencontainers.image.description="Production-grade UPI Payment Service Provider" \
      org.opencontainers.image.version="1.0.0"
