# Production-ready Dockerfile for VOD Service
FROM python:3.11-slim AS base

# Install system dependencies including FFmpeg
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    build-essential \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy requirements first for better caching
COPY requirements.txt .

# Install Python dependencies
RUN pip install --no-cache-dir -r requirements.txt

# Development stage
FROM base AS development
COPY . .
CMD ["python", "-m", "src.main"]

# Production build stage
FROM base AS build
COPY . .

# Production stage
FROM python:3.11-slim AS production

# Install runtime dependencies
RUN apt-get update && apt-get install -y \
    ffmpeg \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Create non-root user
RUN groupadd -r voduser && useradd -r -g voduser voduser

WORKDIR /app

# Copy application from build stage
COPY --from=build /app .
COPY --from=build /usr/local/lib/python3.11/site-packages /usr/local/lib/python3.11/site-packages
COPY --from=build /usr/local/bin /usr/local/bin

# Create necessary directories
RUN mkdir -p /tmp/videos /tmp/transcoded && \
    chown -R voduser:voduser /app /tmp/videos /tmp/transcoded

USER voduser

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=30s --retries=3 \
  CMD curl -f http://localhost:8087/health || exit 1

EXPOSE 8087

CMD ["python", "-m", "src.main"]