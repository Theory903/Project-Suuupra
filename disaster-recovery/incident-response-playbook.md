# 🚨 **SUUUPRA PLATFORM INCIDENT RESPONSE PLAYBOOK** - Phase 5

## 🎯 **Executive Summary**

This playbook provides **step-by-step procedures** for responding to critical incidents in the Suuupra Platform. It covers incident classification, response procedures, escalation paths, and post-incident activities to ensure rapid recovery and continuous improvement.

---

## 📋 **Incident Classification Matrix**

| Severity | Description | Response Time | Examples | Escalation |
|----------|-------------|---------------|----------|------------|
| **🔴 P0 - Critical** | Complete system outage, data loss, security breach | **15 minutes** | API completely down, database corruption, payment system failure | Immediate C-level notification |
| **🟠 P1 - High** | Significant functionality impacted, partial outage | **1 hour** | Login issues, course streaming down, payment delays | Engineering leadership |
| **🟡 P2 - Medium** | Minor functionality impacted, workarounds available | **4 hours** | Slow API responses, minor UI bugs, non-critical integrations | Team lead notification |
| **🟢 P3 - Low** | Minor issues, no user impact | **Next business day** | Cosmetic issues, internal tool problems, documentation gaps | Standard ticket queue |

---

## 🚦 **PHASE 1: IMMEDIATE RESPONSE (0-15 minutes)**

### 1.1 **Incident Detection & Initial Assessment**

**🔍 Detection Sources:**

- Prometheus alerts (Golden Signals violations)
- User reports via support channels
- Monitoring dashboard anomalies
- External monitoring (Pingdom, etc.)
- Security alerts (SIEM, IDS)

**⚡ Immediate Actions:**

```bash
# 1. Acknowledge the incident
curl -X POST "https://api.pagerduty.com/incidents/{incident_id}/acknowledge" \
  -H "Authorization: Token YOUR_API_TOKEN"

# 2. Quick system health check
kubectl get pods --all-namespaces | grep -v Running
kubectl get nodes
kubectl top nodes
kubectl get ingress --all-namespaces

# 3. Check critical services
curl -f https://api.suuupra.io/health || echo "API DOWN"
curl -f https://api.suuupra.io/api/v1/courses || echo "COURSES API DOWN"
redis-cli -h redis.suuupra-prod.svc.cluster.local ping || echo "REDIS DOWN"

# 4. Check database connectivity
psql -h postgres.suuupra-prod.svc.cluster.local -U postgres -c "SELECT 1;" || echo "DB DOWN"
```

### 1.2 **Incident Commander Assignment**

**🎯 Incident Commander Responsibilities:**

- Overall incident coordination
- Communication with stakeholders
- Decision making authority
- Resource allocation
- Timeline management

**📞 Escalation Chain:**

1. **On-Call Engineer** (first responder)
2. **Technical Lead** (P1+ incidents)
3. **Engineering Manager** (P0 incidents)
4. **CTO** (P0 incidents + business impact)
5. **CEO** (P0 incidents + major business impact)

### 1.3 **War Room Setup**

```bash
# Create incident Slack channel
curl -X POST https://slack.com/api/conversations.create \
  -H "Authorization: Bearer $SLACK_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "incident-'$(date +%Y%m%d%H%M)'",
    "is_private": false
  }'

# Invite key personnel
# - Incident Commander
# - On-call engineers
# - Product manager
# - Customer support lead
```

---

## 🔧 **PHASE 2: DIAGNOSIS & CONTAINMENT (15-60 minutes)**

### 2.1 **System Diagnosis Procedures**

**🩺 Health Check Scripts:**

