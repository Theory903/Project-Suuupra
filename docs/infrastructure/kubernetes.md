# Kubernetes Infrastructure

## Overview

Production-grade Kubernetes architecture on Amazon EKS with multi-AZ deployment, advanced networking, security hardening, and comprehensive resource management.

## Cluster Architecture

### EKS Cluster Configuration
- **Kubernetes Version**: 1.28 (with regular updates)
- **Control Plane**: Managed by AWS EKS
- **Networking**: AWS VPC CNI with native VPC IP addressing
- **Security**: RBAC, Pod Security Standards, Network Policies

### Node Groups Strategy

| Node Group | Instance Type | Purpose | Scaling |
|------------|---------------|---------|---------|
| `system-nodes` | `m5.large` | Kubernetes system components | 2-4 nodes |
| `application-nodes` | `m5.xlarge` | General microservices | 5-50 nodes |
| `compute-intensive` | `c5.2xlarge` | ML inference, analytics | 2-20 nodes |
| `memory-intensive` | `r5.xlarge` | Caching, in-memory processing | 2-10 nodes |

### Multi-AZ Deployment
```yaml
# Cluster spans 3 availability zones
availability_zones:
  - us-east-1a
  - us-east-1b  
  - us-east-1c

# Node groups distributed across AZs
node_distribution:
  system: 1 node per AZ (minimum)
  application: Auto-scaled across all AZs
  compute: On-demand scaling based on workload
```

## Networking

### VPC Configuration
```yaml
vpc:
  cidr: "10.0.0.0/16"
  
  public_subnets:
    - "10.0.1.0/24"  # AZ-a
    - "10.0.2.0/24"  # AZ-b
    - "10.0.3.0/24"  # AZ-c
    
  private_subnets:
    - "10.0.10.0/24" # AZ-a
    - "10.0.20.0/24" # AZ-b
    - "10.0.30.0/24" # AZ-c
```

### AWS VPC CNI
- **Pod Networking**: Each pod gets VPC IP address
- **IP Address Management**: Efficient IPAM with prefix delegation
- **Security Groups**: Pod-level security group support
- **Performance**: Native VPC networking performance

### Network Policies (Calico)
```yaml
# Default deny all ingress/egress
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
  namespace: default
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress

---
# Allow specific service communication
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: api-gateway-to-services
  namespace: default
spec:
  podSelector:
    matchLabels:
      app: api-gateway
  policyTypes:
  - Egress
  egress:
  - to:
    - podSelector:
        matchLabels:
          app: identity-service
    ports:
    - protocol: TCP
      port: 8080
```

## Security

### RBAC Configuration
```yaml
# Service account for applications
apiVersion: v1
kind: ServiceAccount
metadata:
  name: app-service-account
  namespace: default

---
# Role with minimal permissions
apiVersion: rbac.authorization.k8s.io/v1
kind: Role
metadata:
  namespace: default
  name: app-role
rules:
- apiGroups: [""]
  resources: ["configmaps", "secrets"]
  verbs: ["get", "list"]

---
# Bind role to service account
apiVersion: rbac.authorization.k8s.io/v1
kind: RoleBinding
metadata:
  name: app-role-binding
  namespace: default
subjects:
- kind: ServiceAccount
  name: app-service-account
  namespace: default
roleRef:
  kind: Role
  name: app-role
  apiGroup: rbac.authorization.k8s.io
```

### Pod Security Standards
```yaml
# Enforce restricted security standards
apiVersion: v1
kind: Namespace
metadata:
  name: production
  labels:
    pod-security.kubernetes.io/enforce: restricted
    pod-security.kubernetes.io/audit: restricted
    pod-security.kubernetes.io/warn: restricted
```

### Container Security
- **Image Scanning**: Grype/Trivy for vulnerability scanning
- **Runtime Security**: Falco for runtime threat detection
- **Admission Control**: OPA Gatekeeper for policy enforcement

## Resource Management

### Resource Requests and Limits
```yaml
# Example deployment with resource management
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  replicas: 3
  template:
    spec:
      containers:
      - name: api-gateway
        image: api-gateway:latest
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        livenessProbe:
          httpGet:
            path: /health
            port: 8080
          initialDelaySeconds: 30
          periodSeconds: 10
        readinessProbe:
          httpGet:
            path: /ready
            port: 8080
          initialDelaySeconds: 5
          periodSeconds: 5
```

### Quality of Service Classes

| QoS Class | Use Case | Resource Configuration |
|-----------|----------|----------------------|
| **Guaranteed** | Critical system components | requests = limits |
| **Burstable** | Application services | requests < limits |
| **BestEffort** | Batch jobs, non-critical | No requests/limits |

