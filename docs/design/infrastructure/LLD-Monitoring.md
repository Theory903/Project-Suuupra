# Low-Level Design: Monitoring & Observability

## 1. 🎯 Overview

This document details our monitoring and observability stack. Our goal is to have deep visibility into the health and performance of our systems, so we can detect and diagnose issues before they impact our users.

### 1.1. Learning Objectives

-   Understand the three pillars of observability: metrics, logs, and traces.
-   Learn how to set up and configure Prometheus, Grafana, the ELK Stack, and Jaeger.
-   Design effective monitoring dashboards and alerting rules.

---

## 2. 📊 Metrics: Prometheus & Grafana

We use **Prometheus** for collecting time-series metrics and **Grafana** for visualization.

### 2.1. Prometheus Configuration

-   **ServiceMonitors**: We use the Prometheus Operator to automatically discover and scrape metrics from our services using `ServiceMonitor` custom resources.
-   **Alerting**: We define our alerting rules in `PrometheusRule` custom resources and use the **Alertmanager** to route alerts to PagerDuty and Slack.

### 2.2. Grafana Dashboards

We create Grafana dashboards for each of our services, as well as high-level dashboards for our key business metrics.

**Example Dashboard Panels**:
-   **Latency**: p99, p95, and p50 latency for each API endpoint.
-   **Throughput**: Requests per second for each service.
-   **Error Rate**: Percentage of failed requests.
-   **Saturation**: CPU, memory, and disk utilization.

---

## 3. 📝 Logging: ELK Stack

We use the **ELK Stack (Elasticsearch, Logstash, Kibana)** for centralized logging.

### 3.1. Logging Pipeline

1.  **Fluentd**: We use Fluentd as a DaemonSet on our Kubernetes nodes to collect logs from all our pods.
2.  **Logstash**: Fluentd forwards the logs to Logstash, which parses and enriches them.
3.  **Elasticsearch**: Logstash stores the processed logs in Elasticsearch.
4.  **Kibana**: We use Kibana to search, analyze, and visualize our logs.

### 3.2. Structured Logging

All our services log in a structured JSON format to make the logs easy to parse and analyze. We include a **correlation ID** in every log message to trace requests across services.

---

## 4. ιχνη (Traces): Jaeger

We use **Jaeger** for distributed tracing.

### 4.1. OpenTelemetry

All our services are instrumented with **OpenTelemetry** to generate traces.

**Why OpenTelemetry?**
-   It is an open standard, vendor-neutral way to instrument our applications.
-   It provides libraries for all the languages we use.

### 4.2. Jaeger Architecture

-   **Jaeger Agent**: Runs as a sidecar to our application pods and receives spans from the OpenTelemetry SDK.
-   **Jaeger Collector**: Receives spans from the agents and stores them in Elasticsearch.
-   **Jaeger Query**: Provides a UI for querying and visualizing traces.
