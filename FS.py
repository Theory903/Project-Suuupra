#!/usr/bin/env python3

import os

def create_file(path, content=""):
    os.makedirs(os.path.dirname(path), exist_ok=True)
    with open(path, 'w') as f:
        f.write(content)

def create_dir(path):
    os.makedirs(path, exist_ok=True)

project_root = "suuupra-edtech-platform"
services = ["gateway", "identity", "content", "commerce", "payments", "ledger", "live-classes", "vod", "mass-live", "creator-studio", "recommendations", "search-crawler", "llm-tutor", "analytics", "counters", "live-tracking", "notifications", "admin"]

create_dir(project_root)

for service in services:
    base_path = f"{project_root}/services/{service}"
    create_dir(f"{base_path}/src/main")
    create_dir(f"{base_path}/src/test/unit")
    create_dir(f"{base_path}/src/test/integration")
    create_dir(f"{base_path}/src/test/fixtures")
    create_dir(f"{base_path}/src/api")
    create_dir(f"{base_path}/infrastructure/k8s/base")
    create_dir(f"{base_path}/infrastructure/k8s/overlays/dev")
    create_dir(f"{base_path}/infrastructure/k8s/overlays/staging")
    create_dir(f"{base_path}/infrastructure/k8s/overlays/prod")
    create_dir(f"{base_path}/infrastructure/terraform")
    create_dir(f"{base_path}/infrastructure/monitoring")
    create_dir(f"{base_path}/infrastructure/configs")
    create_dir(f"{base_path}/scripts")
    create_dir(f"{base_path}/docs/ADR")
    create_dir(f"{base_path}/migrations")
    create_dir(f"{base_path}/tests/unit")
    create_dir(f"{base_path}/tests/integration")
    create_dir(f"{base_path}/tests/load/k6")
    create_file(f"{base_path}/Dockerfile")
    create_file(f"{base_path}/docker-compose.yml")
    create_file(f"{base_path}/.env.example")
    create_file(f"{base_path}/README.md")
    create_file(f"{base_path}/src/api/openapi.yaml")
    create_file(f"{base_path}/scripts/build.sh")
    create_file(f"{base_path}/scripts/test.sh")
    create_file(f"{base_path}/scripts/deploy.sh")
    create_file(f"{base_path}/scripts/migrate.sh")

create_dir(f"{project_root}/infrastructure/kubernetes/namespaces")
create_dir(f"{project_root}/infrastructure/kubernetes/istio")
create_dir(f"{project_root}/infrastructure/kubernetes/monitoring")
create_dir(f"{project_root}/infrastructure/kubernetes/logging")
create_dir(f"{project_root}/infrastructure/kubernetes/security")
create_dir(f"{project_root}/infrastructure/kubernetes/apps/base")
create_dir(f"{project_root}/infrastructure/kubernetes/apps/overlays/dev")
create_dir(f"{project_root}/infrastructure/kubernetes/apps/overlays/staging")
create_dir(f"{project_root}/infrastructure/kubernetes/apps/overlays/prod")

create_dir(f"{project_root}/infrastructure/terraform/modules/eks")
create_dir(f"{project_root}/infrastructure/terraform/modules/rds")
create_dir(f"{project_root}/infrastructure/terraform/modules/vpc")
create_dir(f"{project_root}/infrastructure/terraform/modules/monitoring")
create_dir(f"{project_root}/infrastructure/terraform/environments/dev")
create_dir(f"{project_root}/infrastructure/terraform/environments/staging")
create_dir(f"{project_root}/infrastructure/terraform/environments/prod")
create_dir(f"{project_root}/infrastructure/terraform/global")

create_dir(f"{project_root}/infrastructure/monitoring/grafana/dashboards")
create_dir(f"{project_root}/infrastructure/monitoring/grafana/alerts")
create_dir(f"{project_root}/infrastructure/monitoring/prometheus")
create_dir(f"{project_root}/infrastructure/monitoring/jaeger")

create_dir(f"{project_root}/infrastructure/security/policies")
create_dir(f"{project_root}/infrastructure/security/secrets")
create_dir(f"{project_root}/infrastructure/security/certificates")

create_dir(f"{project_root}/infrastructure/scripts")
create_file(f"{project_root}/infrastructure/scripts/setup-cluster.sh")
create_file(f"{project_root}/infrastructure/scripts/backup.sh")
create_file(f"{project_root}/infrastructure/scripts/disaster-recovery.sh")

create_dir(f"{project_root}/shared/proto/common")
create_dir(f"{project_root}/shared/proto/events")
create_dir(f"{project_root}/shared/proto/services")

create_dir(f"{project_root}/shared/events/schemas")
create_dir(f"{project_root}/shared/events/contracts")
create_dir(f"{project_root}/shared/events/registry")

create_dir(f"{project_root}/shared/libs/go/auth")
create_dir(f"{project_root}/shared/libs/go/logging")
create_dir(f"{project_root}/shared/libs/go/metrics")
create_dir(f"{project_root}/shared/libs/go/tracing")
create_dir(f"{project_root}/shared/libs/go/errors")

create_dir(f"{project_root}/shared/libs/java/security")
create_dir(f"{project_root}/shared/libs/java/database")
create_dir(f"{project_root}/shared/libs/java/messaging")

create_dir(f"{project_root}/shared/libs/node/middleware")
create_dir(f"{project_root}/shared/libs/node/validation")
create_dir(f"{project_root}/shared/libs/node/clients")

create_dir(f"{project_root}/shared/libs/python/ml")
create_dir(f"{project_root}/shared/libs/python/data")
create_dir(f"{project_root}/shared/libs/python/api")

create_dir(f"{project_root}/shared/templates/service-template-go")
create_dir(f"{project_root}/shared/templates/service-template-java")
create_dir(f"{project_root}/shared/templates/service-template-node")
create_dir(f"{project_root}/shared/templates/service-template-python")

create_dir(f"{project_root}/tools/scripts")
create_dir(f"{project_root}/tools/testing")
create_dir(f"{project_root}/tools/generators")

create_dir(f"{project_root}/docs/architecture")
create_dir(f"{project_root}/docs/apis")
create_dir(f"{project_root}/docs/runbooks")

create_file(f"{project_root}/docker-compose.yml")
create_file(f"{project_root}/README.md")
create_file(f"{project_root}/.gitignore")
create_file(f"{project_root}/tools/scripts/initialize-project.sh")
create_file(f"{project_root}/tools/scripts/generate-service.sh")

special_files = {
    "gateway": ["package.json"],
    "identity": ["pom.xml"],
    "content": ["package.json"],
    "commerce": ["requirements.txt"],
    "payments": ["go.mod"],
    "ledger": ["pom.xml"],
    "live-classes": ["package.json"],
    "vod": ["package.json"],
    "mass-live": ["go.mod"],
    "creator-studio": ["package.json"],
    "recommendations": ["requirements.txt"],
    "search-crawler": ["go.mod"],
    "llm-tutor": ["requirements.txt"],
    "analytics": ["requirements.txt"],
    "counters": ["go.mod"],
    "live-tracking": ["go.mod", "Cargo.toml"],
    "notifications": ["requirements.txt"],
    "admin": ["package.json"]
}

for service, files in special_files.items():
    for file in files:
        create_file(f"{project_root}/services/{service}/{file}")

print(f"✅ Project structure created at {project_root}")
