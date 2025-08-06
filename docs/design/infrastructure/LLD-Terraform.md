# Low-Level Design: Terraform Infrastructure as Code

## 1. 🎯 Overview

This document details our strategy for managing infrastructure using Terraform. We follow an Infrastructure as Code (IaC) approach to ensure our infrastructure is version-controlled, repeatable, and auditable.

### 1.1. Learning Objectives

-   Understand how to structure a large Terraform project.
-   Learn about Terraform modules for reusability.
-   Implement remote state management and locking.
-   Design a promotion workflow for moving changes from staging to production.

---

## 2. 🏗️ Project Structure

Our Terraform project is structured to support multiple environments and services.

```
terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   └── terraform.tfvars
│   ├── staging/
│   └── production/
├── modules/
│   ├── vpc/
│   ├── eks/
│   ├── rds/
│   └── ...
└── global/
    └── s3_backend.tf
```

-   **`environments`**: Contains the root configurations for each environment (dev, staging, production).
-   **`modules`**: Contains reusable Terraform modules for creating our infrastructure components (VPC, EKS cluster, etc.).
-   **`global`**: Contains global resources like the S3 bucket for our Terraform state.

---

## 3. 🔄 State Management

We use an **S3 backend** for storing our Terraform state.

**Why S3?**
-   **Remote State**: It allows multiple team members to work on the same infrastructure.
-   **State Locking**: We use DynamoDB for state locking to prevent concurrent modifications to our infrastructure.
-   **Versioning**: S3's versioning feature provides a history of our state files.

**`global/s3_backend.tf`**:
```terraform
terraform {
  backend "s3" {
    bucket         = "suuupra-terraform-state"
    key            = "global/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "suuupra-terraform-locks"
    encrypt        = true
  }
}
```

---

## 4. 🚀 Environment Promotion

We use a Git-based workflow for promoting changes from staging to production.

1.  **Staging**: Changes are first applied to the `staging` environment.
2.  **Testing**: We run a suite of automated tests against the `staging` environment to verify the changes.
3.  **Production**: Once the changes are verified, we promote them to the `production` environment by merging the changes from the `staging` branch to the `main` branch in our infrastructure repository.

---

## 5. 📦 Module Design

We create reusable Terraform modules for our infrastructure components to ensure consistency and reduce code duplication.

**Example VPC Module**:
```terraform
# modules/vpc/main.tf
resource "aws_vpc" "main" {
  cidr_block = var.cidr_block
  # ...
}

# environments/staging/main.tf
module "vpc" {
  source     = "../../modules/vpc"
  cidr_block = "10.0.0.0/16"
}
```
