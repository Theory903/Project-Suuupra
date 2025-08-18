# Terraform Infrastructure as Code

## Overview

Infrastructure as Code (IaC) strategy using Terraform for managing cloud resources across multiple environments with state management, modular design, and automated deployment workflows.

## Project Structure

```text
terraform/
├── environments/
│   ├── dev/
│   │   ├── main.tf
│   │   ├── terraform.tfvars
│   │   └── backend.tf
│   ├── staging/
│   └── production/
├── modules/
│   ├── vpc/
│   ├── eks/
│   ├── rds/
│   ├── elasticache/
│   ├── s3/
│   └── monitoring/
├── global/
│   ├── s3-backend/
│   ├── route53/
│   └── iam/
└── scripts/
    ├── plan.sh
    ├── apply.sh
    └── destroy.sh
```

## State Management

### Remote State Configuration
```hcl
# environments/production/backend.tf
terraform {
  backend "s3" {
    bucket         = "suuupra-terraform-state-prod"
    key            = "production/terraform.tfstate"
    region         = "us-east-1"
    dynamodb_table = "suuupra-terraform-locks"
    encrypt        = true
    
    # Prevent accidental state deletion
    skip_region_validation      = false
    skip_credentials_validation = false
    skip_metadata_api_check     = false
  }
  
  required_version = ">= 1.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
    kubernetes = {
      source  = "hashicorp/kubernetes"
      version = "~> 2.0"
    }
    helm = {
      source  = "hashicorp/helm"
      version = "~> 2.0"
    }
  }
}
```

### State Locking
```hcl
# global/s3-backend/main.tf
resource "aws_s3_bucket" "terraform_state" {
  for_each = toset(["dev", "staging", "production"])
  
  bucket = "suuupra-terraform-state-${each.key}"
  
  tags = {
    Name        = "Terraform State - ${title(each.key)}"
    Environment = each.key
    Purpose     = "terraform-state"
  }
}

resource "aws_s3_bucket_versioning" "terraform_state" {
  for_each = aws_s3_bucket.terraform_state
  
  bucket = each.value.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "terraform_state" {
  for_each = aws_s3_bucket.terraform_state
  
  bucket = each.value.id
  
  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

resource "aws_dynamodb_table" "terraform_locks" {
  name           = "suuupra-terraform-locks"
  billing_mode   = "PAY_PER_REQUEST"
  hash_key       = "LockID"
  
  attribute {
    name = "LockID"
    type = "S"
  }
  
  tags = {
    Name = "Terraform State Lock Table"
  }
}
```

## Module Design

### VPC Module
```hcl
# modules/vpc/main.tf
resource "aws_vpc" "main" {
  cidr_block           = var.vpc_cidr
  enable_dns_hostnames = true
  enable_dns_support   = true
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-vpc"
  })
}

resource "aws_subnet" "private" {
  count = length(var.private_subnet_cidrs)
  
  vpc_id            = aws_vpc.main.id
  cidr_block        = var.private_subnet_cidrs[count.index]
  availability_zone = var.availability_zones[count.index]
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-private-${count.index + 1}"
    Type = "private"
    "kubernetes.io/role/internal-elb" = "1"
  })
}

resource "aws_subnet" "public" {
  count = length(var.public_subnet_cidrs)
  
  vpc_id                  = aws_vpc.main.id
  cidr_block              = var.public_subnet_cidrs[count.index]
  availability_zone       = var.availability_zones[count.index]
  map_public_ip_on_launch = true
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-public-${count.index + 1}"
    Type = "public"
    "kubernetes.io/role/elb" = "1"
  })
}

# Internet Gateway
resource "aws_internet_gateway" "main" {
  vpc_id = aws_vpc.main.id
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-igw"
  })
}

# NAT Gateways
resource "aws_eip" "nat" {
  count = length(var.public_subnet_cidrs)
  
  domain = "vpc"
  depends_on = [aws_internet_gateway.main]
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-eip-${count.index + 1}"
  })
}

resource "aws_nat_gateway" "main" {
  count = length(var.public_subnet_cidrs)
  
  allocation_id = aws_eip.nat[count.index].id
  subnet_id     = aws_subnet.public[count.index].id
  
  depends_on = [aws_internet_gateway.main]
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-nat-${count.index + 1}"
  })
}
```

```hcl
# modules/vpc/variables.tf
variable "name_prefix" {
  description = "Prefix for resource names"
  type        = string
}

variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "availability_zones" {
  description = "List of availability zones"
  type        = list(string)
}

variable "private_subnet_cidrs" {
  description = "CIDR blocks for private subnets"
  type        = list(string)
}

variable "public_subnet_cidrs" {
  description = "CIDR blocks for public subnets"
  type        = list(string)
}

variable "tags" {
  description = "Tags to apply to resources"
  type        = map(string)
  default     = {}
}
```