```bash
#!/bin/bash
# suuupra-health-check.sh - Comprehensive system health assessment

echo "=== SUUUPRA PLATFORM HEALTH CHECK ==="
echo "Timestamp: $(date -Iseconds)"

# Kubernetes cluster health
echo -e "\n🔍 KUBERNETES CLUSTER:"
kubectl cluster-info
kubectl get componentstatuses
kubectl get nodes -o wide

# Critical namespaces
echo -e "\n📦 CRITICAL NAMESPACES:"
for ns in suuupra-prod monitoring velero linkerd cert-manager; do
  echo "--- Namespace: $ns ---"
  kubectl get pods -n $ns --no-headers | awk '{print $1, $3}' | grep -v Running || echo "All pods running"
done

# Ingress and services
echo -e "\n🌐 INGRESS & SERVICES:"
kubectl get ingress --all-namespaces
kubectl get svc -n suuupra-prod

# Storage and volumes
echo -e "\n💾 STORAGE:"
kubectl get pv,pvc --all-namespaces
df -h

# Resource usage
echo -e "\n📊 RESOURCE USAGE:"
kubectl top nodes
kubectl top pods --all-namespaces --sort-by=cpu | head -20

# Database status
echo -e "\n🗄️ DATABASE:"
export PGPASSWORD="$POSTGRES_PASSWORD"
psql -h postgres.suuupra-prod.svc.cluster.local -U postgres -c "
  SELECT 
    pg_database.datname,
    pg_database_size(pg_database.datname) as size_bytes,
    numbackends 
  FROM pg_database 
  LEFT JOIN pg_stat_database ON pg_database.datname = pg_stat_database.datname 
  WHERE pg_database.datistemplate = false;
"

# Redis status
echo -e "\n⚡ REDIS:"
redis-cli -h redis.suuupra-prod.svc.cluster.local info replication
redis-cli -h redis.suuupra-prod.svc.cluster.local info memory

# Kafka status
echo -e "\n🔄 KAFKA:"
kubectl exec -n suuupra-prod kafka-0 -- kafka-broker-api-versions.sh --bootstrap-server localhost:9092

# Recent logs
echo -e "\n📋 RECENT ERROR LOGS:"
kubectl logs --tail=50 --all-containers=true -n suuupra-prod -l app=api-gateway | grep -i error | tail -10
kubectl logs --tail=50 --all-containers=true -n suuupra-prod -l app=postgres | grep -i error | tail -10
```

### 2.2 **Common Incident Types & Quick Fixes**

#### 🚨 **API Gateway Down**

```bash
# Check gateway pods
kubectl get pods -n suuupra-prod -l app=api-gateway

# Scale up if needed
kubectl scale deployment api-gateway -n suuupra-prod --replicas=5

# Check recent deployments
kubectl rollout history deployment/api-gateway -n suuupra-prod

# Rollback if recent deployment caused issue
kubectl rollout undo deployment/api-gateway -n suuupra-prod

# Check ingress
kubectl describe ingress api-gateway -n suuupra-prod

# Force restart
kubectl rollout restart deployment/api-gateway -n suuupra-prod
```

#### 🗄️ **Database Issues**

```bash
# Check PostgreSQL pods
kubectl get pods -n suuupra-prod -l app=postgres

# Check connections
kubectl exec -n suuupra-prod postgres-0 -- psql -U postgres -c "
  SELECT count(*) as connections, state 
  FROM pg_stat_activity 
  GROUP BY state;
"

# Check for blocking queries
kubectl exec -n suuupra-prod postgres-0 -- psql -U postgres -c "
  SELECT pid, now() - pg_stat_activity.query_start AS duration, query 
  FROM pg_stat_activity 
  WHERE (now() - pg_stat_activity.query_start) > interval '5 minutes' 
  AND state = 'active';
"

# Kill long-running queries (if safe)
# kubectl exec -n suuupra-prod postgres-0 -- psql -U postgres -c "SELECT pg_terminate_backend(PID_HERE);"

# Check disk space
kubectl exec -n suuupra-prod postgres-0 -- df -h /var/lib/postgresql/data
```

#### ⚡ **Redis/Cache Issues**

```bash
# Check Redis pods
kubectl get pods -n suuupra-prod -l app=redis

# Check memory usage
kubectl exec -n suuupra-prod redis-0 -- redis-cli info memory

# Clear cache if needed (CAUTION: This impacts performance)
# kubectl exec -n suuupra-prod redis-0 -- redis-cli flushall

# Check for slow queries
kubectl exec -n suuupra-prod redis-0 -- redis-cli slowlog get 10
```

#### 🔄 **Kafka/Event Streaming Issues**

```bash
# Check Kafka pods
kubectl get pods -n suuupra-prod -l app=kafka

# Check topic status
kubectl exec -n suuupra-prod kafka-0 -- kafka-topics.sh \
  --bootstrap-server localhost:9092 --list

# Check consumer lag
kubectl exec -n suuupra-prod kafka-0 -- kafka-consumer-groups.sh \
  --bootstrap-server localhost:9092 --describe --all-groups
```

### 2.3 **Containment Strategies**

#### 🛡️ **Traffic Management**

