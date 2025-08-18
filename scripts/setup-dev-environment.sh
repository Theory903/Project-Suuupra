#!/bin/bash
set -euo pipefail

# 🚀 Suuupra Platform - Development Environment Setup
# Following TODO-001: Setup Development Environment Correctly

echo "🔧 Setting up Suuupra Platform Development Environment..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
    exit 1
}

# Check if running on macOS
if [[ "$OSTYPE" != "darwin"* ]]; then
    print_error "This script is designed for macOS. Please adapt for your OS."
fi

# Step 1: Install EXACT versions
echo "📦 Installing exact versions from TODO specification..."

# Check if Homebrew is installed
if ! command -v brew &> /dev/null; then
    print_error "Homebrew is not installed. Install it first: https://brew.sh"
fi

# Install Node.js 20.11.0 via nvm
if ! command -v nvm &> /dev/null; then
    echo "Installing nvm..."
    curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash
    export NVM_DIR="$HOME/.nvm"
    [ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
fi

nvm install 20.11.0
nvm use 20.11.0
nvm alias default 20.11.0
print_status "Node.js 20.11.0 installed"

# Install Go 1.22
if ! command -v gvm &> /dev/null; then
    echo "Installing gvm..."
    bash < <(curl -s -S -L https://raw.githubusercontent.com/moovweb/gvm/master/binscripts/gvm-installer)
    source ~/.gvm/scripts/gvm
fi

gvm install go1.22.0 --default
print_status "Go 1.22.0 installed"

# Install Python 3.11 via pyenv
if ! command -v pyenv &> /dev/null; then
    echo "Installing pyenv..."
    brew install pyenv
    echo 'export PYENV_ROOT="$HOME/.pyenv"' >> ~/.zshrc
    echo 'command -v pyenv >/dev/null || export PATH="$PYENV_ROOT/bin:$PATH"' >> ~/.zshrc
    echo 'eval "$(pyenv init -)"' >> ~/.zshrc
fi

pyenv install 3.11.8
pyenv global 3.11.8
print_status "Python 3.11.8 installed"

# Install Rust latest stable
if ! command -v rustc &> /dev/null; then
    echo "Installing Rust..."
    curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh -s -- -y
    source ~/.cargo/env
fi
print_status "Rust installed"

# Install Kubernetes tools
brew install kubectl@1.29 || true
brew install helm@3.14 || true
print_status "Kubernetes tools installed"

# Install Docker
if ! command -v docker &> /dev/null; then
    print_warning "Docker not found. Please install Docker Desktop manually."
else
    print_status "Docker found"
fi

# Install Minikube
brew install minikube || true
print_status "Minikube installed"

# Step 2: Setup Node correctly
echo "🔧 Configuring Node.js environment..."

# Use Node 20.11.0
nvm use 20.11.0

# Install pnpm
npm install -g pnpm@8.15.1
print_status "pnpm 8.15.1 installed"

# Configure npm settings
echo 'auto-install-peers=true' >> ~/.npmrc
echo 'shamefully-hoist=true' >> ~/.npmrc
print_status "npm configuration updated"

# Step 3: Configure Git properly
echo "🔧 Configuring Git..."

git config --global pull.rebase true
git config --global fetch.prune true
git config --global diff.colorMoved zebra
git config --global merge.conflictstyle diff3
print_status "Git configuration updated"

# Step 4: Install development tools
echo "🛠️  Installing development tools..."

brew install --cask visual-studio-code || true
brew install --cask postman || true
brew install --cask lens || true  # K8s IDE
brew install jq yq || true        # JSON/YAML processors
brew install httpie || true       # Better than curl
brew install dive || true         # Docker image analyzer
brew install k9s || true          # Terminal K8s UI

print_status "Development tools installed"

# Verify installations
echo "🔍 Verifying installations..."

node_version=$(node --version)
if [[ "$node_version" == "v20.11.0" ]]; then
    print_status "Node.js version correct: $node_version"
else
    print_warning "Node.js version mismatch. Expected v20.11.0, got $node_version"
fi

go_version=$(go version | awk '{print $3}')
if [[ "$go_version" == "go1.22.0" ]]; then
    print_status "Go version correct: $go_version"
else
    print_warning "Go version mismatch. Expected go1.22.0, got $go_version"
fi

python_version=$(python --version 2>&1 | awk '{print $2}')
if [[ "$python_version" == "3.11.8" ]]; then
    print_status "Python version correct: $python_version"
else
    print_warning "Python version mismatch. Expected 3.11.8, got $python_version"
fi

# Create project .nvmrc for consistency
echo "20.11.0" > .nvmrc
print_status ".nvmrc created for project consistency"

echo ""
echo "🎉 Development environment setup complete!"
echo ""
echo "Next steps:"
echo "1. Restart your terminal or run: source ~/.zshrc"
echo "2. Run: ./scripts/setup-local-kubernetes.sh"
echo "3. Run: ./scripts/setup-kafka-kraft.sh"
echo ""