```hcl
# modules/vpc/outputs.tf
output "vpc_id" {
  description = "ID of the VPC"
  value       = aws_vpc.main.id
}

output "private_subnet_ids" {
  description = "IDs of private subnets"
  value       = aws_subnet.private[*].id
}

output "public_subnet_ids" {
  description = "IDs of public subnets"
  value       = aws_subnet.public[*].id
}

output "vpc_cidr_block" {
  description = "CIDR block of the VPC"
  value       = aws_vpc.main.cidr_block
}
```

### EKS Module
```hcl
# modules/eks/main.tf
resource "aws_eks_cluster" "main" {
  name     = var.cluster_name
  role_arn = aws_iam_role.cluster.arn
  version  = var.kubernetes_version
  
  vpc_config {
    subnet_ids              = var.subnet_ids
    endpoint_private_access = true
    endpoint_public_access  = true
    public_access_cidrs     = var.public_access_cidrs
    
    security_group_ids = [aws_security_group.cluster.id]
  }
  
  encryption_config {
    provider {
      key_arn = var.kms_key_arn
    }
    resources = ["secrets"]
  }
  
  enabled_cluster_log_types = [
    "api",
    "audit",
    "authenticator",
    "controllerManager",
    "scheduler"
  ]
  
  depends_on = [
    aws_iam_role_policy_attachment.cluster_AmazonEKSClusterPolicy,
    aws_cloudwatch_log_group.cluster,
  ]
  
  tags = var.tags
}

resource "aws_eks_node_group" "main" {
  for_each = var.node_groups
  
  cluster_name    = aws_eks_cluster.main.name
  node_group_name = each.key
  node_role_arn   = aws_iam_role.node_group.arn
  subnet_ids      = var.private_subnet_ids
  
  capacity_type  = each.value.capacity_type
  instance_types = each.value.instance_types
  ami_type       = each.value.ami_type
  disk_size      = each.value.disk_size
  
  scaling_config {
    desired_size = each.value.desired_size
    max_size     = each.value.max_size
    min_size     = each.value.min_size
  }
  
  update_config {
    max_unavailable_percentage = 25
  }
  
  # Taints for specialized node groups
  dynamic "taint" {
    for_each = each.value.taints
    content {
      key    = taint.value.key
      value  = taint.value.value
      effect = taint.value.effect
    }
  }
  
  labels = each.value.labels
  
  depends_on = [
    aws_iam_role_policy_attachment.node_group_AmazonEKSWorkerNodePolicy,
    aws_iam_role_policy_attachment.node_group_AmazonEKS_CNI_Policy,
    aws_iam_role_policy_attachment.node_group_AmazonEC2ContainerRegistryReadOnly,
  ]
  
  tags = merge(var.tags, {
    "kubernetes.io/cluster/${var.cluster_name}" = "owned"
  })
}

# IAM Roles
resource "aws_iam_role" "cluster" {
  name = "${var.cluster_name}-cluster-role"
  
  assume_role_policy = jsonencode({
    Statement = [{
      Action = "sts:AssumeRole"
      Effect = "Allow"
      Principal = {
        Service = "eks.amazonaws.com"
      }
    }]
    Version = "2012-10-17"
  })
}

resource "aws_iam_role_policy_attachment" "cluster_AmazonEKSClusterPolicy" {
  policy_arn = "arn:aws:iam::aws:policy/AmazonEKSClusterPolicy"
  role       = aws_iam_role.cluster.name
}
```

