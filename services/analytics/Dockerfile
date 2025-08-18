# Multi-stage build for Analytics Service
FROM python:3.11-slim as builder

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PIP_NO_CACHE_DIR=1 \
    PIP_DISABLE_PIP_VERSION_CHECK=1

# Install system dependencies
RUN apt-get update && apt-get install -y \
    build-essential \
    curl \
    git \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Create and set work directory
WORKDIR /app

# Copy requirements and install Python dependencies
COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Production stage
FROM python:3.11-slim as production

# Set environment variables
ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    ENVIRONMENT=production \
    LOG_LEVEL=INFO \
    PORT=8087

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    libpq5 \
    curl \
    && rm -rf /var/lib/apt/lists/* \
    && groupadd -r analytics \
    && useradd -r -g analytics analytics

# Copy Python packages from builder
COPY --from=builder /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=builder /usr/local/bin /usr/local/bin

# Create app directory and set permissions
WORKDIR /app
RUN mkdir -p /app/data /app/logs /app/models \
    && chown -R analytics:analytics /app

# Copy application code
COPY --chown=analytics:analytics . .

# Create startup script for better process management
RUN echo '#!/bin/bash\n\
set -e\n\
echo "Starting Analytics Service..."\n\
exec python main.py\n' > /app/start.sh \
    && chmod +x /app/start.sh \
    && chown analytics:analytics /app/start.sh

# Switch to non-root user
USER analytics

# Expose port
EXPOSE 8087

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8087/health || exit 1

# Default command
CMD ["/app/start.sh"]

# Labels for metadata
LABEL maintainer="Suuupra Platform Team" \
      version="1.0.0" \
      description="Analytics Service - Real-time data collection and business intelligence" \
      org.opencontainers.image.source="https://github.com/suuupra/platform" \
      org.opencontainers.image.vendor="Suuupra" \
      org.opencontainers.image.title="Analytics Service" \
      org.opencontainers.image.description="Production-grade analytics and business intelligence service" \
      org.opencontainers.image.version="1.0.0"