### Horizontal Pod Autoscaler
```yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: api-gateway-hpa
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  minReplicas: 3
  maxReplicas: 50
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
```

### Vertical Pod Autoscaler
```yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: api-gateway-vpa
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: api-gateway
  updatePolicy:
    updateMode: "Auto"
  resourcePolicy:
    containerPolicies:
    - containerName: api-gateway
      maxAllowed:
        cpu: 1
        memory: 1Gi
      minAllowed:
        cpu: 100m
        memory: 128Mi
```

## Service Mesh (Istio)

### Installation and Configuration
```yaml
# Istio control plane
apiVersion: install.istio.io/v1alpha1
kind: IstioOperator
metadata:
  name: control-plane
spec:
  values:
    global:
      meshID: mesh1
      multiCluster:
        clusterName: production
      network: network1
  components:
    pilot:
      k8s:
        resources:
          requests:
            cpu: 200m
            memory: 256Mi
```

### Traffic Management
```yaml
# Virtual Service for canary deployment
apiVersion: networking.istio.io/v1alpha3
kind: VirtualService
metadata:
  name: api-gateway-vs
spec:
  http:
  - match:
    - headers:
        canary:
          exact: "true"
    route:
    - destination:
        host: api-gateway
        subset: v2
      weight: 100
  - route:
    - destination:
        host: api-gateway
        subset: v1
      weight: 90
    - destination:
        host: api-gateway
        subset: v2
      weight: 10

---
# Destination Rule
apiVersion: networking.istio.io/v1alpha3
kind: DestinationRule
metadata:
  name: api-gateway-dr
spec:
  host: api-gateway
  subsets:
  - name: v1
    labels:
      version: v1
  - name: v2
    labels:
      version: v2
```

### Security Policies
```yaml
# mTLS policy
apiVersion: security.istio.io/v1beta1
kind: PeerAuthentication
metadata:
  name: default
  namespace: production
spec:
  mtls:
    mode: STRICT

---
# Authorization policy
apiVersion: security.istio.io/v1beta1
kind: AuthorizationPolicy
metadata:
  name: api-gateway-authz
  namespace: production
spec:
  selector:
    matchLabels:
      app: api-gateway
  rules:
  - from:
    - source:
        principals: ["cluster.local/ns/production/sa/frontend-sa"]
  - to:
    - operation:
        methods: ["GET", "POST"]
```

## Storage

### Persistent Volumes
```yaml
# Storage class for high-performance SSD
apiVersion: storage.k8s.io/v1
kind: StorageClass
metadata:
  name: fast-ssd
provisioner: ebs.csi.aws.com
parameters:
  type: gp3
  iops: "3000"
  throughput: "125"
  encrypted: "true"
volumeBindingMode: WaitForFirstConsumer
allowVolumeExpansion: true

---
# Persistent Volume Claim
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: postgres-pvc
spec:
  accessModes:
    - ReadWriteOnce
  storageClassName: fast-ssd
  resources:
    requests:
      storage: 100Gi
```

### StatefulSets for Databases
```yaml
apiVersion: apps/v1
kind: StatefulSet
metadata:
  name: postgres
spec:
  serviceName: postgres-headless
  replicas: 3
  template:
    spec:
      containers:
      - name: postgres
        image: postgres:15
        env:
        - name: POSTGRES_DB
          value: "app"
        - name: POSTGRES_USER
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: username
        - name: POSTGRES_PASSWORD
          valueFrom:
            secretKeyRef:
              name: postgres-secret
              key: password
        ports:
        - containerPort: 5432
        volumeMounts:
        - name: postgres-storage
          mountPath: /var/lib/postgresql/data
  volumeClaimTemplates:
  - metadata:
      name: postgres-storage
    spec:
      accessModes: ["ReadWriteOnce"]
      storageClassName: fast-ssd
      resources:
        requests:
          storage: 100Gi
```

## Monitoring and Observability

### Prometheus Configuration
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: prometheus-config
data:
  prometheus.yml: |
    global:
      scrape_interval: 15s
      evaluation_interval: 15s
    
    scrape_configs:
    - job_name: 'kubernetes-pods'
      kubernetes_sd_configs:
      - role: pod
      relabel_configs:
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_scrape]
        action: keep
        regex: true
      - source_labels: [__meta_kubernetes_pod_annotation_prometheus_io_path]
        action: replace
        target_label: __metrics_path__
        regex: (.+)