```bash
# Implement circuit breaker
kubectl patch deployment api-gateway -n suuupra-prod -p '{
  "spec": {
    "template": {
      "metadata": {
        "annotations": {
          "config.linkerd.io/proxy-outbound-connect-timeout": "1s",
          "config.linkerd.io/proxy-outbound-request-timeout": "3s"
        }
      }
    }
  }
}'

# Rate limiting (if available in gateway)
kubectl apply -f - <<EOF
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: emergency-rate-limit
  namespace: suuupra-prod
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Ingress
  ingress:
  - from: []
    ports:
    - protocol: TCP
      port: 3000
EOF
```

#### 🚧 **Service Isolation**

```bash
# Isolate problematic service
kubectl patch deployment problematic-service -n suuupra-prod -p '{
  "spec": {
    "replicas": 0
  }
}'

# Enable maintenance mode
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: maintenance-mode
  namespace: suuupra-prod
data:
  enabled: "true"
  message: "We are currently performing emergency maintenance. Service will be restored shortly."
EOF
```

---

## 🔄 **PHASE 3: RESOLUTION & RECOVERY (1-4 hours)**

### 3.1 **Resolution Strategies by Incident Type**

#### 📊 **Performance Degradation**

```bash
# Scale critical services
kubectl scale deployment api-gateway -n suuupra-prod --replicas=10
kubectl scale deployment course-service -n suuupra-prod --replicas=8
kubectl scale deployment user-service -n suuupra-prod --replicas=6

# Add resource limits if missing
kubectl patch deployment api-gateway -n suuupra-prod -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "api-gateway",
          "resources": {
            "limits": {"cpu": "2000m", "memory": "4Gi"},
            "requests": {"cpu": "1000m", "memory": "2Gi"}
          }
        }]
      }
    }
  }
}'

# Enable HPA if not already enabled
kubectl apply -f - <<EOF
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
  namespace: suuupra-prod
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 20
  metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
EOF
```

#### 🔒 **Security Incidents**

```bash
# Immediate containment
# 1. Isolate affected pods
kubectl patch networkpolicy default-deny -n suuupra-prod -p '{
  "spec": {
    "ingress": [],
    "egress": []
  }
}'

# 2. Rotate credentials
kubectl delete secret api-secrets -n suuupra-prod
kubectl create secret generic api-secrets -n suuupra-prod \
  --from-literal=jwt-secret="$(openssl rand -base64 32)" \
  --from-literal=db-password="$(openssl rand -base64 24)"

# 3. Force pod restart with new secrets
kubectl rollout restart deployment --all -n suuupra-prod

# 4. Enable additional logging
kubectl patch deployment api-gateway -n suuupra-prod -p '{
  "spec": {
    "template": {
      "spec": {
        "containers": [{
          "name": "api-gateway",
          "env": [{"name": "LOG_LEVEL", "value": "debug"}]
        }]
      }
    }
  }
}'
```

### 3.2 **Point-in-Time Recovery Procedures**

#### 🔄 **Database Point-in-Time Recovery**

```bash
#!/bin/bash
# Database PITR - Use with extreme caution in production

RECOVERY_TIME="$1"  # Format: 2024-01-15 14:30:00
BACKUP_NAME="${2:-latest}"

echo "🚨 INITIATING DATABASE POINT-IN-TIME RECOVERY"
echo "Recovery target time: $RECOVERY_TIME"
echo "Using backup: $BACKUP_NAME"

# 1. Create maintenance window
kubectl apply -f - <<EOF
apiVersion: v1
kind: ConfigMap
metadata:
  name: maintenance-mode
  namespace: suuupra-prod
data:
  enabled: "true"
  message: "Emergency database recovery in progress. Expected duration: 2-4 hours."
EOF

# 2. Scale down all applications
kubectl scale deployment --all --replicas=0 -n suuupra-prod

# 3. Create database backup before recovery
kubectl exec -n suuupra-prod postgres-0 -- pg_dumpall -U postgres > \
  "/tmp/emergency-backup-$(date +%Y%m%d_%H%M%S).sql"

# 4. Execute PITR (this will be done by DBA manually)
echo "Manual intervention required:"
echo "1. Stop PostgreSQL: kubectl exec -n suuupra-prod postgres-0 -- systemctl stop postgresql"
echo "2. Run PITR script: kubectl exec -n suuupra-prod postgres-0 -- /scripts/pitr-restore.sh '$RECOVERY_TIME' '$BACKUP_NAME'"
echo "3. Verify database integrity"
echo "4. Scale applications back up"

# 5. Verification queries (run after recovery)
cat > /tmp/verification-queries.sql <<EOF
-- Verify data integrity after PITR
SELECT 'users' as table_name, count(*) as row_count FROM users;
SELECT 'courses' as table_name, count(*) as row_count FROM courses;
SELECT 'enrollments' as table_name, count(*) as row_count FROM enrollments;
SELECT 'payments' as table_name, count(*) as row_count FROM payments;

-- Check recent transactions
SELECT 'recent_transactions' as check_type, count(*) as count 
FROM payments 
WHERE created_at > NOW() - INTERVAL '1 hour';
EOF
```

