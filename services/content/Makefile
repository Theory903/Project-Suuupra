# Content Service Makefile

# Variables
SERVICE_NAME := content-service
DOCKER_REGISTRY := suuupra
VERSION := $(shell node -p "require('./package.json').version")
IMAGE_NAME := $(DOCKER_REGISTRY)/$(SERVICE_NAME)
DOCKER_COMPOSE_DEV := docker-compose -f docker-compose.dev.yml
DOCKER_COMPOSE_PROD := docker-compose -f docker-compose.yml

# Colors for output
RED := \033[0;31m
GREEN := \033[0;32m
YELLOW := \033[0;33m
BLUE := \033[0;34m
NC := \033[0m # No Color

.PHONY: help install build test lint clean dev prod up down logs shell migrate seed

# Default target
.DEFAULT_GOAL := help

help: ## Show this help message
	@echo "$(BLUE)Content Service - Available Commands$(NC)"
	@echo ""
	@awk 'BEGIN {FS = ":.*?## "} /^[a-zA-Z_-]+:.*?## / {printf "$(GREEN)%-15s$(NC) %s\n", $$1, $$2}' $(MAKEFILE_LIST)

# Development Commands
install: ## Install dependencies
	@echo "$(YELLOW)Installing dependencies...$(NC)"
	npm ci

build: ## Build the application
	@echo "$(YELLOW)Building application...$(NC)"
	npm run build

test: ## Run tests
	@echo "$(YELLOW)Running tests...$(NC)"
	npm test

test-coverage: ## Run tests with coverage
	@echo "$(YELLOW)Running tests with coverage...$(NC)"
	npm run test:coverage

test-watch: ## Run tests in watch mode
	@echo "$(YELLOW)Running tests in watch mode...$(NC)"
	npm run test:watch

test-integration: ## Run integration tests
	@echo "$(YELLOW)Running integration tests...$(NC)"
	npm run test:integration

test-load: ## Run load tests
	@echo "$(YELLOW)Running load tests...$(NC)"
	npm run test:load

lint: ## Run linter
	@echo "$(YELLOW)Running linter...$(NC)"
	npm run lint

lint-fix: ## Fix linting issues
	@echo "$(YELLOW)Fixing linting issues...$(NC)"
	npm run lint:fix

clean: ## Clean build artifacts and dependencies
	@echo "$(YELLOW)Cleaning...$(NC)"
	rm -rf dist node_modules coverage .nyc_output logs

# Docker Development Commands
dev: ## Start development environment
	@echo "$(YELLOW)Starting development environment...$(NC)"
	$(DOCKER_COMPOSE_DEV) up -d
	@echo "$(GREEN)Development environment started!$(NC)"
	@echo "$(BLUE)Services:$(NC)"
	@echo "  - Content Service: http://localhost:8082"
	@echo "  - MongoDB Express: http://localhost:8083"
	@echo "  - Redis Commander: http://localhost:8081"
	@echo "  - Elasticsearch Head: http://localhost:9100"
	@echo "  - MinIO Console: http://localhost:9003"

dev-logs: ## Show development logs
	$(DOCKER_COMPOSE_DEV) logs -f content-service-dev

dev-shell: ## Access development container shell
	$(DOCKER_COMPOSE_DEV) exec content-service-dev sh

dev-down: ## Stop development environment
	@echo "$(YELLOW)Stopping development environment...$(NC)"
	$(DOCKER_COMPOSE_DEV) down
	@echo "$(GREEN)Development environment stopped!$(NC)"

dev-clean: ## Clean development environment (remove volumes)
	@echo "$(YELLOW)Cleaning development environment...$(NC)"
	$(DOCKER_COMPOSE_DEV) down -v --remove-orphans
	docker volume prune -f
	@echo "$(GREEN)Development environment cleaned!$(NC)"

# Docker Production Commands
prod: ## Start production environment
	@echo "$(YELLOW)Starting production environment...$(NC)"
	$(DOCKER_COMPOSE_PROD) up -d
	@echo "$(GREEN)Production environment started!$(NC)"
	@echo "$(BLUE)Services:$(NC)"
	@echo "  - Content Service: http://localhost:8082"
	@echo "  - Prometheus: http://localhost:9091"
	@echo "  - Grafana: http://localhost:3001"
	@echo "  - MinIO Console: http://localhost:9001"

prod-logs: ## Show production logs
	$(DOCKER_COMPOSE_PROD) logs -f content-service

prod-shell: ## Access production container shell
	$(DOCKER_COMPOSE_PROD) exec content-service sh

prod-down: ## Stop production environment
	@echo "$(YELLOW)Stopping production environment...$(NC)"
	$(DOCKER_COMPOSE_PROD) down
	@echo "$(GREEN)Production environment stopped!$(NC)"

prod-clean: ## Clean production environment (remove volumes)
	@echo "$(YELLOW)Cleaning production environment...$(NC)"
	$(DOCKER_COMPOSE_PROD) down -v --remove-orphans
	docker volume prune -f
	@echo "$(GREEN)Production environment cleaned!$(NC)"

# Database Commands
migrate: ## Run database migrations
	@echo "$(YELLOW)Running database migrations...$(NC)"
	npm run migrate

seed: ## Seed database with sample data
	@echo "$(YELLOW)Seeding database...$(NC)"
	npm run seed

# Docker Image Commands
docker-build: ## Build Docker image
	@echo "$(YELLOW)Building Docker image...$(NC)"
	docker build -t $(IMAGE_NAME):$(VERSION) -t $(IMAGE_NAME):latest .
	@echo "$(GREEN)Docker image built: $(IMAGE_NAME):$(VERSION)$(NC)"

docker-push: ## Push Docker image to registry
	@echo "$(YELLOW)Pushing Docker image...$(NC)"
	docker push $(IMAGE_NAME):$(VERSION)
	docker push $(IMAGE_NAME):latest
	@echo "$(GREEN)Docker image pushed: $(IMAGE_NAME):$(VERSION)$(NC)"

docker-scan: ## Scan Docker image for vulnerabilities
	@echo "$(YELLOW)Scanning Docker image...$(NC)"
	docker scan $(IMAGE_NAME):$(VERSION)

# Health and Status Commands
health: ## Check service health
	@echo "$(YELLOW)Checking service health...$(NC)"
	@curl -s http://localhost:8082/health | jq '.' || echo "$(RED)Service not responding$(NC)"

status: ## Show service status
	@echo "$(BLUE)Service Status:$(NC)"
	@docker ps --filter "name=$(SERVICE_NAME)" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"

# Utility Commands
logs: ## Show service logs
	@echo "$(YELLOW)Showing logs...$(NC)"
	docker logs -f $(SERVICE_NAME) 2>/dev/null || $(DOCKER_COMPOSE_DEV) logs -f content-service-dev

shell: ## Access service container shell
	@echo "$(YELLOW)Accessing container shell...$(NC)"
	docker exec -it $(SERVICE_NAME) sh 2>/dev/null || $(DOCKER_COMPOSE_DEV) exec content-service-dev sh

restart: ## Restart service
	@echo "$(YELLOW)Restarting service...$(NC)"
	docker restart $(SERVICE_NAME) 2>/dev/null || $(DOCKER_COMPOSE_DEV) restart content-service-dev

# Monitoring Commands
metrics: ## Show service metrics
	@echo "$(YELLOW)Fetching service metrics...$(NC)"
	@curl -s http://localhost:9090/metrics | head -20

prometheus: ## Open Prometheus UI
	@echo "$(BLUE)Opening Prometheus UI...$(NC)"
	@open http://localhost:9091 2>/dev/null || echo "Open http://localhost:9091 in your browser"

grafana: ## Open Grafana UI
	@echo "$(BLUE)Opening Grafana UI...$(NC)"
	@open http://localhost:3001 2>/dev/null || echo "Open http://localhost:3001 in your browser (admin/admin)"

# Backup and Restore Commands
backup: ## Backup service data
	@echo "$(YELLOW)Creating backup...$(NC)"
	@mkdir -p backups
	@docker exec content-mongo mongodump --db content_prod --out /tmp/backup
	@docker cp content-mongo:/tmp/backup ./backups/mongo-$(shell date +%Y%m%d_%H%M%S)
	@echo "$(GREEN)Backup created in ./backups/$(NC)"

restore: ## Restore service data (requires BACKUP_PATH)
	@if [ -z "$(BACKUP_PATH)" ]; then echo "$(RED)Error: BACKUP_PATH required$(NC)"; exit 1; fi
	@echo "$(YELLOW)Restoring from $(BACKUP_PATH)...$(NC)"
	@docker cp $(BACKUP_PATH) content-mongo:/tmp/restore
	@docker exec content-mongo mongorestore --db content_prod /tmp/restore
	@echo "$(GREEN)Restore completed$(NC)"

# Performance Testing
perf-test: ## Run performance tests
	@echo "$(YELLOW)Running performance tests...$(NC)"
	k6 run tests/load/content-load-test.js

# Security Scanning
security-scan: ## Run security scans
	@echo "$(YELLOW)Running security scans...$(NC)"
	npm audit
	docker scan $(IMAGE_NAME):latest

# Documentation
docs: ## Generate API documentation
	@echo "$(YELLOW)Generating API documentation...$(NC)"
	@echo "API documentation available at: http://localhost:8082/api-docs"

# CI/CD Commands
ci-test: ## Run CI tests
	@echo "$(YELLOW)Running CI tests...$(NC)"
	npm ci
	npm run lint
	npm run build
	npm test
	npm run test:integration

ci-build: ## Build for CI
	@echo "$(YELLOW)Building for CI...$(NC)"
	docker build -t $(IMAGE_NAME):ci .

# Quick Start
quick-start: ## Quick start for development
	@echo "$(GREEN)🚀 Quick Start - Content Service$(NC)"
	@echo ""
	@echo "$(YELLOW)1. Installing dependencies...$(NC)"
	@make install
	@echo ""
	@echo "$(YELLOW)2. Starting development environment...$(NC)"
	@make dev
	@echo ""
	@echo "$(GREEN)✅ Content Service is ready!$(NC)"
	@echo ""
	@echo "$(BLUE)Available endpoints:$(NC)"
	@echo "  - Health Check: http://localhost:8082/health"
	@echo "  - API Base: http://localhost:8082/api/v1"
	@echo "  - Metrics: http://localhost:9090/metrics"
	@echo ""
	@echo "$(BLUE)Development Tools:$(NC)"
	@echo "  - MongoDB Express: http://localhost:8083"
	@echo "  - Redis Commander: http://localhost:8081"
	@echo "  - Elasticsearch Head: http://localhost:9100"
	@echo "  - MinIO Console: http://localhost:9003"
	@echo ""
	@echo "$(YELLOW)Next steps:$(NC)"
	@echo "  - Check health: make health"
	@echo "  - View logs: make dev-logs"
	@echo "  - Run tests: make test"
	@echo "  - Stop: make dev-down"