```

### Grafana Dashboards
```yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: grafana-dashboards
data:
  kubernetes-cluster.json: |
    {
      "dashboard": {
        "title": "Kubernetes Cluster Overview",
        "panels": [
          {
            "title": "Node CPU Usage",
            "type": "graph",
            "targets": [
              {
                "expr": "100 - (avg by (instance) (rate(node_cpu_seconds_total{mode=\"idle\"}[5m])) * 100)"
              }
            ]
          }
        ]
      }
    }
```

## Deployment Strategies

### Rolling Updates
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: api-gateway
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 25%
      maxUnavailable: 25%
  template:
    spec:
      containers:
      - name: api-gateway
        image: api-gateway:v2.0.0
```

### Blue-Green Deployment
```bash
# Deploy green version
kubectl apply -f deployment-green.yaml

# Test green version
kubectl port-forward service/api-gateway-green 8080:8080

# Switch traffic to green
kubectl patch service api-gateway -p '{"spec":{"selector":{"version":"green"}}}'

# Remove blue version
kubectl delete deployment api-gateway-blue
```

### Canary Deployment with Istio
```yaml
apiVersion: argoproj.io/v1alpha1
kind: Rollout
metadata:
  name: api-gateway-rollout
spec:
  replicas: 10
  strategy:
    canary:
      canaryService: api-gateway-canary
      stableService: api-gateway-stable
      trafficRouting:
        istio:
          virtualService:
            name: api-gateway-vs
          destinationRule:
            name: api-gateway-dr
      steps:
      - setWeight: 5
      - pause: {duration: 2m}
      - setWeight: 20
      - pause: {duration: 5m}
      - setWeight: 50
      - pause: {duration: 10m}
      - setWeight: 100
```

## Disaster Recovery

### Backup Strategy
```yaml
# Velero backup configuration
apiVersion: velero.io/v1
kind: Backup
metadata:
  name: daily-backup
spec:
  includedNamespaces:
  - production
  - staging
  storageLocation: aws-s3
  volumeSnapshotLocations:
  - aws-ebs
  schedule: "0 2 * * *"  # Daily at 2 AM
  ttl: 720h0m0s  # 30 days
```

### Multi-Region Setup
```yaml
# Cross-region replication
clusters:
  primary:
    region: us-east-1
    role: active
    
  secondary:
    region: us-west-2
    role: standby
    replication:
      enabled: true
      lag_threshold: 5m
```

## Operations

### Cluster Maintenance
```bash
# Node drain for maintenance
kubectl drain <node-name> --ignore-daemonsets --delete-emptydir-data

# Cordon node to prevent scheduling
kubectl cordon <node-name>

# Uncordon node after maintenance
kubectl uncordon <node-name>
```

### Troubleshooting Commands
```bash
# Check cluster health
kubectl get nodes
kubectl get pods --all-namespaces

# Check resource usage
kubectl top nodes
kubectl top pods

# Describe problematic resources
kubectl describe pod <pod-name>
kubectl logs <pod-name> -c <container-name>

# Network troubleshooting
kubectl exec -it <pod-name> -- nslookup <service-name>
kubectl exec -it <pod-name> -- curl <service-url>
```

### Performance Tuning
```yaml
# Node-level optimizations
kubelet_config:
  maxPods: 110
  podsPerCore: 0
  cpuManagerPolicy: "static"
  memoryManagerPolicy: "Static"
  
# Cluster-level optimizations  
cluster_config:
  kube_api_burst: 100
  kube_api_qps: 50
  max_mutating_requests_inflight: 200
  max_requests_inflight: 400
```

## Cost Optimization

### Resource Right-sizing
- **VPA Recommendations**: Use VPA to optimize resource requests
- **Spot Instances**: Use spot instances for non-critical workloads
- **Cluster Autoscaler**: Scale nodes based on demand

### Cost Monitoring
```yaml
# Kubecost configuration
apiVersion: v1
kind: ConfigMap
metadata:
  name: kubecost-cost-model
data:
  kubecost-cost-model.yaml: |
    prometheus:
      enabled: true
    remoteWrite:
      enabled: true
    costModel:
      enabled: true
      pricing:
        provider: "aws"
        region: "us-east-1"
```

## Troubleshooting Guide

| Issue | Symptoms | Solution |
|-------|----------|----------|
| Pod stuck in Pending | `kubectl get pods` shows Pending | Check resource requests, node capacity |
| Service unreachable | Connection timeouts | Verify service endpoints, network policies |
| High memory usage | OOMKilled events | Increase memory limits, optimize application |
| Slow startup | Long readiness probe delays | Optimize application startup, adjust probes |
