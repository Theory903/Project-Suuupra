# Suuupra Platform Production Hardening - Phase 4

This directory contains the production hardening framework for the Suuupra Platform, implementing **Chaos Engineering**, **Multi-Region Deployment**, and **Comprehensive Load Testing** to ensure production readiness.

## 🎯 **Overview**

Phase 4 focuses on validating production resilience through:

1. **🔥 Chaos Engineering** - Testing system resilience with controlled failure injection
2. **🌍 Multi-Region Deployment** - Global scale with disaster recovery capabilities  
3. **⚡ Comprehensive Load Testing** - Performance validation across all scenarios

## 📁 **Components**

### 🔥 Chaos Engineering (`litmus-chaos-setup.yaml`)

**Litmus Chaos Engineering** framework for resilience testing:

- **Pod Chaos**: Container kills, network partitions, resource stress
- **Node Chaos**: Node failures, disk fills, network delays
- **Application Chaos**: HTTP faults, database chaos, message queue disruption
- **Security Chaos**: RBAC violations, certificate rotations
- **Automated Resilience**: Chaos workflows with health validation

**Key Features**:
- **Hypothesis-Driven Testing**: Define expected outcomes before chaos
- **Blast Radius Control**: Limit impact scope for safe testing  
- **Continuous Validation**: Automated SLO monitoring during chaos
- **Rollback Mechanisms**: Auto-recovery on SLA violations

### 🌍 Multi-Region Deployment (`multi-region-deployment.yaml`)

**Global deployment architecture** with disaster recovery:

- **Multi-Region K8s**: Primary (us-east-1) + Secondary (eu-west-1, ap-southeast-1)
- **Cross-Region Replication**: Database, Redis, and Kafka replication
- **Global Load Balancing**: DNS-based traffic routing with health checks
- **Disaster Recovery**: Automated failover with <5min RTO/RPO
- **Data Locality**: Regional data residency compliance (GDPR, etc.)

**Key Features**:
- **Active-Active Regions**: Traffic distributed across healthy regions
- **Database Replication**: PostgreSQL streaming replication + WAL shipping
- **Cache Synchronization**: Redis cluster with cross-region replication
- **Event Streaming**: Kafka MirrorMaker 2.0 for cross-region events
- **Certificate Management**: Regional cert-manager with DNS validation

### ⚡ Comprehensive Load Testing

**Advanced K6 performance framework** with intelligent analytics:

#### Core Components:

1. **`comprehensive-load-tests.js`** - Main K6 test suite
   - **Multiple User Journeys**: Authentication, course discovery, payments, live sessions
   - **Business Metrics**: Revenue, enrollments, user activity tracking
   - **WebSocket Testing**: Real-time features (live classes, chat)
   - **SLO Validation**: Automated compliance checking
   - **Custom Metrics**: Circuit breaker trips, cache hit rates, error categorization

2. **`k6-config.json`** - Test scenario configurations  
   - **6 Test Profiles**: Smoke, Baseline, Stress, Spike, Soak, Peak
   - **Environment-Aware**: Dev, staging, production configurations
   - **SLO Thresholds**: Performance, availability, and throughput targets

3. **`load-test-orchestrator.sh`** - Automated test orchestration
   - **Multi-Environment**: Development, staging, production support
   - **Parallel Execution**: Concurrent test runners for faster cycles  
   - **Comprehensive Reporting**: HTML, JSON, SLO compliance reports
   - **Notifications**: Slack/Discord integration for CI/CD pipelines
   - **Regression Detection**: Historical comparison and trend analysis

## 🚀 **Quick Start**

### Prerequisites

```bash
# Install dependencies
brew install k6 jq curl
# Or on Ubuntu:
sudo apt-get update && sudo apt-get install -y jq curl
curl -fsSL https://github.com/grafana/k6/releases/download/v0.47.0/k6-v0.47.0-linux-amd64.tar.gz | tar -xz --strip-components=1 -C /usr/local/bin
```

### 1. Chaos Engineering Setup

