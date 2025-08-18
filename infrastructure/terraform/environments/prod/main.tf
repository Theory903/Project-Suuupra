terraform {
  required_version = ">= 1.6.0"
  required_providers { aws = { source = "hashicorp/aws", version = "~> 5.0" } }
  backend "s3" {
    bucket         = "<YOUR_TF_STATE_BUCKET>"
    key            = "project-suuupra/prod/terraform.tfstate"
    region         = "<AWS_REGION>"
    dynamodb_table = "<YOUR_TF_LOCK_TABLE>"
    encrypt        = true
  }
}

provider "aws" { region = var.region }

module "vpc" {
  source          = "../../modules/vpc"
  name            = "suuupra-prod"
  cidr            = var.vpc_cidr
  azs             = var.azs
  public_subnets  = var.public_subnets
  private_subnets = var.private_subnets
}

module "eks" {
  source              = "../../modules/eks"
  cluster_name        = "suuupra-prod-eks"
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  public_subnet_ids   = module.vpc.public_subnet_ids
  node_instance_types = ["m5.xlarge"]
  desired_capacity    = 6
}

module "rds" {
  source                   = "../../modules/rds"
  name                     = "suuupra-prod-rds"
  engine_version           = "15.4"
  instance_class           = "db.r6g.4xlarge"
  vpc_id                   = module.vpc.vpc_id
  private_subnet_ids       = module.vpc.private_subnet_ids
  allowed_security_groups  = [module.eks.cluster_security_group_id]
  multi_az                 = true
  backup_retention_period  = 30
  backup_window           = "03:00-04:00"
  maintenance_window      = "sun:04:00-sun:05:00"
  deletion_protection     = true
  storage_encrypted       = true
  performance_insights_enabled = true
  monitoring_interval     = 60
  
  # Multiple databases for microservices
  databases = {
    identity = {
      db_name  = "identity_prod"
      username = "identity_user"
    }
    commerce = {
      db_name  = "commerce_prod"
      username = "commerce_user"
    }
    payments = {
      db_name  = "payments_prod"
      username = "payments_user"
    }
    analytics = {
      db_name  = "analytics_prod"
      username = "analytics_user"
    }
    ledger = {
      db_name  = "ledger_prod"
      username = "ledger_user"
    }
  }
}

# ElastiCache Redis Cluster
module "elasticache" {
  source                = "../../modules/elasticache"
  name                  = "suuupra-prod-redis"
  node_type            = "cache.r7g.2xlarge"
  num_cache_clusters   = 6
  port                 = 6379
  vpc_id               = module.vpc.vpc_id
  subnet_ids           = module.vpc.private_subnet_ids
  security_group_ids   = [module.eks.cluster_security_group_id]
  at_rest_encryption_enabled = true
  transit_encryption_enabled = true
  auth_token           = var.redis_auth_token
  automatic_failover_enabled = true
  multi_az_enabled     = true
}

# S3 Buckets for Content Storage
module "s3" {
  source = "../../modules/s3"
  
  buckets = {
    content = {
      name = "suuupra-prod-content"
      versioning = true
      lifecycle_rules = [
        {
          id = "content_lifecycle"
          transition_days = 30
          storage_class = "STANDARD_IA"
        }
      ]
    }
    backups = {
      name = "suuupra-prod-backups"
      versioning = true
      cross_region_replication = true
      destination_bucket = "suuupra-prod-backups-dr"
    }
    logs = {
      name = "suuupra-prod-logs"
      lifecycle_rules = [
        {
          id = "logs_lifecycle"
          expiration_days = 90
        }
      ]
    }
  }
}

# CloudFront Distribution
module "cloudfront" {
  source = "../../modules/cloudfront"
  
  origin_domain_name = module.s3.bucket_domain_names["content"]
  aliases = ["cdn.suuupra.com"]
  certificate_arn = var.ssl_certificate_arn
  
  cache_behaviors = [
    {
      path_pattern = "/api/*"
      origin_id = "api-gateway"
      target_origin_id = module.alb.dns_name
      ttl = 0
    },
    {
      path_pattern = "/static/*"
      origin_id = "s3-content"
      ttl = 86400
    }
  ]
}

# Application Load Balancer
module "alb" {
  source = "../../modules/alb"
  
  name = "suuupra-prod-alb"
  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.public_subnet_ids
  certificate_arn = var.ssl_certificate_arn
  
  target_groups = {
    api_gateway = {
      port = 3001
      protocol = "HTTP"
      health_check_path = "/health"
    }
  }
}

# Route53 DNS Configuration
module "route53" {
  source = "../../modules/route53"
  
  domain_name = "suuupra.com"
  
  records = {
    api = {
      name = "api"
      type = "A"
      alias = {
        name = module.alb.dns_name
        zone_id = module.alb.zone_id
      }
    }
    cdn = {
      name = "cdn"
      type = "A"
      alias = {
        name = module.cloudfront.domain_name
        zone_id = module.cloudfront.hosted_zone_id
      }
    }
  }
}

# Monitoring Infrastructure
module "monitoring" {
  source = "../../modules/monitoring"
  
  cluster_name = module.eks.cluster_name
  vpc_id = module.vpc.vpc_id
  subnet_ids = module.vpc.private_subnet_ids
  
  prometheus_config = {
    retention_period = "30d"
    storage_size = "500Gi"
    replicas = 2
  }
  
  grafana_config = {
    admin_password = var.grafana_admin_password
    domain = "grafana.suuupra.com"
  }
}

output "vpc_id" { value = module.vpc.vpc_id }
output "eks_cluster_name" { value = module.eks.cluster_name }
output "rds_endpoint" { value = module.rds.endpoint }
output "redis_endpoint" { value = module.elasticache.primary_endpoint }
output "alb_dns_name" { value = module.alb.dns_name }
output "cloudfront_domain" { value = module.cloudfront.domain_name }