### RDS Module
```hcl
# modules/rds/main.tf
resource "aws_db_subnet_group" "main" {
  name       = "${var.name_prefix}-db-subnet-group"
  subnet_ids = var.subnet_ids
  
  tags = merge(var.tags, {
    Name = "${var.name_prefix}-db-subnet-group"
  })
}

resource "aws_db_parameter_group" "main" {
  family = var.parameter_group_family
  name   = "${var.name_prefix}-db-params"
  
  dynamic "parameter" {
    for_each = var.parameters
    content {
      name  = parameter.value.name
      value = parameter.value.value
    }
  }
  
  tags = var.tags
}

resource "aws_db_instance" "main" {
  identifier = var.db_identifier
  
  # Engine
  engine         = var.engine
  engine_version = var.engine_version
  instance_class = var.instance_class
  
  # Storage
  allocated_storage     = var.allocated_storage
  max_allocated_storage = var.max_allocated_storage
  storage_type          = var.storage_type
  storage_encrypted     = true
  kms_key_id           = var.kms_key_id
  
  # Database
  db_name  = var.database_name
  username = var.master_username
  password = var.master_password
  port     = var.port
  
  # Network
  db_subnet_group_name   = aws_db_subnet_group.main.name
  vpc_security_group_ids = var.security_group_ids
  publicly_accessible    = false
  
  # Backup
  backup_retention_period = var.backup_retention_period
  backup_window          = var.backup_window
  maintenance_window     = var.maintenance_window
  
  # Monitoring
  monitoring_interval = var.monitoring_interval
  monitoring_role_arn = var.monitoring_interval > 0 ? aws_iam_role.enhanced_monitoring[0].arn : null
  
  # Performance Insights
  performance_insights_enabled = var.performance_insights_enabled
  performance_insights_kms_key_id = var.performance_insights_enabled ? var.kms_key_id : null
  
  # Parameter group
  parameter_group_name = aws_db_parameter_group.main.name
  
  # Deletion protection
  deletion_protection = var.deletion_protection
  
  # Final snapshot
  skip_final_snapshot       = var.skip_final_snapshot
  final_snapshot_identifier = var.skip_final_snapshot ? null : "${var.db_identifier}-final-snapshot-${formatdate("YYYY-MM-DD-hhmm", timestamp())}"
  
  tags = merge(var.tags, {
    Name = var.db_identifier
  })
}

# Read replica for scaling reads
resource "aws_db_instance" "read_replica" {
  count = var.create_read_replica ? 1 : 0
  
  identifier = "${var.db_identifier}-read-replica"
  
  replicate_source_db = aws_db_instance.main.id
  instance_class      = var.replica_instance_class
  
  publicly_accessible = false
  
  tags = merge(var.tags, {
    Name = "${var.db_identifier}-read-replica"
  })
}
```

## Environment Configuration

### Development Environment
```hcl
# environments/dev/main.tf
module "vpc" {
  source = "../../modules/vpc"
  
  name_prefix = "suuupra-dev"
  vpc_cidr    = "10.0.0.0/16"
  
  availability_zones     = ["us-east-1a", "us-east-1b"]
  private_subnet_cidrs   = ["10.0.10.0/24", "10.0.20.0/24"]
  public_subnet_cidrs    = ["10.0.1.0/24", "10.0.2.0/24"]
  
  tags = local.common_tags
}

module "eks" {
  source = "../../modules/eks"
  
  cluster_name       = "suuupra-dev"
  kubernetes_version = "1.28"
  
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  public_access_cidrs = ["0.0.0.0/0"]  # Restrict in production
  
  node_groups = {
    general = {
      capacity_type   = "SPOT"
      instance_types  = ["t3.medium", "t3.large"]
      ami_type       = "AL2_x86_64"
      disk_size      = 50
      
      desired_size = 2
      max_size     = 5
      min_size     = 1
      
      taints = []
      labels = {
        role = "general"
      }
    }
  }
  
  tags = local.common_tags
}

module "rds_postgres" {
  source = "../../modules/rds"
  
  name_prefix    = "suuupra-dev"
  db_identifier  = "suuupra-dev-postgres"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.t3.micro"
  
  allocated_storage = 20
  storage_type     = "gp2"
  
  database_name    = "suuupra"
  master_username  = "suuupra"
  master_password  = var.db_password
  
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [aws_security_group.rds.id]
  
  backup_retention_period = 7
  deletion_protection    = false
  
  tags = local.common_tags
}
```

```hcl
# environments/dev/terraform.tfvars
# Database
db_password = "dev-password-change-me"

# Common tags
common_tags = {
  Environment = "development"
  Project     = "suuupra"
  ManagedBy   = "terraform"
  Owner       = "platform-team"
}
```

