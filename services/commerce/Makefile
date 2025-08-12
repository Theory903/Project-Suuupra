# Commerce Service Makefile
# Provides common development and operational commands

.PHONY: help dev build test clean docker-build docker-run install lint format

# Default target
help: ## Show this help message
	@echo "Commerce Service - Available Commands:"
	@echo ""
	@grep -E '^[a-zA-Z_-]+:.*?## .*$$' $(MAKEFILE_LIST) | sort | awk 'BEGIN {FS = ":.*?## "}; {printf "  %-20s %s\n", $$1, $$2}'

# Development Commands
install: ## Install dependencies
	pip install -r requirements.txt
	pip install -e .

dev: ## Start development environment
	docker-compose up --build

dev-down: ## Stop development environment
	docker-compose down -v

dev-logs: ## View development logs
	docker-compose logs -f commerce-service

dev-shell: ## Open shell in development container
	docker-compose exec commerce-service bash

# Code Quality
lint: ## Run linting
	flake8 src tests
	mypy src

format: ## Format code
	black src tests
	isort src tests

# Testing
test: ## Run unit tests
	pytest tests/unit -v --cov=src --cov-report=html --cov-report=term-missing

test-integration: ## Run integration tests
	pytest tests/integration -v

test-all: ## Run all tests
	pytest tests -v --cov=src --cov-report=html --cov-report=term-missing

test-load: ## Run load tests
	locust -f tests/load/locustfile.py --host=http://localhost:8084

# Database
migrate: ## Run database migrations
	alembic upgrade head

migrate-create: ## Create new migration
	@read -p "Enter migration name: " name; \
	alembic revision --autogenerate -m "$$name"

db-reset: ## Reset database (development only)
	docker-compose exec postgres psql -U commerce -d commerce_dev -c "DROP SCHEMA public CASCADE; CREATE SCHEMA public;"
	$(MAKE) migrate

# Docker
docker-build: ## Build Docker image
	docker build -t commerce-service:latest .

docker-run: ## Run Docker container
	docker run -p 8084:8084 --env-file .env commerce-service:latest

docker-push: ## Push Docker image to registry
	@echo "Configure your registry and push command"

# Production
prod: ## Start production environment
	docker-compose -f docker-compose.prod.yml up -d

prod-logs: ## View production logs
	docker-compose -f docker-compose.prod.yml logs -f

prod-down: ## Stop production environment
	docker-compose -f docker-compose.prod.yml down

# Monitoring
logs: ## View service logs
	docker-compose logs -f commerce-service

metrics: ## Open Prometheus metrics
	@echo "Opening Prometheus at http://localhost:9091"
	@python -m webbrowser http://localhost:9091

grafana: ## Open Grafana dashboard
	@echo "Opening Grafana at http://localhost:3001 (admin/admin)"
	@python -m webbrowser http://localhost:3001

jaeger: ## Open Jaeger tracing
	@echo "Opening Jaeger at http://localhost:16686"
	@python -m webbrowser http://localhost:16686

# Health Checks
health: ## Check service health
	curl -f http://localhost:8084/health || echo "Service is not healthy"

ready: ## Check service readiness
	curl -f http://localhost:8084/ready || echo "Service is not ready"

# Cleanup
clean: ## Clean up temporary files and containers
	docker-compose down -v --remove-orphans
	docker system prune -f
	find . -type d -name "__pycache__" -exec rm -rf {} + 2>/dev/null || true
	find . -type f -name "*.pyc" -delete 2>/dev/null || true
	rm -rf .pytest_cache htmlcov .coverage .mypy_cache

# Quick Start
quick-start: ## Quick start for new developers
	@echo "Setting up Commerce Service development environment..."
	cp .env.example .env
	$(MAKE) dev
	@echo ""
	@echo "Development environment started!"
	@echo "- API: http://localhost:8084"
	@echo "- Docs: http://localhost:8084/docs"
	@echo "- Grafana: http://localhost:3001 (admin/admin)"
	@echo "- Jaeger: http://localhost:16686"
	@echo ""
	@echo "Run 'make help' for more commands"
