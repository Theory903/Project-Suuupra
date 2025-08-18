#!/bin/bash
set -euo pipefail

# 🚀 Suuupra Platform - Foundation Validation Script
# Validates Phase 0 foundation setup according to TODO specifications

echo "🔍 Validating Suuupra Platform Foundation Setup..."

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() {
    echo -e "${GREEN}✅ $1${NC}"
}

print_warning() {
    echo -e "${YELLOW}⚠️  $1${NC}"
}

print_error() {
    echo -e "${RED}❌ $1${NC}"
}

print_info() {
    echo -e "${BLUE}ℹ️  $1${NC}"
}

VALIDATION_ERRORS=0

# Function to increment error count
validation_failed() {
    VALIDATION_ERRORS=$((VALIDATION_ERRORS + 1))
    print_error "$1"
}

validation_passed() {
    print_status "$1"
}

# Step 1: Validate Development Environment
echo "🔧 Validating Development Environment..."

# Check Node.js version
if command -v node &> /dev/null; then
    node_version=$(node --version)
    if [[ "$node_version" == "v20.11.0" ]]; then
        validation_passed "Node.js version correct: $node_version"
    else
        validation_failed "Node.js version mismatch. Expected v20.11.0, got $node_version"
    fi
else
    validation_failed "Node.js not found"
fi

# Check Go version
if command -v go &> /dev/null; then
    go_version=$(go version | awk '{print $3}')
    if [[ "$go_version" == "go1.22.0" ]]; then
        validation_passed "Go version correct: $go_version"
    else
        validation_failed "Go version mismatch. Expected go1.22.0, got $go_version"
    fi
else
    validation_failed "Go not found"
fi

# Check Python version
if command -v python &> /dev/null; then
    python_version=$(python --version 2>&1 | awk '{print $2}')
    if [[ "$python_version" == "3.11.8" ]]; then
        validation_passed "Python version correct: $python_version"
    else
        validation_failed "Python version mismatch. Expected 3.11.8, got $python_version"
    fi
else
    validation_failed "Python not found"
fi

# Check Rust
if command -v rustc &> /dev/null; then
    rust_version=$(rustc --version | awk '{print $2}')
    validation_passed "Rust installed: $rust_version"
else
    validation_failed "Rust not found"
fi

# Check pnpm
if command -v pnpm &> /dev/null; then
    pnpm_version=$(pnpm --version)
    if [[ "$pnpm_version" == "8.15.1" ]]; then
        validation_passed "pnpm version correct: $pnpm_version"
    else
        validation_failed "pnpm version mismatch. Expected 8.15.1, got $pnpm_version"
    fi
else
    validation_failed "pnpm not found"
fi

# Check essential tools
tools=("kubectl" "helm" "docker" "jq" "httpie")
for tool in "${tools[@]}"; do
    if command -v "$tool" &> /dev/null; then
        validation_passed "$tool is installed"
    else
        validation_failed "$tool not found"
    fi
done

# Step 2: Validate Kubernetes Setup
echo "⚓ Validating Kubernetes Setup..."

if command -v kubectl &> /dev/null; then
    # Check if cluster is accessible
    if kubectl cluster-info &> /dev/null; then
        validation_passed "Kubernetes cluster is accessible"
        
        # Check Kubernetes version
        k8s_version=$(kubectl version --client --short 2>/dev/null | grep Client | awk '{print $3}' || kubectl version --client -o json 2>/dev/null | jq -r '.clientVersion.gitVersion')
        validation_passed "Kubernetes client version: $k8s_version"
        
        # Check namespaces
        namespaces=("suuupra-dev" "suuupra-staging" "suuupra-prod")
        for ns in "${namespaces[@]}"; do
            if kubectl get namespace "$ns" &> /dev/null; then
                validation_passed "Namespace $ns exists"
            else
                validation_failed "Namespace $ns not found"
            fi
        done
        
        # Check Linkerd
        if command -v linkerd &> /dev/null; then
            if linkerd check &> /dev/null; then
                validation_passed "Linkerd service mesh is healthy"
            else
                validation_failed "Linkerd service mesh issues detected"
                print_info "Run: linkerd check"
            fi
        else
            validation_failed "Linkerd CLI not found"
        fi
        
        # Check critical addons
        addons=("ingress" "metrics-server" "dashboard")
        for addon in "${addons[@]}"; do
            if minikube addons list 2>/dev/null | grep -q "$addon.*enabled"; then
                validation_passed "Minikube addon $addon is enabled"
            else
                validation_warning "Minikube addon $addon not enabled"
            fi
        done
        
    else
        validation_failed "Cannot connect to Kubernetes cluster"
        print_info "Start minikube: minikube start"
    fi
