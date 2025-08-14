# Multi-stage build for optimized production image
FROM golang:1.21-alpine AS builder

# Install git and ca-certificates
RUN apk add --no-cache git ca-certificates tzdata

# Set working directory
WORKDIR /app

# Copy go mod files
COPY go.mod go.sum ./

# Download dependencies
RUN go mod download

# Copy source code
COPY . .

# Build the application
RUN CGO_ENABLED=0 GOOS=linux go build -a -installsuffix cgo -o upi-core cmd/server/main.go

# Final stage
FROM alpine:latest

# Install ca-certificates for SSL/TLS
RUN apk --no-cache add ca-certificates tzdata

# Create non-root user
RUN addgroup -g 1001 -S upicore && \
    adduser -u 1001 -S upicore -G upicore

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder /app/upi-core .

# Copy configuration files if they exist (optional)
# COPY --from=builder /app/configs ./configs/

# Change ownership to non-root user
RUN chown -R upicore:upicore /app

# Switch to non-root user
USER upicore

# Expose ports
EXPOSE 50051 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD ./upi-core --help > /dev/null || exit 1

# Run the application
ENTRYPOINT ["./upi-core"]