### 3.3 **Service Recovery Verification**

```bash
#!/bin/bash
# Service recovery verification script

echo "🔍 VERIFYING SERVICE RECOVERY"

# Wait for pods to be ready
echo "Waiting for pods to become ready..."
kubectl wait --for=condition=ready pod --all -n suuupra-prod --timeout=300s

# Health checks
echo "Performing health checks..."

# API Gateway
API_HEALTH=$(curl -s -o /dev/null -w "%{http_code}" https://api.suuupra.io/health)
if [[ "$API_HEALTH" == "200" ]]; then
  echo "✅ API Gateway healthy"
else
  echo "❌ API Gateway unhealthy (HTTP $API_HEALTH)"
fi

# Database connectivity
DB_STATUS=$(kubectl exec -n suuupra-prod postgres-0 -- psql -U postgres -Atc "SELECT 1" 2>/dev/null)
if [[ "$DB_STATUS" == "1" ]]; then
  echo "✅ Database healthy"
else
  echo "❌ Database unhealthy"
fi

# Redis connectivity
REDIS_STATUS=$(kubectl exec -n suuupra-prod redis-0 -- redis-cli ping 2>/dev/null)
if [[ "$REDIS_STATUS" == "PONG" ]]; then
  echo "✅ Redis healthy"
else
  echo "❌ Redis unhealthy"
fi

# Critical user flows
SIGNUP_TEST=$(curl -s -X POST https://api.suuupra.io/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test123"}' \
  -w "%{http_code}" -o /dev/null)

LOGIN_TEST=$(curl -s -X POST https://api.suuupra.io/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"demo@suuupra.io","password":"demo123"}' \
  -w "%{http_code}" -o /dev/null)

if [[ "$SIGNUP_TEST" =~ ^(200|201|400|409)$ ]] && [[ "$LOGIN_TEST" =~ ^(200|400|401)$ ]]; then
  echo "✅ Authentication endpoints responding"
else
  echo "❌ Authentication endpoints not responding properly"
fi

echo "Recovery verification completed"
```

---

## 📢 **PHASE 4: COMMUNICATION (Ongoing)**

### 4.1 **Internal Communication Templates**

#### 🔴 **P0 Critical Incident**

```text
🚨 CRITICAL INCIDENT ALERT - P0

Incident ID: INC-2024-0115-001
Start Time: 2024-01-15 14:30 UTC
Incident Commander: @john.doe
Status: INVESTIGATING

IMPACT:
- Complete API outage affecting all users
- Payment processing disabled
- Estimated users affected: 50,000+

CURRENT ACTIONS:
- Emergency response team assembled
- Investigating root cause in API Gateway
- Implementing emergency traffic routing

NEXT UPDATE: 15 minutes (14:45 UTC)

War Room: #incident-20240115-1430
Status Page: https://status.suuupra.io
```

#### 🟠 **P1 High Priority**

```text
🔶 HIGH PRIORITY INCIDENT - P1

Incident ID: INC-2024-0115-002
Start Time: 2024-01-15 16:20 UTC
Incident Commander: @jane.smith
Status: MITIGATING

IMPACT:
- Course video streaming degraded
- 30% slower load times
- Estimated users affected: 15,000

ACTIONS TAKEN:
- Identified database performance issue
- Scaled API Gateway replicas 3→8
- Database query optimization in progress

ETA RESOLUTION: 2 hours
NEXT UPDATE: 30 minutes (16:50 UTC)
```

### 4.2 **External Communication (Status Page)**

