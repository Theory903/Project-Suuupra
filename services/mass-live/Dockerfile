# Multi-stage build for Go application with FFmpeg
FROM golang:1.23-alpine AS builder

# Install build dependencies
RUN apk add --no-cache git gcc musl-dev

WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=1 GOOS=linux go build -a -installsuffix cgo -o main ./cmd/main.go

# Production stage with FFmpeg
FROM alpine:3.18 AS production

# Install runtime dependencies including FFmpeg
RUN apk add --no-cache \
    ca-certificates \
    ffmpeg \
    tzdata \
    curl \
    && rm -rf /var/cache/apk/*

# Create non-root user
RUN addgroup -g 1001 -S appgroup && \
    adduser -u 1001 -S appuser -G appgroup

WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/main .

# Create necessary directories
RUN mkdir -p /tmp/streams /tmp/segments && \
    chown -R appuser:appgroup /app /tmp/streams /tmp/segments

# Switch to non-root user
USER appuser

# Expose ports
EXPOSE 8088 1935

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:8088/health || exit 1

CMD ["./main"]