else
    validation_failed "kubectl not found"
fi

# Step 3: Validate Kafka KRaft Setup
echo "🔥 Validating Kafka KRaft Setup..."

# Check if Kafka is running (Docker)
if docker ps --format "table {{.Names}}" | grep -q "kafka"; then
    kafka_container=$(docker ps --format "table {{.Names}}" | grep kafka | head -1 | awk '{print $1}')
    validation_passed "Kafka container running: $kafka_container"
    
    # Check KRaft mode
    if docker exec "$kafka_container" ls /var/lib/kafka/data/meta.properties &> /dev/null; then
        validation_passed "Kafka running in KRaft mode (no ZooKeeper)"
    else
        validation_failed "Kafka not running in KRaft mode"
    fi
    
    # Test Kafka connectivity
    if docker exec "$kafka_container" kafka-broker-api-versions.sh --bootstrap-server localhost:9092 &> /dev/null; then
        validation_passed "Kafka broker is responding"
        
        # Check topics
        topics=$(docker exec "$kafka_container" kafka-topics.sh --bootstrap-server localhost:9092 --list 2>/dev/null)
        topic_count=$(echo "$topics" | wc -l)
        if [[ $topic_count -gt 3 ]]; then
            validation_passed "Kafka topics created ($topic_count topics)"
        else
            validation_failed "Insufficient Kafka topics ($topic_count topics)"
        fi
    else
        validation_failed "Cannot connect to Kafka broker"
    fi
else
    # Check Kubernetes Kafka
    if kubectl get pods -n kafka 2>/dev/null | grep -q kafka; then
        validation_passed "Kafka running in Kubernetes"
        
        if kubectl exec -n kafka kafka-0 -- kafka-broker-api-versions.sh --bootstrap-server localhost:9092 &> /dev/null; then
            validation_passed "Kubernetes Kafka broker responding"
        else
            validation_failed "Kubernetes Kafka broker not responding"
        fi
    else
        validation_failed "Kafka not running (neither Docker nor Kubernetes)"
    fi
fi

# Step 4: Validate Monitoring Stack
echo "📊 Validating Monitoring Stack..."

# Check Prometheus
if kubectl get pods -n monitoring 2>/dev/null | grep -q prometheus; then
    validation_passed "Prometheus running in Kubernetes"
elif docker ps --format "table {{.Names}}" | grep -q prometheus; then
    validation_passed "Prometheus running in Docker"
else
    validation_failed "Prometheus not found"
fi

# Check Grafana
if kubectl get pods -n monitoring 2>/dev/null | grep -q grafana; then
    validation_passed "Grafana running in Kubernetes"
elif docker ps --format "table {{.Names}}" | grep -q grafana; then
    validation_passed "Grafana running in Docker"
else
    validation_failed "Grafana not found"
fi

# Step 5: Validate Project Structure
echo "📁 Validating Project Structure..."

required_files=(
    ".nvmrc"
    ".python-version"
    ".go-version"
    "scripts/setup-dev-environment.sh"
    "scripts/setup-local-kubernetes.sh"
    "scripts/setup-kafka-kraft.sh"
    "scripts/migrate-to-kraft.sh"
)

for file in "${required_files[@]}"; do
    if [[ -f "$file" ]]; then
        validation_passed "Required file exists: $file"
    else
        validation_failed "Required file missing: $file"
    fi
done

