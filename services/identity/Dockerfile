# Multi-stage build for optimized Java application
FROM eclipse-temurin:17-jdk AS builder

# Set working directory
WORKDIR /app

# Copy Maven wrapper and POM
COPY .mvn/ .mvn/
COPY mvnw pom.xml ./

# Download dependencies
RUN ./mvnw dependency:go-offline -B

# Copy source code
COPY src/ src/

# Build the application
RUN ./mvnw clean package -DskipTests -B

# Production stage
FROM eclipse-temurin:17-jre AS production

# Install security updates and curl for health checks
RUN apt-get update && apt-get upgrade -y && \
    apt-get install -y curl dumb-init && \
    rm -rf /var/lib/apt/lists/*

# Create non-root user for security
RUN groupadd -g 1001 identity && \
    useradd -r -u 1001 -g identity identityuser

# Set working directory
WORKDIR /app

# Copy built JAR from builder stage
ARG JAR_FILE=target/*.jar
COPY --from=builder --chown=identityuser:identity /app/${JAR_FILE} app.jar

# Create logs directory
RUN mkdir -p logs && chown -R identityuser:identity logs

# Health check
HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
    CMD curl -f http://localhost:8081/actuator/health || exit 1

# Switch to non-root user
USER identityuser

# Expose port
EXPOSE 8081

# Use dumb-init for proper signal handling
ENTRYPOINT ["dumb-init", "--"]

# JVM optimizations and application start
CMD ["java", \
     "-server", \
     "-XX:+UseContainerSupport", \
     "-XX:MaxRAMPercentage=75.0", \
     "-XX:+UseG1GC", \
     "-XX:+UseStringDeduplication", \
     "-XX:+OptimizeStringConcat", \
     "-Djava.security.egd=file:/dev/./urandom", \
     "-Dspring.profiles.active=${SPRING_PROFILES_ACTIVE:-production}", \
     "-jar", "app.jar"]

# Labels for metadata
LABEL maintainer="Suuupra Platform Team" \
      version="1.0.0" \
      description="Identity Service" \
      org.opencontainers.image.source="https://github.com/suuupra/platform" \
      org.opencontainers.image.vendor="Suuupra" \
      org.opencontainers.image.title="Identity Service" \
      org.opencontainers.image.description="Production-grade identity and authentication service" \
      org.opencontainers.image.version="1.0.0"