```bash
# Deploy Litmus Chaos Engineering
kubectl apply -f production-hardening/litmus-chaos-setup.yaml

# Verify Litmus installation
kubectl get pods -n litmus

# Run sample chaos experiment
kubectl apply -f - <<EOF
apiVersion: litmuschaos.io/v1alpha1
kind: ChaosEngine
metadata:
  name: sample-chaos
  namespace: suuupra-dev
spec:
  appinfo:
    appns: suuupra-dev
    applabel: "app=api-gateway"
    appkind: "deployment"
  chaosServiceAccount: litmus-admin
  experiments:
  - name: pod-delete
    spec:
      components:
        env:
        - name: TOTAL_CHAOS_DURATION
          value: '60'
        - name: CHAOS_INTERVAL
          value: '10'
        - name: FORCE
          value: 'false'
EOF
```

### 2. Multi-Region Deployment

```bash
# Deploy to primary region (us-east-1)
kubectl apply -f production-hardening/multi-region-deployment.yaml

# Deploy to secondary regions (update contexts)
kubectl config use-context eu-west-1
kubectl apply -f production-hardening/multi-region-deployment.yaml

kubectl config use-context ap-southeast-1  
kubectl apply -f production-hardening/multi-region-deployment.yaml

# Verify cross-region connectivity
kubectl get ingress -A
kubectl get certificates -A
```

### 3. Load Testing

```bash
# Smoke test (quick validation)
./production-hardening/load-test-orchestrator.sh \
  --environment development \
  --profile smoke

# Baseline performance test
./production-hardening/load-test-orchestrator.sh \
  --environment staging \
  --profile baseline \
  --notify-slack https://hooks.slack.com/your-webhook

# Stress test to find breaking point
./production-hardening/load-test-orchestrator.sh \
  --environment staging \
  --profile stress \
  --parallel 2

# Production peak load test (Black Friday scenario)
./production-hardening/load-test-orchestrator.sh \
  --environment production \
  --profile peak \
  --notify-slack https://hooks.slack.com/your-webhook \
  --notify-discord https://discord.com/api/webhooks/your-webhook
```

## 🎛️ **Test Profiles**

| Profile | Description | Duration | VUs | Use Case |
|---------|-------------|----------|-----|----------|
| **smoke** | Basic functionality validation | 1m | 5 | CI/CD pipelines, quick verification |
| **baseline** | Normal expected load | 22m | 100-200 | Performance benchmarking |  
| **stress** | Find system breaking point | 45m | 500-1500 | Capacity planning |
| **spike** | Sudden traffic increases | 13m | 100-2000 | Traffic spike preparedness |
| **soak** | Extended stability testing | 60m | 300 | Memory leak detection |
| **peak** | Black Friday scenarios | 90m | 1000-2000 | Peak traffic readiness |

## 📊 **SLO Targets**

### Performance SLOs
- **P95 Latency**: < 500ms (API Gateway < 200ms)
- **P99 Latency**: < 1000ms  
- **Database Latency**: P95 < 100ms
- **Payment Latency**: P95 < 300ms

### Availability SLOs
- **Overall Error Rate**: < 1%
- **Critical Endpoints**: < 0.1%
- **WebSocket Connections**: < 5% failures
- **Payment Processing**: < 0.01% failures

### Throughput SLOs
- **Minimum RPS**: 100 requests/second
- **Success Rate**: > 99%
- **Circuit Breaker Trips**: < 10 per test
- **Rate Limit Hits**: < 5%

## 🔧 **Advanced Configuration**

### Custom Test Scenarios

```javascript
// Add custom scenarios to k6-config.json
{
  "custom_scenario": {
    "executor": "ramping-arrival-rate",
    "startRate": 10,
    "timeUnit": "1s",
    "preAllocatedVUs": 50,
    "maxVUs": 500,
    "stages": [
      { "duration": "5m", "target": 100 },
      { "duration": "10m", "target": 200 },
      { "duration": "5m", "target": 0 }
    ]
  }
}
```

### Environment Variables

```bash
# Authentication tokens
export ADMIN_TOKEN="your-admin-jwt-token"
export USER_TOKEN="your-user-jwt-token"  
export INSTRUCTOR_TOKEN="your-instructor-jwt-token"

# Target configuration
export BASE_URL="https://api.suuupra.io"
export WS_URL="wss://api.suuupra.io"
export REGION="us-east-1"

# Test configuration
export TEST_PROFILE="baseline"
export NODE_ENV="production"
```

### Notification Setup

