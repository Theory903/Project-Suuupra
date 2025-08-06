# Low-Level Design: Kubernetes Architecture

## 1. 🎯 Overview

This document provides a detailed low-level design of our Kubernetes architecture on Amazon EKS. It covers cluster setup, node group configuration, networking, security, and resource management.

### 1.1. Learning Objectives

-   Understand how to configure a production-grade EKS cluster.
-   Learn about different node group types and their use cases.
-   Gain insights into Kubernetes networking with the AWS VPC CNI.
-   Implement security best practices with network policies and RBAC.

---

## 2. 🏗️ EKS Cluster Configuration

Our EKS cluster is defined using Terraform for an Infrastructure as Code (IaC) approach.

### 2.1. Cluster-Level Settings

-   **Kubernetes Version**: 1.28 (We will follow a strategy of upgrading one minor version at a time, with thorough testing in staging).
-   **VPC & Subnets**: The cluster is deployed in a dedicated VPC with private subnets for worker nodes and public subnets for load balancers.
-   **Networking**: We use the AWS VPC CNI plugin, which assigns a VPC IP address to each pod, providing native VPC networking performance.

### 2.2. Node Group Strategy

We use multiple node groups to optimize for cost and performance:

-   **`system-nodes`**: For critical Kubernetes components like the Kubernetes control plane, CoreDNS, etc. Taints are used to ensure that only system pods are scheduled on these nodes.
-   **`application-nodes`**: For our general-purpose microservices.
-   **`compute-intensive`**: For CPU-bound workloads like ML inference, using `c5` instance types.
-   **`memory-intensive`**: For memory-bound workloads like our analytics services, using `r5` instance types.

---

## 3. 🌐 Networking

### 3.1. AWS VPC CNI

The AWS VPC CNI plugin allows pods to have their own IP address from the VPC, which simplifies networking and provides better performance.

### 3.2. Network Policies

We use Calico as our network policy engine to enforce fine-grained network policies between our services.

**Why Calico?**
-   It provides a rich set of features for network policy enforcement.
-   It integrates well with Istio.

**Default Network Policy**:
By default, all ingress and egress traffic is denied. Each service must explicitly declare which other services it can communicate with.

```yaml
apiVersion: networking.k8s.io/v1
kind: NetworkPolicy
metadata:
  name: default-deny-all
spec:
  podSelector: {}
  policyTypes:
  - Ingress
  - Egress
```

---

## 4. 🔒 Security

### 4.1. RBAC (Role-Based Access Control)

We use Kubernetes RBAC to control access to the Kubernetes API. We follow the principle of least privilege, granting users and services only the permissions they need.

### 4.2. Pod Security Standards

We enforce the `restricted` Pod Security Standard by default, which is the most restrictive standard.

### 4.3. Container Security

-   **Image Scanning**: We use Grype to scan our container images for vulnerabilities in our CI/CD pipeline.
-   **Runtime Security**: We use Falco to detect and alert on suspicious activity at runtime.

---

## 5. 📈 Resource Management

### 5.1. Resource Requests and Limits

All pods must have resource requests and limits defined to ensure that they have the resources they need and to prevent them from consuming too many resources.

### 5.2. Quality of Service (QoS)

-   **Guaranteed**: For critical system components and stateful services.
-   **Burstable**: For our general-purpose microservices.
-   **BestEffort**: For non-critical batch jobs.
