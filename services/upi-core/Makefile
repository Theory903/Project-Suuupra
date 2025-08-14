# Variables
SERVICE_NAME := upi-core
PROTO_DIR := proto
PB_DIR := pkg/pb
DOCKER_IMAGE := $(SERVICE_NAME):latest

# Go related variables
GOCMD := go
GOBUILD := $(GOCMD) build
GOCLEAN := $(GOCMD) clean
GOTEST := $(GOCMD) test
GOGET := $(GOCMD) get
GOMOD := $(GOCMD) mod
BINARY_NAME := $(SERVICE_NAME)
MAIN_PATH := cmd/server/main.go

# Build the application
.PHONY: build
build: proto-gen
	$(GOBUILD) -o bin/$(BINARY_NAME) $(MAIN_PATH)

# Build for production
.PHONY: build-prod
build-prod: proto-gen
	CGO_ENABLED=0 GOOS=linux $(GOBUILD) -a -installsuffix cgo -ldflags '-extldflags "-static"' -o bin/$(BINARY_NAME) $(MAIN_PATH)

# Run the application
.PHONY: run
run: build
	./bin/$(BINARY_NAME)

# Run in development mode with hot reload
.PHONY: run-dev
run-dev: proto-gen
	$(GOCMD) run $(MAIN_PATH)

# Clean build artifacts
.PHONY: clean
clean:
	$(GOCLEAN)
	rm -rf bin/
	rm -rf $(PB_DIR)/*.pb.go

# Run tests
.PHONY: test
test:
	$(GOTEST) -v ./...

# Run tests with coverage
.PHONY: test-coverage
test-coverage:
	$(GOTEST) -v -coverprofile=coverage.out ./...
	$(GOCMD) tool cover -html=coverage.out -o coverage.html

# Run integration tests
.PHONY: test-integration
test-integration:
	$(GOTEST) -v -tags=integration ./...

# Run benchmarks
.PHONY: bench
bench:
	$(GOTEST) -bench=. -benchmem ./...

# Download dependencies
.PHONY: deps
deps:
	$(GOMOD) download
	$(GOMOD) tidy

# Generate protobuf code
.PHONY: proto-gen
proto-gen:
	@mkdir -p $(PB_DIR)
	protoc --go_out=$(PB_DIR) --go_opt=paths=source_relative \
		--go-grpc_out=$(PB_DIR) --go-grpc_opt=paths=source_relative \
		$(PROTO_DIR)/*.proto

# Install protoc dependencies
.PHONY: proto-install
proto-install:
	$(GOGET) google.golang.org/protobuf/cmd/protoc-gen-go
	$(GOGET) google.golang.org/grpc/cmd/protoc-gen-go-grpc

# Lint the code
.PHONY: lint
lint:
	golangci-lint run

# Format the code
.PHONY: fmt
fmt:
	$(GOCMD) fmt ./...

# Vet the code
.PHONY: vet
vet:
	$(GOCMD) vet ./...

# Security scan
.PHONY: sec
sec:
	gosec ./...

# Build Docker image
.PHONY: docker-build
docker-build:
	docker build -t $(DOCKER_IMAGE) .

# Run with Docker Compose
.PHONY: docker-up
docker-up:
	docker-compose up --build

# Stop Docker Compose
.PHONY: docker-down
docker-down:
	docker-compose down

# Database migrations (placeholder)
.PHONY: db-migrate
db-migrate:
	@echo "Running database migrations..."
	# Add migration commands here

# Database seed (placeholder)
.PHONY: db-seed
db-seed:
	@echo "Seeding database..."
	# Add seed commands here

# Generate TLS certificates for development
.PHONY: gen-certs
gen-certs:
	@mkdir -p certs
	openssl req -new -newkey rsa:4096 -days 365 -nodes -x509 \
		-subj "/C=IN/ST=MH/L=Mumbai/O=UPI-Core/CN=localhost" \
		-keyout certs/server.key -out certs/server.crt

# Generate RSA keys for signing
.PHONY: gen-keys
gen-keys:
	@mkdir -p keys
	openssl genrsa -out keys/private.pem 2048
	openssl rsa -in keys/private.pem -pubout -out keys/public.pem

# Setup development environment
.PHONY: setup-dev
setup-dev: deps proto-install proto-gen gen-certs gen-keys
	@echo "Development environment setup complete!"

# Help
.PHONY: help
help:
	@echo "Available commands:"
	@echo "  build         - Build the application"
	@echo "  build-prod    - Build for production"
	@echo "  run           - Run the application"
	@echo "  run-dev       - Run in development mode"
	@echo "  clean         - Clean build artifacts"
	@echo "  test          - Run tests"
	@echo "  test-coverage - Run tests with coverage"
	@echo "  deps          - Download dependencies"
	@echo "  proto-gen     - Generate protobuf code"
	@echo "  proto-install - Install protobuf tools"
	@echo "  lint          - Lint the code"
	@echo "  fmt           - Format the code"
	@echo "  vet           - Vet the code"
	@echo "  docker-build  - Build Docker image"
	@echo "  docker-up     - Run with Docker Compose"
	@echo "  docker-down   - Stop Docker Compose"
	@echo "  setup-dev     - Setup development environment"
	@echo "  help          - Show this help message"