### Production Environment
```hcl
# environments/production/main.tf
module "vpc" {
  source = "../../modules/vpc"
  
  name_prefix = "suuupra-prod"
  vpc_cidr    = "10.1.0.0/16"
  
  availability_zones     = ["us-east-1a", "us-east-1b", "us-east-1c"]
  private_subnet_cidrs   = ["10.1.10.0/24", "10.1.20.0/24", "10.1.30.0/24"]
  public_subnet_cidrs    = ["10.1.1.0/24", "10.1.2.0/24", "10.1.3.0/24"]
  
  tags = local.common_tags
}

module "eks" {
  source = "../../modules/eks"
  
  cluster_name       = "suuupra-prod"
  kubernetes_version = "1.28"
  
  vpc_id             = module.vpc.vpc_id
  subnet_ids         = module.vpc.private_subnet_ids
  public_access_cidrs = var.office_cidrs  # Restricted access
  
  node_groups = {
    system = {
      capacity_type   = "ON_DEMAND"
      instance_types  = ["m5.large"]
      ami_type       = "AL2_x86_64"
      disk_size      = 100
      
      desired_size = 3
      max_size     = 6
      min_size     = 3
      
      taints = [{
        key    = "CriticalAddonsOnly"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
      labels = {
        role = "system"
      }
    }
    
    application = {
      capacity_type   = "ON_DEMAND"
      instance_types  = ["m5.xlarge"]
      ami_type       = "AL2_x86_64"
      disk_size      = 100
      
      desired_size = 5
      max_size     = 50
      min_size     = 5
      
      taints = []
      labels = {
        role = "application"
      }
    }
    
    compute = {
      capacity_type   = "ON_DEMAND"
      instance_types  = ["c5.2xlarge"]
      ami_type       = "AL2_x86_64"
      disk_size      = 100
      
      desired_size = 2
      max_size     = 20
      min_size     = 0
      
      taints = [{
        key    = "compute-intensive"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
      labels = {
        role = "compute"
      }
    }
  }
  
  tags = local.common_tags
}

# Multi-AZ RDS with read replicas
module "rds_postgres" {
  source = "../../modules/rds"
  
  name_prefix    = "suuupra-prod"
  db_identifier  = "suuupra-prod-postgres"
  
  engine         = "postgres"
  engine_version = "15.4"
  instance_class = "db.r5.xlarge"
  
  allocated_storage     = 500
  max_allocated_storage = 1000
  storage_type         = "gp3"
  
  database_name    = "suuupra"
  master_username  = "suuupra"
  master_password  = var.db_password
  
  subnet_ids         = module.vpc.private_subnet_ids
  security_group_ids = [aws_security_group.rds.id]
  
  backup_retention_period = 30
  deletion_protection    = true
  
  create_read_replica      = true
  replica_instance_class   = "db.r5.large"
  
  performance_insights_enabled = true
  monitoring_interval         = 60
  
  tags = local.common_tags
}
```

## Automation Scripts

### Plan Script
```bash
#!/bin/bash
# scripts/plan.sh

set -e

ENVIRONMENT=$1
if [ -z "$ENVIRONMENT" ]; then
    echo "Usage: $0 <environment>"
    echo "Available environments: dev, staging, production"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../environments/$ENVIRONMENT"

if [ ! -d "$TERRAFORM_DIR" ]; then
    echo "Environment directory not found: $TERRAFORM_DIR"
    exit 1
fi

cd "$TERRAFORM_DIR"

echo "Planning Terraform changes for environment: $ENVIRONMENT"
echo "Working directory: $(pwd)"

# Initialize Terraform
terraform init -upgrade

# Validate configuration
terraform validate

# Format code
terraform fmt -recursive

# Plan changes
terraform plan \
    -var-file="terraform.tfvars" \
    -out="tfplan-$(date +%Y%m%d-%H%M%S)" \
    -detailed-exitcode

echo "Plan completed for environment: $ENVIRONMENT"
```

### Apply Script
```bash
#!/bin/bash
# scripts/apply.sh

set -e

ENVIRONMENT=$1
PLAN_FILE=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$PLAN_FILE" ]; then
    echo "Usage: $0 <environment> <plan_file>"
    exit 1
fi

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TERRAFORM_DIR="$SCRIPT_DIR/../environments/$ENVIRONMENT"

cd "$TERRAFORM_DIR"

if [ ! -f "$PLAN_FILE" ]; then
    echo "Plan file not found: $PLAN_FILE"
    exit 1
fi

echo "Applying Terraform plan for environment: $ENVIRONMENT"
echo "Plan file: $PLAN_FILE"

# Confirm before applying in production
if [ "$ENVIRONMENT" = "production" ]; then
    echo "WARNING: You are about to apply changes to PRODUCTION!"
    read -p "Are you sure? (yes/no): " -r
    if [[ ! $REPLY =~ ^yes$ ]]; then
        echo "Aborted."
        exit 1
    fi
fi

# Apply the plan
terraform apply "$PLAN_FILE"

echo "Apply completed for environment: $ENVIRONMENT"
```

## CI/CD Integration

