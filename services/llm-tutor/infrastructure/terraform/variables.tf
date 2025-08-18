# LLM Tutor Service - Terraform Variables
# Configuration variables for infrastructure deployment

variable "aws_region" {
  description = "AWS region for all resources"
  type        = string
  default     = "us-west-2"
}

variable "project_name" {
  description = "Name of the project"
  type        = string
  default     = "llm-tutor"
}

variable "environment" {
  description = "Environment name (development, staging, production)"
  type        = string
  
  validation {
    condition     = contains(["development", "staging", "production"], var.environment)
    error_message = "Environment must be development, staging, or production."
  }
}

# VPC Configuration
variable "vpc_cidr" {
  description = "CIDR block for VPC"
  type        = string
  default     = "10.0.0.0/16"
}

variable "private_subnets" {
  description = "Private subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.1.0/24", "10.0.2.0/24", "10.0.3.0/24"]
}

variable "public_subnets" {
  description = "Public subnet CIDR blocks"
  type        = list(string)
  default     = ["10.0.101.0/24", "10.0.102.0/24", "10.0.103.0/24"]
}

# EKS Configuration
variable "kubernetes_version" {
  description = "Kubernetes version for EKS cluster"
  type        = string
  default     = "1.28"
}

variable "cluster_endpoint_public_access_cidrs" {
  description = "List of CIDR blocks that can access the Amazon EKS public API server endpoint"
  type        = list(string)
  default     = ["0.0.0.0/0"]
}

# General Node Group
variable "general_instance_types" {
  description = "Instance types for general node group"
  type        = list(string)
  default     = ["t3.medium", "t3.large"]
}

variable "general_min_size" {
  description = "Minimum number of nodes in general node group"
  type        = number
  default     = 1
}

variable "general_max_size" {
  description = "Maximum number of nodes in general node group"
  type        = number
  default     = 10
}

variable "general_desired_size" {
  description = "Desired number of nodes in general node group"
  type        = number
  default     = 3
}

# GPU Node Group
variable "gpu_instance_types" {
  description = "Instance types for GPU node group"
  type        = list(string)
  default     = ["g4dn.xlarge", "g4dn.2xlarge"]
}

variable "gpu_min_size" {
  description = "Minimum number of nodes in GPU node group"
  type        = number
  default     = 0
}

variable "gpu_max_size" {
  description = "Maximum number of nodes in GPU node group"
  type        = number
  default     = 5
}

variable "gpu_desired_size" {
  description = "Desired number of nodes in GPU node group"
  type        = number
  default     = 1
}

# Database Configuration
variable "postgres_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "15.4"
}

variable "postgres_instance_class" {
  description = "Instance class for PostgreSQL database"
  type        = string
  default     = "db.t3.micro"
}

variable "postgres_allocated_storage" {
  description = "Allocated storage for PostgreSQL database (GB)"
  type        = number
  default     = 20
}

variable "postgres_max_allocated_storage" {
  description = "Maximum allocated storage for PostgreSQL database (GB)"
  type        = number
  default     = 100
}

variable "postgres_database" {
  description = "Name of the PostgreSQL database"
  type        = string
  default     = "llm_tutor"
}

variable "postgres_username" {
  description = "Username for PostgreSQL database"
  type        = string
  default     = "llm_tutor"
}

variable "postgres_password" {
  description = "Password for PostgreSQL database"
  type        = string
  sensitive   = true
}

variable "postgres_backup_retention_period" {
  description = "Backup retention period for PostgreSQL database (days)"
  type        = number
  default     = 7
}

# Redis Configuration
variable "redis_node_type" {
  description = "Node type for Redis cache"
  type        = string
  default     = "cache.t3.micro"
}

variable "redis_num_cache_nodes" {
  description = "Number of cache nodes for Redis"
  type        = number
  default     = 2
}

# Logging Configuration
variable "log_retention_days" {
  description = "CloudWatch log retention period (days)"
  type        = number
  default     = 14
}

# AWS Auth Configuration
variable "aws_auth_users" {
  description = "List of users to add to aws-auth ConfigMap"
  type = list(object({
    userarn  = string
    username = string
    groups   = list(string)
  }))
  default = []
}

variable "aws_auth_roles" {
  description = "List of roles to add to aws-auth ConfigMap"
  type = list(object({
    rolearn  = string
    username = string
    groups   = list(string)
  }))
  default = []
}

# Environment-specific configurations
locals {
  environment_configs = {
    development = {
      postgres_instance_class         = "db.t3.micro"
      postgres_allocated_storage      = 20
      postgres_backup_retention_period = 1
      redis_node_type                 = "cache.t3.micro"
      redis_num_cache_nodes          = 1
      general_min_size               = 1
      general_max_size               = 3
      general_desired_size           = 1
      gpu_min_size                   = 0
      gpu_max_size                   = 2
      gpu_desired_size               = 0
      log_retention_days             = 3
    }
    
    staging = {
      postgres_instance_class         = "db.t3.small"
      postgres_allocated_storage      = 50
      postgres_backup_retention_period = 3
      redis_node_type                 = "cache.t3.small"
      redis_num_cache_nodes          = 2
      general_min_size               = 2
      general_max_size               = 5
      general_desired_size           = 2
      gpu_min_size                   = 0
      gpu_max_size                   = 3
      gpu_desired_size               = 1
      log_retention_days             = 7
    }
    
    production = {
      postgres_instance_class         = "db.r5.large"
      postgres_allocated_storage      = 100
      postgres_backup_retention_period = 30
      redis_node_type                 = "cache.r5.large"
      redis_num_cache_nodes          = 3
      general_min_size               = 3
      general_max_size               = 10
      general_desired_size           = 5
      gpu_min_size                   = 1
      gpu_max_size                   = 5
      gpu_desired_size               = 2
      log_retention_days             = 90
    }
  }
}

# Override defaults with environment-specific values
locals {
  config = local.environment_configs[var.environment]
  
  # Final computed values
  final_postgres_instance_class         = lookup(local.config, "postgres_instance_class", var.postgres_instance_class)
  final_postgres_allocated_storage      = lookup(local.config, "postgres_allocated_storage", var.postgres_allocated_storage)
  final_postgres_backup_retention_period = lookup(local.config, "postgres_backup_retention_period", var.postgres_backup_retention_period)
  final_redis_node_type                 = lookup(local.config, "redis_node_type", var.redis_node_type)
  final_redis_num_cache_nodes          = lookup(local.config, "redis_num_cache_nodes", var.redis_num_cache_nodes)
  final_general_min_size               = lookup(local.config, "general_min_size", var.general_min_size)
  final_general_max_size               = lookup(local.config, "general_max_size", var.general_max_size)
  final_general_desired_size           = lookup(local.config, "general_desired_size", var.general_desired_size)
  final_gpu_min_size                   = lookup(local.config, "gpu_min_size", var.gpu_min_size)
  final_gpu_max_size                   = lookup(local.config, "gpu_max_size", var.gpu_max_size)
  final_gpu_desired_size               = lookup(local.config, "gpu_desired_size", var.gpu_desired_size)
  final_log_retention_days             = lookup(local.config, "log_retention_days", var.log_retention_days)
}