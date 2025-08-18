# Multi-stage build for Live Tracking Service
FROM rust:1.75-slim as builder

# Install system dependencies for building
RUN apt-get update && apt-get install -y \
    pkg-config \
    libssl-dev \
    libpq-dev \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create app directory
WORKDIR /app

# Copy Cargo files
COPY Cargo.toml Cargo.lock ./

# Create src directory and dummy main.rs to cache dependencies
RUN mkdir src && echo "fn main() {}" > src/main.rs

# Build dependencies (this layer will be cached)
RUN cargo build --release && rm -rf src target/release/deps/live_tracking*

# Copy source code
COPY . .

# Build the application
RUN cargo build --release --locked

# Production stage
FROM debian:bookworm-slim as production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libssl3 \
    libpq5 \
    ca-certificates \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r tracking && useradd -r -g tracking tracking

# Set working directory
WORKDIR /app

# Copy binary from builder stage
COPY --from=builder --chown=tracking:tracking /app/target/release/main ./live-tracking

# Copy migrations and config files if they exist
COPY --from=builder --chown=tracking:tracking /app/migrations/ ./migrations/
COPY --from=builder --chown=tracking:tracking /app/config.toml* ./

# Create directories for logs and data
RUN mkdir -p logs data && chown -R tracking:tracking logs data

# Switch to non-root user
USER tracking

# Expose ports
EXPOSE 8089 9090

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=45s --retries=3 \
    CMD curl -f http://localhost:8089/health || exit 1

# Default command
CMD ["./live-tracking"]

# Labels for metadata
LABEL maintainer="Suuupra Platform Team" \
      version="1.0.0" \
      description="Live Tracking Service - Real-time GPS and activity tracking" \
      org.opencontainers.image.source="https://github.com/suuupra/platform" \
      org.opencontainers.image.vendor="Suuupra" \
      org.opencontainers.image.title="Live Tracking Service" \
      org.opencontainers.image.description="Production-grade real-time GPS and activity tracking service" \
      org.opencontainers.image.version="1.0.0"