### GitHub Actions Workflow
```yaml
# .github/workflows/terraform.yml
name: Terraform

on:
  push:
    branches: [main, develop]
    paths: ['terraform/**']
  pull_request:
    branches: [main]
    paths: ['terraform/**']

env:
  TF_VERSION: "1.5.0"
  AWS_REGION: "us-east-1"

jobs:
  terraform:
    name: Terraform
    runs-on: ubuntu-latest
    
    strategy:
      matrix:
        environment: [dev, staging, production]
    
    steps:
    - name: Checkout
      uses: actions/checkout@v3
    
    - name: Setup Terraform
      uses: hashicorp/setup-terraform@v2
      with:
        terraform_version: ${{ env.TF_VERSION }}
    
    - name: Configure AWS Credentials
      uses: aws-actions/configure-aws-credentials@v2
      with:
        role-to-assume: ${{ secrets.AWS_ROLE_ARN }}
        aws-region: ${{ env.AWS_REGION }}
    
    - name: Terraform Init
      working-directory: terraform/environments/${{ matrix.environment }}
      run: terraform init
    
    - name: Terraform Validate
      working-directory: terraform/environments/${{ matrix.environment }}
      run: terraform validate
    
    - name: Terraform Format Check
      working-directory: terraform/environments/${{ matrix.environment }}
      run: terraform fmt -check -recursive
    
    - name: Terraform Plan
      working-directory: terraform/environments/${{ matrix.environment }}
      run: |
        terraform plan \
          -var-file="terraform.tfvars" \
          -out="tfplan" \
          -no-color
    
    - name: Terraform Apply (Production)
      if: github.ref == 'refs/heads/main' && matrix.environment == 'production'
      working-directory: terraform/environments/${{ matrix.environment }}
      run: terraform apply -auto-approve tfplan
```

## Security Best Practices

### Sensitive Data Management
```hcl
# Use AWS Secrets Manager for sensitive values
data "aws_secretsmanager_secret_version" "db_password" {
  secret_id = "suuupra/${var.environment}/database/password"
}

locals {
  db_password = jsondecode(data.aws_secretsmanager_secret_version.db_password.secret_string)["password"]
}

# Use random passwords with proper lifecycle
resource "random_password" "db_password" {
  length  = 32
  special = true
  
  lifecycle {
    ignore_changes = [length, special]
  }
}

resource "aws_secretsmanager_secret" "db_password" {
  name = "suuupra/${var.environment}/database/password"
  
  lifecycle {
    prevent_destroy = true
  }
}
```

### Resource Tagging Strategy
```hcl
# locals.tf
locals {
  common_tags = {
    Environment = var.environment
    Project     = "suuupra"
    ManagedBy   = "terraform"
    Owner       = var.team_name
    CostCenter  = var.cost_center
    Backup      = var.backup_required ? "required" : "not-required"
  }
  
  # Merge with resource-specific tags
  resource_tags = merge(local.common_tags, var.additional_tags)
}
```

## Cost Optimization

### Resource Scheduling
```hcl
# Auto-scaling for non-production environments
resource "aws_autoscaling_schedule" "scale_down_evening" {
  count = var.environment != "production" ? 1 : 0
  
  scheduled_action_name  = "scale-down-evening"
  min_size               = 0
  max_size               = 0
  desired_capacity       = 0
  recurrence            = "0 20 * * MON-FRI"  # 8 PM weekdays
  autoscaling_group_name = aws_autoscaling_group.workers.name
}

resource "aws_autoscaling_schedule" "scale_up_morning" {
  count = var.environment != "production" ? 1 : 0
  
  scheduled_action_name  = "scale-up-morning"
  min_size               = var.min_size
  max_size               = var.max_size
  desired_capacity       = var.desired_size
  recurrence            = "0 8 * * MON-FRI"   # 8 AM weekdays
  autoscaling_group_name = aws_autoscaling_group.workers.name
}
```

## Troubleshooting

### Common Issues and Solutions

| Issue | Cause | Solution |
|-------|-------|----------|
| State lock error | Concurrent operations | Check DynamoDB table, force unlock if needed |
| Module not found | Incorrect source path | Verify module source path and version |
| Provider version conflict | Version constraints mismatch | Update required_providers block |
| Resource already exists | Import needed | Use terraform import command |
| Permission denied | Insufficient IAM permissions | Check and update IAM policies |

### Useful Commands
```bash
# Import existing resource
terraform import aws_instance.example i-1234567890abcdef0

# Force unlock state
terraform force-unlock <lock-id>

# Show current state
terraform show

# List resources in state
terraform state list

# Remove resource from state
terraform state rm aws_instance.example

# Refresh state
terraform refresh

# Validate configuration
terraform validate

# Check formatting
terraform fmt -check -recursive
```
