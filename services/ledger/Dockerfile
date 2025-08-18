# Multi-stage Dockerfile for Suuupra Ledger Service
FROM eclipse-temurin:21-jdk-alpine AS builder

# Install Maven
RUN apk add --no-cache maven curl

WORKDIR /app

# Copy Maven files for dependency caching
COPY pom.xml ./
RUN mvn dependency:go-offline -B

# Copy source and build
COPY src ./src
RUN mvn clean package -DskipTests -B

# Production stage
FROM eclipse-temurin:21-jre-alpine AS production

# Install security updates and tools
RUN apk add --no-cache curl && \
    addgroup -g 1001 -S ledger && \
    adduser -u 1001 -S ledger -G ledger

WORKDIR /app

# Copy JAR from builder stage
COPY --from=builder --chown=ledger:ledger /app/target/*.jar app.jar

# Create logs directory
RUN mkdir -p /app/logs && \
    chown -R ledger:ledger /app

USER ledger

EXPOSE 8086

HEALTHCHECK --interval=30s --timeout=10s --start-period=40s --retries=3 \
    CMD curl -f http://localhost:8086/health || exit 1

CMD ["java", "-jar", "app.jar"]