```markdown
# Investigating Service Degradation
**Jan 15, 14:30 UTC** - *Posted by Suuupra Engineering Team*

We are currently investigating reports of slow response times and intermittent errors when accessing courses. Our engineering team is actively working on a resolution.

**Impact:** Course streaming and enrollment may be slower than usual
**Affected Services:** Course catalog, video streaming
**Workaround:** Refreshing the page may resolve temporary issues

We will provide an update within 30 minutes or when more information becomes available.

---

# Identified and Mitigating Issue
**Jan 15, 14:45 UTC** - *Updated by Suuupra Engineering Team*

We have identified the root cause as a database performance issue causing slow query responses. Our team has implemented the following mitigation steps:

- Scaled our API infrastructure to handle increased load
- Optimized slow-running database queries
- Implemented additional caching layers

**Current Status:** Significant improvement in response times
**Next Steps:** Continuing to monitor and optimize performance

We expect full resolution within the next hour.

---

# Incident Resolved
**Jan 15, 15:30 UTC** - *Posted by Suuupra Engineering Team*

**RESOLVED** - All services are now operating normally. 

**Summary:** Between 14:30 and 15:30 UTC, users experienced degraded performance when accessing course content. This was caused by inefficient database queries during peak traffic.

**Resolution:** Database queries have been optimized and additional monitoring has been implemented to prevent similar issues.

**What we're doing:** We are conducting a post-incident review to identify improvements to our monitoring and alerting systems.

Thank you for your patience during this incident.
```

---

## 📊 **PHASE 5: POST-INCIDENT REVIEW**

### 5.1 **Post-Incident Review Template**

```markdown
# Post-Incident Review: [Incident Title]

**Incident ID:** INC-2024-0115-001
**Date:** January 15, 2024
**Duration:** 14:30 UTC - 15:30 UTC (1 hour)
**Severity:** P1
**Incident Commander:** John Doe

## Executive Summary
[Brief description of the incident and its impact]

## Timeline
| Time (UTC) | Event | Owner |
|------------|--------|--------|
| 14:30 | Initial alert received - API response time spike | Monitoring |
| 14:32 | On-call engineer paged | PagerDuty |
| 14:35 | War room established, incident commander assigned | @john.doe |
| 14:40 | Root cause identified: database query inefficiency | @jane.smith |
| 14:45 | Mitigation deployed: query optimization + scaling | @mike.johnson |
| 15:15 | Metrics return to normal | Monitoring |
| 15:30 | Incident resolved, monitoring continues | Team |

## Impact Analysis
- **Users Affected:** ~15,000 (30% of active users)
- **Revenue Impact:** $5,000 in failed transactions
- **Services Affected:** Course streaming, enrollment, payments
- **Customer Support:** 47 tickets created, 23 resolved

## Root Cause Analysis
### What Happened
The incident was caused by a database query optimization issue...

### Why It Happened (5 Whys)
1. **Why did API response times spike?**
   - Database queries were taking 5-10 seconds instead of <100ms
2. **Why were database queries slow?**
   - Missing index on user_enrollments.created_at column
3. **Why was the index missing?**
   - Recent schema migration didn't include performance indexes
4. **Why weren't performance indexes included?**
   - Database review process doesn't include performance testing
5. **Why don't we have performance testing in DB reviews?**
   - No formal process for testing migration performance impact

### Contributing Factors
- High traffic during lunch hours (US timezone)
- Recent code deployment increased query frequency
- Monitoring alerts were delayed by 3 minutes

## What Went Well
- ✅ Incident detection within 2 minutes
- ✅ War room established quickly with right people
- ✅ Clear communication throughout incident
- ✅ Effective mitigation strategy deployed
- ✅ Customer communication was timely and transparent

## What Could Have Been Better
- ❌ Root cause identification took 10 minutes longer than target
- ❌ Database performance testing in staging didn't catch the issue
- ❌ Monitoring alert threshold needs adjustment
- ❌ Customer impact could have been reduced with better circuit breakers

## Action Items
| Action | Owner | Due Date | Priority |
|--------|--------|-----------|----------|
| Add missing database index | @db-team | 2024-01-16 | P0 |
| Implement database performance testing in CI/CD | @devops-team | 2024-01-30 | P1 |
| Adjust monitoring alert thresholds | @sre-team | 2024-01-20 | P1 |
| Review and improve circuit breaker configuration | @backend-team | 2024-01-25 | P2 |
| Create database migration performance checklist | @db-team | 2024-01-22 | P2 |
| Schedule chaos engineering test for database | @sre-team | 2024-02-15 | P3 |

## Lessons Learned
1. **Performance testing must include realistic traffic patterns**
2. **Database migrations require dedicated performance review**
3. **Circuit breakers need more aggressive failure detection**
4. **Monitoring alerts should trigger faster for user-facing issues**

## Follow-up Actions
- [ ] Schedule follow-up meeting in 2 weeks to review action item progress
- [ ] Share learnings with other engineering teams
- [ ] Update incident response procedures based on lessons learned
- [ ] Consider adding this scenario to chaos engineering tests
```