```bash
# Slack webhook integration
export SLACK_WEBHOOK="https://hooks.slack.com/services/..."

# Discord webhook integration  
export DISCORD_WEBHOOK="https://discord.com/api/webhooks/..."

# Run with notifications
./load-test-orchestrator.sh --profile stress --notify-slack $SLACK_WEBHOOK
```

## 📈 **Performance Monitoring Integration**

### Grafana Dashboards

Load test results automatically integrate with:
- **Golden Signals Dashboard** (from Phase 3)
- **Business Metrics Dashboard** (from Phase 3)  
- **Real-time Performance Dashboard** (K6 + InfluxDB)

### Alerting Integration

Performance tests trigger alerts for:
- **SLO Violations**: Automated PagerDuty/Opsgenie alerts
- **Regression Detection**: >10% performance degradation
- **Capacity Warnings**: Resource utilization >80%
- **Error Spikes**: Error rate increases >5%

## 🎯 **CI/CD Integration**

### GitHub Actions Example

```yaml
name: Load Testing Pipeline
on:
  push:
    branches: [main]
  schedule:
    - cron: '0 2 * * *' # Daily at 2 AM

jobs:
  load-test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run Load Tests
        run: |
          ./production-hardening/load-test-orchestrator.sh \
            --environment staging \
            --profile baseline \
            --notify-slack ${{ secrets.SLACK_WEBHOOK }}
      - name: Archive Results
        uses: actions/upload-artifact@v3
        with:
          name: load-test-results
          path: test-results/performance/
```

### Quality Gates

```bash
# Fail deployment if SLO compliance < 95%
if ! ./load-test-orchestrator.sh --profile smoke --environment staging; then
  echo "❌ Load tests failed - blocking deployment"
  exit 1
fi
```

## 🛡️ **Security Considerations**

- **Token Security**: Test tokens have limited scope and expiration
- **Rate Limiting**: Built-in protection against runaway tests  
- **Resource Isolation**: Tests run in isolated namespaces
- **Audit Logging**: All test execution logged for compliance
- **PII Protection**: Test data uses synthetic/anonymized data only

## 🔍 **Troubleshooting**

### Common Issues

1. **K6 Installation**: Use official installation guides
2. **API Connectivity**: Verify health endpoints before testing  
3. **Resource Limits**: Ensure adequate CPU/memory for high-load tests
4. **Permissions**: Confirm RBAC permissions for chaos experiments
5. **Network Issues**: Check ingress/service configurations

### Debug Commands

```bash
# Check API health
curl -v https://api.suuupra.io/health

# Verify K6 installation
k6 version

# Test basic K6 functionality  
k6 run --http-debug --vus 1 --duration 10s production-hardening/comprehensive-load-tests.js

# Check chaos experiment status
kubectl describe chaosengine -n suuupra-dev

# Verify multi-region connectivity
kubectl get ingress --all-namespaces
```

## 📚 **Additional Resources**

- **[K6 Documentation](https://k6.io/docs/)** - Load testing framework
- **[Litmus Documentation](https://docs.litmuschaos.io/)** - Chaos engineering  
- **[Kubernetes Multi-Region](https://kubernetes.io/docs/setup/best-practices/multiple-zones/)** - K8s best practices
- **[SLO Best Practices](https://sre.google/sre-book/service-level-objectives/)** - Google SRE book
- **[Performance Testing Guide](https://k6.io/docs/test-types/introduction/)** - K6 test types

---

## ✅ **Phase 4 Completion Checklist**

- [x] **Chaos Engineering**: Litmus setup with comprehensive failure scenarios
- [x] **Multi-Region Deployment**: Global architecture with disaster recovery
- [x] **Load Testing Framework**: Advanced K6 with 6 test profiles  
- [x] **SLO Monitoring**: Automated compliance checking and alerting
- [x] **CI/CD Integration**: Orchestration scripts with notification support
- [x] **Performance Analytics**: Trend analysis and regression detection
- [x] **Documentation**: Complete setup and operational guides

**🎉 Phase 4: Production Hardening - COMPLETE!**

The Suuupra Platform now has enterprise-grade resilience testing, global deployment capabilities, and comprehensive performance validation frameworks ready for production scale.

**Next**: Proceed to **Phase 5: Disaster Recovery** for backup strategies and incident response playbooks.
