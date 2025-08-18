# UPI PSP Service Makefile

.PHONY: help build run test clean deps docker-build docker-run docker-stop dev setup lint format

# Variables
APP_NAME = upi-psp-service
VERSION = 1.0.0
BUILD_DIR = build
BINARY_NAME = upi-psp
DOCKER_IMAGE = suuupra/$(APP_NAME)
DOCKER_TAG = $(VERSION)

# Go parameters
GOCMD = go
GOBUILD = $(GOCMD) build
GORUN = $(GOCMD) run
GOTEST = $(GOCMD) test
GOGET = $(GOCMD) get
GOMOD = $(GOCMD) mod
GOFMT = $(GOCMD) fmt
GOVET = $(GOCMD) vet

# Build flags
LDFLAGS = -ldflags "-X main.version=$(VERSION) -X main.buildTime=$(shell date -u '+%Y-%m-%d_%H:%M:%S')"

# Default target
help: ## Show this help message
	@echo "Available commands:"
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "\033[36m%-20s\033[0m %s\n", $$1, $$2}'

# Development
setup: ## Setup development environment
	@echo "🔧 Setting up development environment..."
	$(GOMOD) tidy
	$(GOMOD) download
	@echo "✅ Setup complete"

dev: ## Run in development mode with hot reload
	@echo "🚀 Starting development server..."
	@chmod +x scripts/run-dev.sh
	@./scripts/run-dev.sh

run: ## Run the application
	@echo "🏃 Running $(APP_NAME)..."
	$(GORUN) cmd/main.go

# Build
build: ## Build the application
	@echo "🔨 Building $(APP_NAME)..."
	@mkdir -p $(BUILD_DIR)
	$(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME) cmd/main.go
	@echo "✅ Build complete: $(BUILD_DIR)/$(BINARY_NAME)"

build-linux: ## Build for Linux
	@echo "🔨 Building $(APP_NAME) for Linux..."
	@mkdir -p $(BUILD_DIR)
	GOOS=linux GOARCH=amd64 $(GOBUILD) $(LDFLAGS) -o $(BUILD_DIR)/$(BINARY_NAME)-linux cmd/main.go
	@echo "✅ Linux build complete: $(BUILD_DIR)/$(BINARY_NAME)-linux"

# Dependencies
deps: ## Download dependencies
	@echo "📦 Downloading dependencies..."
	$(GOMOD) tidy
	$(GOMOD) download

# Testing
test: ## Run tests
	@echo "🧪 Running tests..."
	$(GOTEST) -v ./...

test-coverage: ## Run tests with coverage
	@echo "🧪 Running tests with coverage..."
	$(GOTEST) -v -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html
	@echo "📊 Coverage report generated: coverage.html"

test-race: ## Run tests with race detection
	@echo "🧪 Running tests with race detection..."
	$(GOTEST) -v -race ./...

benchmark: ## Run benchmarks
	@echo "⚡ Running benchmarks..."
	$(GOTEST) -bench=. -benchmem ./...

# Code quality
lint: ## Run linter
	@echo "🔍 Running linter..."
	@if command -v golangci-lint >/dev/null 2>&1; then \
		golangci-lint run; \
	else \
		echo "golangci-lint not installed. Install with: go install github.com/golangci/golangci-lint/cmd/golangci-lint@latest"; \
		$(GOVET) ./...; \
	fi

format: ## Format code
	@echo "🎨 Formatting code..."
	$(GOFMT) ./...
	@if command -v goimports >/dev/null 2>&1; then \
		goimports -w .; \
	else \
		echo "goimports not installed. Install with: go install golang.org/x/tools/cmd/goimports@latest"; \
	fi

# Docker
docker-build: ## Build Docker image
	@echo "🐳 Building Docker image..."
	docker build -t $(DOCKER_IMAGE):$(DOCKER_TAG) -t $(DOCKER_IMAGE):latest .
	@echo "✅ Docker image built: $(DOCKER_IMAGE):$(DOCKER_TAG)"

docker-run: ## Run Docker container
	@echo "🐳 Running Docker container..."
	docker-compose up -d

docker-stop: ## Stop Docker container
	@echo "🛑 Stopping Docker container..."
	docker-compose down

docker-logs: ## View Docker logs
	@echo "📋 Viewing Docker logs..."
	docker-compose logs -f upi-psp-service

# Database
db-migrate: ## Run database migrations
	@echo "🗄️  Running database migrations..."
	$(GORUN) cmd/main.go -migrate

db-seed: ## Seed database with test data
	@echo "🌱 Seeding database..."
	@# This would run a seed script
	@echo "Database seeding not implemented yet"

db-reset: ## Reset database
	@echo "🔄 Resetting database..."
	docker-compose down -v
	docker-compose up -d postgres redis
	@sleep 5
	@echo "Database reset complete"

# Monitoring
metrics: ## View metrics
	@echo "📊 Opening metrics dashboard..."
	@open http://localhost:9092 || echo "Metrics available at http://localhost:9092"

health: ## Check service health
	@echo "🏥 Checking service health..."
	@curl -s http://localhost:8097/health | jq . || echo "Service not running or jq not installed"

# Cleanup
clean: ## Clean build artifacts
	@echo "🧹 Cleaning up..."
	@rm -rf $(BUILD_DIR)
	@rm -f coverage.out coverage.html
	@$(GOCMD) clean
	@echo "✅ Cleanup complete"

clean-docker: ## Clean Docker images and containers
	@echo "🧹 Cleaning Docker resources..."
	docker-compose down -v --remove-orphans
	docker system prune -f
	@echo "✅ Docker cleanup complete"

# Production
deploy: ## Deploy to production
	@echo "🚀 Deploying to production..."
	@# This would contain deployment scripts
	@echo "Production deployment not implemented yet"

# Install development tools
install-tools: ## Install development tools
	@echo "🔧 Installing development tools..."
	$(GOGET) -u github.com/cosmtrek/air@latest
	$(GOGET) -u github.com/golangci/golangci-lint/cmd/golangci-lint@latest
	$(GOGET) -u golang.org/x/tools/cmd/goimports@latest
	@echo "✅ Development tools installed"

# Generate
generate: ## Generate code (mocks, etc.)
	@echo "🏭 Generating code..."
	$(GOCMD) generate ./...
	@echo "✅ Code generation complete"

# Security
security-scan: ## Run security scan
	@echo "🔒 Running security scan..."
	@if command -v gosec >/dev/null 2>&1; then \
		gosec ./...; \
	else \
		echo "gosec not installed. Install with: go install github.com/securecodewarrior/gosec/v2/cmd/gosec@latest"; \
	fi

# All-in-one commands
all: clean deps format lint test build ## Run all checks and build

ci: deps format lint test-race test-coverage ## Run CI pipeline

# Environment setup
env-dev: ## Setup development environment variables
	@echo "🔧 Setting up development environment..."
	@cp .env.example .env || echo ".env.example not found"
	@echo "✅ Development environment setup complete"