### 5.2 **Metrics & KPIs**

Track the following metrics for continuous improvement:

```bash
# Incident Response KPIs
cat > /tmp/incident-kpis.md <<EOF
# Incident Response KPIs - Monthly Report

## Response Times
- Mean Time to Acknowledge (MTTA): 3.2 minutes ⬆️ +0.5min
- Mean Time to Resolve (MTTR): 47 minutes ⬇️ -8min  
- Mean Time to Recovery (MTBR): 52 minutes ⬇️ -12min

## Incident Volume
- P0 Critical: 2 incidents (target: <1)
- P1 High: 8 incidents (target: <5)
- P2 Medium: 24 incidents (target: <20)
- P3 Low: 56 incidents (acceptable)

## Availability & Performance
- Overall Uptime: 99.94% (target: 99.95%)
- API P95 Latency: 245ms (target: <300ms)
- API Error Rate: 0.08% (target: <0.1%)

## Process Improvement
- Post-incident reviews completed: 8/10 (target: 100%)
- Action items completed on time: 67% (target: 90%)
- Repeat incidents: 1 (target: 0)
EOF
```

---

## 🛠️ **INCIDENT RESPONSE TOOLS & SCRIPTS**

### Emergency Scripts Location

```bash
# Clone incident response toolkit
git clone https://github.com/suuupra/incident-response-toolkit.git
cd incident-response-toolkit

# Available scripts:
ls -la scripts/
# - health-check.sh           - Comprehensive system health check
# - scale-emergency.sh         - Emergency scaling for all critical services  
# - network-isolation.sh       - Isolate compromised services
# - backup-emergency.sh        - Trigger emergency backup
# - maintenance-mode.sh        - Enable/disable maintenance mode
# - traffic-routing.sh         - Emergency traffic routing changes
```

### Quick Reference Commands

```bash
# Emergency contacts
export ONCALL_PRIMARY="+1-555-123-4567"
export ONCALL_SECONDARY="+1-555-765-4321"
export INCIDENT_COMMANDER="+1-555-999-1234"

# Critical service endpoints
export API_HEALTH="https://api.suuupra.io/health"
export STATUS_PAGE="https://status.suuupra.io"
export MONITORING_DASHBOARD="https://grafana.suuupra.io"
export PAGERDUTY_API="https://api.pagerduty.com"

# Emergency scaling
alias emergency-scale='kubectl scale deployment --replicas=10 api-gateway course-service user-service -n suuupra-prod'

# Quick logs
alias recent-errors='kubectl logs --tail=100 --all-containers=true -n suuupra-prod | grep -i error | tail -20'

# Maintenance mode toggle
alias maintenance-on='kubectl patch configmap maintenance-mode -n suuupra-prod -p "{\"data\":{\"enabled\":\"true\"}}"'
alias maintenance-off='kubectl patch configmap maintenance-mode -n suuupra-prod -p "{\"data\":{\"enabled\":\"false\"}}"'
```

---

## 📚 **TRAINING & PREPAREDNESS**

### Monthly Incident Response Drills

1. **Chaos Engineering** - Controlled failure injection
2. **Communication Drills** - Practice incident communication
3. **Backup Recovery** - Test backup and restore procedures
4. **Security Incidents** - Simulate security breach scenarios
5. **Multi-Region Failover** - Practice regional disaster recovery

### Training Resources

- **Incident Response Certification** - Internal certification program
- **Chaos Engineering Workshop** - Monthly hands-on sessions
- **Post-Incident Review Training** - Effective PIR techniques
- **Communication Skills** - Customer communication best practices

---

**🎯 This playbook is a living document. Update it regularly based on new incidents, learnings, and system changes.**

**📞 Emergency Contacts:**

- **Primary On-Call:** +1-555-123-4567
- **Incident Commander:** +1-555-999-1234  
- **Engineering Manager:** +1-555-777-8888
- **CTO:** +1-555-555-5555
