# API Gateway Operations Runbook

## Table of Contents

1. [Overview](#overview)
2. [Circuit Breaker Operations](#circuit-breaker-operations)
3. [Rate Limiting Management](#rate-limiting-management)
4. [GitOps Configuration Management](#gitops-configuration-management)
5. [Performance Tuning](#performance-tuning)
6. [Troubleshooting Guide](#troubleshooting-guide)
7. [Emergency Procedures](#emergency-procedures)
8. [Monitoring and Alerting](#monitoring-and-alerting)

## Overview

This runbook provides operational guidance for managing the API Gateway in production environments. It covers common operational tasks, troubleshooting procedures, and emergency response protocols.

### Key Contacts

- **Platform Team**: platform-team@company.com
- **Security Team**: security-team@company.com
- **On-Call Engineer**: +1-xxx-xxx-xxxx

### Quick Reference

- **Admin API**: `https://api-gateway.company.com/admin`
- **Grafana Dashboard**: `https://grafana.company.com/d/api-gateway`
- **Prometheus**: `https://prometheus.company.com`
- **Runbook Repository**: `https://github.com/company/runbooks`

---

## Circuit Breaker Operations

### Understanding Circuit Breaker States

The API Gateway uses circuit breakers to prevent cascading failures. Each circuit breaker can be in one of three states:

- **CLOSED**: Normal operation, requests pass through
- **OPEN**: Failure threshold exceeded, requests are rejected
- **HALF_OPEN**: Testing if service has recovered

### Monitoring Circuit Breakers

#### Key Metrics

```promql
# Circuit breaker state by service

gateway_circuit_breaker_state{service="user-service", state="open"}

# Failure rate

rate(gateway_circuit_breaker_failures_total[5m])

# Request volume

rate(gateway_circuit_breaker_requests_total[5m])
```text

#### Dashboard Panels

- Circuit Breaker States (by service)
- Failure Rates
- Recovery Times
- Request Success/Failure Distribution

### Circuit Breaker Tuning

#### Common Scenarios and Solutions

**Scenario 1: Circuit Breaker Opens Too Frequently**
```bash
# Check current configuration

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/routes/user-service

# Update failure threshold (increase from 10 to 20 failures)

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://api-gateway.company.com/admin/api/v1/routes/user-service \
  -d '{
    "policy": {
      "circuitBreaker": {
        "failureThreshold": 20,
        "timeoutMs": 5000,
        "resetTimeoutMs": 60000
      }
    }
  }'
```text

**Scenario 2: Circuit Breaker Doesn't Open When It Should**
```bash
# Decrease failure threshold and timeout

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://api-gateway.company.com/admin/api/v1/routes/user-service \
  -d '{
    "policy": {
      "circuitBreaker": {
        "failureThreshold": 5,
        "timeoutMs": 3000,
        "resetTimeoutMs": 30000
      }
    }
  }'
```text

**Scenario 3: Circuit Breaker Stuck Open**
```bash
# Force circuit breaker to half-open state

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/circuit-breakers/user-service/reset

# Check service health directly

curl -f https://user-service.company.com/health
```text

#### Best Practices

- **Failure Threshold**: Start with 10-15 failures in a 1-minute window
- **Timeout**: Set based on service P99 latency + 2x buffer
- **Reset Timeout**: Start with 30-60 seconds, adjust based on service recovery time
- **Monitor**: Always monitor both gateway and downstream service metrics

### Emergency Circuit Breaker Actions

#### Manually Open Circuit Breaker

```bash
# Emergency: Stop all traffic to a problematic service

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/circuit-breakers/problematic-service/open
```text

#### Manually Close Circuit Breaker

```bash
# Emergency: Force traffic through (use with caution)

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/circuit-breakers/service-name/close
```text

---

## Rate Limiting Management

### Understanding Rate Limiting Keys

The API Gateway supports multiple rate limiting strategies:

- **IP-based**: `ip:192.168.1.1`
- **User-based**: `user:user-123`
- **API Key-based**: `api-key:key-456`
- **Route-based**: `route:/api/v1/users`
- **Tenant-based**: `tenant:acme-corp`

### Monitoring Rate Limits

#### Key Metrics

```promql
# Rate limit hits by key type

rate(gateway_rate_limit_hits_total[5m])

# Rate limit exceeded (blocked requests)

rate(gateway_rate_limit_exceeded_total[5m])

# Current token bucket levels

gateway_rate_limit_tokens_remaining
```text

### Rate Limit Operations

#### Check Current Limits

```bash
# Get all rate limits

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/rate-limits

# Get specific limit

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/rate-limits/ip:192.168.1.1
```text

#### Update Rate Limits

```bash
# Increase rate limit for specific user

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://api-gateway.company.com/admin/api/v1/rate-limits/user:premium-user \
  -d '{
    "limit": 1000,
    "window": 60,
    "burst": 50
  }'

# Set temporary higher limit for load testing

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://api-gateway.company.com/admin/api/v1/rate-limits/ip:load-test-ip \
  -d '{
    "limit": 10000,
    "window": 60,
    "burst": 100,
    "expiresAt": "2024-01-15T10:00:00Z"
  }'
```text

#### Clear Rate Limit Counters

```bash
# Reset specific rate limit counter

curl -X DELETE -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/rate-limits/user:user-123/reset

# Clear all expired rate limits

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/rate-limits/cleanup
```text

### Common Rate Limiting Scenarios

#### Scenario 1: User Reports Being Rate Limited

1. **Check current usage**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     "https://api-gateway.company.com/admin/api/v1/rate-limits/user:$USER_ID"
   ```

2. **Check recent requests**:
   ```promql
   rate(gateway_requests_total{user_id="$USER_ID"}[5m])
   ```

3. **Temporarily increase limit** if legitimate:
   ```bash
   curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     https://api-gateway.company.com/admin/api/v1/rate-limits/user:$USER_ID \
     -d '{"limit": 500, "window": 60}'
   ```

#### Scenario 2: DDoS Attack Detection

1. **Check top IPs**:
   ```promql
   topk(10, rate(gateway_requests_total[1m])) by (client_ip)
   ```

2. **Block malicious IPs**:
   ```bash
   # Set very low rate limit
   curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     https://api-gateway.company.com/admin/api/v1/rate-limits/ip:$MALICIOUS_IP \
     -d '{"limit": 1, "window": 3600}'
   
   # Or use IP deny list
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     https://api-gateway.company.com/admin/api/v1/security/ip-deny \
     -d '{"ip": "$MALICIOUS_IP", "reason": "DDoS attack", "duration": 3600}'
   ```

#### Scenario 3: Rate Limit Saturation

1. **Identify bottleneck**:
   ```promql
   # Check which limits are being hit most
   topk(10, rate(gateway_rate_limit_exceeded_total[5m])) by (limit_key)
   ```

2. **Adjust limits or add more granular controls**:
   ```bash
   # Add route-specific limits
   curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     https://api-gateway.company.com/admin/api/v1/routes/expensive-api \
     -d '{
       "policy": {
         "rateLimit": {
           "requests": 10,
           "window": 60,
           "keys": ["user", "ip"]
         }
       }
     }'
   ```

---

## GitOps Configuration Management

### Understanding GitOps Workflow

The API Gateway supports GitOps-driven configuration management:

1. Configuration changes are made in Git repository
2. Gateway polls for changes or receives webhooks
3. Changes are validated and applied atomically
4. Drift detection alerts when configuration diverges

### Monitoring GitOps

#### Key Metrics

```promql
# Successful syncs

rate(gateway_gitops_sync_success_total[5m])

# Failed syncs

rate(gateway_gitops_sync_failures_total[5m])

# Configuration drift detected

gateway_gitops_drift_detected

# Last successful sync timestamp

gateway_gitops_last_sync_timestamp
```text

### GitOps Operations

#### Check Sync Status

```bash
# Get current GitOps status

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/gitops/status

# Get sync history

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/gitops/history?limit=10
```text

#### Force Configuration Sync

```bash
# Trigger immediate sync

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/gitops/sync

# Force sync (ignore drift protection)

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/gitops/force-sync
```text

#### Handle Configuration Conflicts

**Scenario 1: Sync Failures Due to Invalid Configuration**
1. **Check validation errors**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://api-gateway.company.com/admin/api/v1/gitops/validation-errors
   ```

2. **Rollback to last known good configuration**:
   ```bash
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://api-gateway.company.com/admin/api/v1/gitops/rollback
   ```

3. **Fix configuration in Git and retry**:
   ```bash
   # After fixing Git configuration
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://api-gateway.company.com/admin/api/v1/gitops/sync
   ```

**Scenario 2: Configuration Drift Detected**
1. **Check what changed**:
   ```bash
   curl -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://api-gateway.company.com/admin/api/v1/gitops/drift
   ```

2. **Options**:
   - **Sync from Git** (overwrite local changes):
     ```bash
     curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
       https://api-gateway.company.com/admin/api/v1/gitops/sync-from-git
     ```
   - **Push to Git** (preserve local changes):
     ```bash
     curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
       https://api-gateway.company.com/admin/api/v1/gitops/push-to-git
     ```

#### Emergency Configuration Override

```bash
# Disable GitOps temporarily for manual changes

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/gitops/disable

# Make emergency changes via Admin API

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://api-gateway.company.com/admin/api/v1/routes/critical-service \
  -d '{"policy": {"circuitBreaker": {"enabled": false}}}'

# Re-enable GitOps after emergency

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/gitops/enable
```text

---

## Performance Tuning

### Key Performance Indicators

#### Latency Targets

- **P50**: < 50ms
- **P95**: < 150ms
- **P99**: < 500ms

#### Throughput Targets

- **Baseline**: 1,000 RPS per instance
- **Peak**: 5,000 RPS per instance
- **Burst**: 10,000 RPS per instance (short duration)

### Performance Tuning Checklist

#### Node.js/V8 Tuning

```bash
# Optimal Node.js flags for production

NODE_OPTIONS="--max-old-space-size=4096 --max-semi-space-size=128"

# Enable V8 optimizations

NODE_OPTIONS="$NODE_OPTIONS --optimize-for-size --gc-interval=100"

# For high-throughput scenarios

NODE_OPTIONS="$NODE_OPTIONS --max-http-header-size=16384"
```text

#### Connection Pool Tuning

```javascript
// In gateway configuration
{
  "upstream": {
    "connectionPool": {
      "maxConnections": 100,
      "maxIdleTime": 60000,
      "keepAliveTimeout": 30000,
      "timeout": {
        "connect": 5000,
        "request": 30000
      }
    }
  }
}
```text

#### Memory Management

```bash
# Monitor memory usage

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/metrics/memory

# Trigger garbage collection (emergency only)

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/system/gc
```text

### Performance Troubleshooting

#### High Latency Investigation

1. **Check P99 latency by route**:
   ```promql
   histogram_quantile(0.99, 
     sum(rate(gateway_request_duration_seconds_bucket[5m])) by (route, le)
   )
   ```

2. **Identify slow upstream services**:
   ```promql
   histogram_quantile(0.95,
     sum(rate(gateway_upstream_duration_seconds_bucket[5m])) by (service, le)
   )
   ```

3. **Check for resource contention**:
   ```promql
   # CPU usage
   rate(process_cpu_seconds_total[5m]) * 100
   
   # Memory usage
   process_resident_memory_bytes / 1024 / 1024 / 1024
   
   # Event loop lag
   nodejs_eventloop_lag_seconds
   ```

#### High Memory Usage

1. **Check heap usage**:
   ```promql
   nodejs_heap_size_used_bytes / nodejs_heap_size_total_bytes * 100
   ```

2. **Identify memory leaks**:
   ```bash
   # Take heap snapshot
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://api-gateway.company.com/admin/api/v1/debug/heap-snapshot
   ```

3. **Adjust cache sizes**:
   ```bash
   # Reduce JWKS cache size
   curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     https://api-gateway.company.com/admin/api/v1/config/cache \
     -d '{"jwks": {"maxSize": 100, "ttl": 300}}'
   ```

---

## Troubleshooting Guide

### Common Issues and Solutions

#### Issue 1: High Error Rate (5xx)

**Symptoms**: Error rate > 1%, alerts firing
**Investigation**:
```bash
# Check error distribution

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/metrics/errors?window=5m

# Check upstream service health

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/services/health
```text
**Solutions**:
- Check circuit breaker states
- Verify upstream service health
- Review recent deployments
- Check resource utilization

#### Issue 2: Authentication Failures

**Symptoms**: 401 errors, JWT verification failures
**Investigation**:
```bash
# Check JWKS cache status

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/auth/jwks/status

# Check recent auth failures

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/metrics/auth-failures?limit=100
```text
**Solutions**:
- Refresh JWKS cache
- Check identity provider status
- Verify JWT token format
- Check clock synchronization

#### Issue 3: Rate Limiting Issues

**Symptoms**: Legitimate users being blocked, 429 errors
**Investigation**:
```bash
# Check current rate limit usage

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/rate-limits/top-users

# Check rate limit configuration

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/config/rate-limits
```text
**Solutions**:
- Adjust rate limits temporarily
- Clear rate limit counters
- Implement more granular limits
- Review user behavior patterns

#### Issue 4: WebSocket Connection Issues

**Symptoms**: WebSocket connections failing, streaming errors
**Investigation**:
```bash
# Check WebSocket session status

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/websocket/sessions

# Check connection metrics

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/metrics/websocket
```text
**Solutions**:
- Check proxy configuration
- Verify upstream WebSocket support
- Review connection limits
- Check network connectivity

---

## Emergency Procedures

### Incident Response Workflow

#### Severity Levels

- **P0 (Critical)**: Complete service outage
- **P1 (High)**: Major functionality impacted
- **P2 (Medium)**: Minor functionality impacted
- **P3 (Low)**: Cosmetic issues

#### P0 Response (Complete Outage)

1. **Immediate Actions** (0-5 minutes):
   ```bash
   # Check service status
   curl -f https://api-gateway.company.com/health
   
   # Check all instances
   kubectl get pods -l app=api-gateway -o wide
   
   # Check recent deployments
   kubectl rollout history deployment/api-gateway
   ```

2. **Escalation** (5-10 minutes):
   - Page on-call engineer
   - Create incident channel
   - Start incident bridge

3. **Recovery Actions**:
   ```bash
   # Rollback to previous version
   kubectl rollout undo deployment/api-gateway
   
   # Scale up instances
   kubectl scale deployment/api-gateway --replicas=10
   
   # Emergency traffic diversion
   kubectl patch service api-gateway -p '{"spec":{"selector":{"version":"stable"}}}'
   ```

#### P1 Response (Major Impact)

1. **Assessment** (0-10 minutes):
   - Identify affected functionality
   - Estimate user impact
   - Check error rates and latency

2. **Mitigation**:
   ```bash
   # Enable circuit breakers for problematic services
   curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
     https://api-gateway.company.com/admin/api/v1/circuit-breakers/problematic-service/open
   
   # Adjust rate limits
   curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
     -H "Content-Type: application/json" \
     https://api-gateway.company.com/admin/api/v1/rate-limits/global \
     -d '{"limit": 500, "window": 60}'
   ```

### Emergency Configuration Changes

#### Disable Problematic Features

```bash
# Disable WAF temporarily

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://api-gateway.company.com/admin/api/v1/config/waf \
  -d '{"enabled": false}'

# Disable rate limiting

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://api-gateway.company.com/admin/api/v1/config/rate-limiting \
  -d '{"enabled": false}'

# Disable authentication for specific routes

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://api-gateway.company.com/admin/api/v1/routes/emergency-route \
  -d '{"policy": {"auth": {"enabled": false}}}'
```text

#### Emergency Traffic Management

```bash
# Route all traffic to healthy instances

curl -X PUT -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://api-gateway.company.com/admin/api/v1/services/user-service \
  -d '{
    "discovery": {
      "type": "static",
      "endpoints": ["https://user-service-healthy.company.com"]
    }
  }'

# Enable maintenance mode

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/maintenance/enable
```text

### Post-Incident Actions

1. **Create incident report**
2. **Schedule post-mortem**
3. **Update runbooks**
4. **Implement preventive measures**
5. **Test recovery procedures**

---

## Monitoring and Alerting

### Key Dashboards

#### Primary Dashboard

- **URL**: https://grafana.company.com/d/api-gateway
- **Refresh**: 30s
- **Time Range**: Last 1 hour

#### Key Panels

1. Request Rate (RPS)
2. Error Rate (%)
3. P99 Latency
4. Circuit Breaker States
5. Rate Limiting Status
6. Memory Usage
7. Active Connections

### Alert Definitions

#### Critical Alerts

- **HighGatewayLatency**: P99 > 150ms for 2 minutes
- **CriticalGatewayErrorRate**: 5xx rate > 5% for 1 minute
- **GatewayInstanceDown**: Instance unavailable for 1 minute
- **PersistentCircuitBreakerOpen**: Breaker open for 5 minutes

#### Warning Alerts

- **HighMemoryUsage**: Memory > 2GB for 5 minutes
- **RateLimitSaturation**: 80% of limits being exceeded
- **HighAIQueueDepth**: Queue depth > 100 for 2 minutes
- **GitOpsSyncFailures**: Sync failures for 5 minutes

### Runbook Automation

#### Auto-remediation Scripts

```bash
# Auto-restart unhealthy instances

#!/bin/bash
if kubectl get pods -l app=api-gateway --field-selector=status.phase!=Running | grep -q api-gateway; then
  kubectl delete pods -l app=api-gateway --field-selector=status.phase!=Running
fi

# Auto-clear expired rate limits

#!/bin/bash
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/rate-limits/cleanup
```text

### Logging and Debugging

#### Log Locations

- **Application Logs**: `/var/log/api-gateway/app.log`
- **Access Logs**: `/var/log/api-gateway/access.log`
- **Audit Logs**: `/var/log/api-gateway/audit.log`
- **Error Logs**: `/var/log/api-gateway/error.log`

#### Useful Log Queries

```bash
# Find authentication errors

grep "AUTH_ERROR" /var/log/api-gateway/app.log | tail -100

# Find rate limiting events

grep "RATE_LIMIT_EXCEEDED" /var/log/api-gateway/access.log | tail -50

# Find circuit breaker events

grep "CIRCUIT_BREAKER" /var/log/api-gateway/app.log | tail -20
```text

---

## Appendix

### Useful Commands Reference

#### Health Checks

```bash
# Gateway health

curl -f https://api-gateway.company.com/health

# Admin API health

curl -f https://api-gateway.company.com/admin/health

# Detailed status

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/status
```text

#### Configuration Management

```bash
# Get current configuration

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/config

# Backup configuration

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/config/backup

# Restore configuration

curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  https://api-gateway.company.com/admin/api/v1/config/restore \
  -d @backup.json
```text

#### Metrics and Debugging

```bash
# Get metrics

curl https://api-gateway.company.com/metrics

# Get debug info

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/debug

# Get performance profile

curl -H "Authorization: Bearer $ADMIN_TOKEN" \
  https://api-gateway.company.com/admin/api/v1/debug/profile?duration=30
```text

### Contact Information

#### Emergency Contacts

- **Platform Team Lead**: platform-lead@company.com
- **Security Team Lead**: security-lead@company.com
- **Infrastructure Team**: infra-team@company.com

#### Documentation Links

- **Architecture Docs**: https://docs.company.com/api-gateway/architecture
- **API Reference**: https://docs.company.com/api-gateway/api
- **Deployment Guide**: https://docs.company.com/api-gateway/deployment

---

*Last Updated: 2024-01-15*
*Version: 1.0*
*Maintainer: Platform Team*