# Check script permissions
for script in scripts/*.sh; do
    if [[ -x "$script" ]]; then
        validation_passed "Script is executable: $script"
    else
        validation_failed "Script not executable: $script"
    fi
done

# Step 6: Performance and Resource Checks
echo "⚡ Validating Performance and Resources..."

# Check available memory
available_memory=$(free -g 2>/dev/null | awk '/^Mem:/{print $2}' || system_profiler SPHardwareDataType 2>/dev/null | awk '/Memory:/{print $2}' | sed 's/GB//' || echo "unknown")
if [[ "$available_memory" != "unknown" ]] && [[ $available_memory -ge 16 ]]; then
    validation_passed "Sufficient memory available: ${available_memory}GB"
elif [[ "$available_memory" != "unknown" ]] && [[ $available_memory -ge 8 ]]; then
    validation_passed "Memory available: ${available_memory}GB (minimum for development)"
else
    validation_failed "Insufficient memory: ${available_memory}GB (16GB recommended)"
fi

# Check Docker resources
if docker info &> /dev/null; then
    docker_memory=$(docker info 2>/dev/null | grep "Total Memory" | awk '{print $3$4}' || echo "unknown")
    if [[ "$docker_memory" != "unknown" ]]; then
        validation_passed "Docker memory allocation: $docker_memory"
    fi
else
    validation_failed "Docker not accessible"
fi

# Step 7: Network Connectivity Tests
echo "🌐 Validating Network Connectivity..."

# Test essential endpoints
endpoints=(
    "https://registry.npmjs.org"
    "https://pypi.org"
    "https://proxy.golang.org"
    "https://crates.io"
    "https://hub.docker.com"
)

for endpoint in "${endpoints[@]}"; do
    if curl -s --max-time 5 "$endpoint" > /dev/null 2>&1; then
        validation_passed "Network connectivity to $endpoint"
    else
        validation_failed "Cannot reach $endpoint"
    fi
done

# Final Summary
echo ""
echo "🎯 FOUNDATION VALIDATION SUMMARY"
echo "================================"

if [[ $VALIDATION_ERRORS -eq 0 ]]; then
    echo -e "${GREEN}🎉 ALL VALIDATIONS PASSED!${NC}"
    echo ""
    echo "✅ Phase 0: Foundation Setup is COMPLETE"
    echo ""
    echo "🚀 Ready for Phase 1: Security Foundation"
    echo "   Run: ./scripts/setup-security-foundation.sh"
    echo ""
    echo "📊 Quick Status Check:"
    echo "   • Minikube: $(minikube status --format='{{.Host}}' 2>/dev/null || echo 'Not running')"
    echo "   • Docker: $(docker info --format='{{.ServerVersion}}' 2>/dev/null || echo 'Not accessible')"
    echo "   • Kafka: $(docker ps --format '{{.Names}}' | grep kafka | head -1 || echo 'Not running')"
    echo ""
else
    echo -e "${RED}❌ VALIDATION FAILED${NC}"
    echo ""
    echo "Found $VALIDATION_ERRORS error(s) that need to be resolved:"
    echo ""
    echo "🔧 Common fixes:"
    echo "   1. Run: ./scripts/setup-dev-environment.sh"
    echo "   2. Run: ./scripts/setup-local-kubernetes.sh"
    echo "   3. Run: ./scripts/setup-kafka-kraft.sh"
    echo "   4. Check Docker Desktop is running"
    echo "   5. Check minikube status: minikube status"
    echo ""
    exit 1
fi

# Additional insights
echo "💡 Performance Insights:"
if command -v minikube &> /dev/null && minikube status &> /dev/null; then
    minikube_ip=$(minikube ip 2>/dev/null || echo "unknown")
    echo "   • Minikube IP: $minikube_ip"
fi

if command -v kubectl &> /dev/null && kubectl cluster-info &> /dev/null; then
    pod_count=$(kubectl get pods --all-namespaces --no-headers 2>/dev/null | wc -l)
    echo "   • Total pods running: $pod_count"
fi

echo ""
echo "📚 Documentation:"
echo "   • Linkerd Dashboard: linkerd viz dashboard"
echo "   • Kubernetes Dashboard: minikube dashboard"
echo "   • Kafka UI: http://localhost:8080"
echo ""
