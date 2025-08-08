terraform {
  required_version = ">= 1.6.0"
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
  backend "s3" {
    bucket         = "<YOUR_TF_STATE_BUCKET>"
    key            = "project-suuupra/dev/terraform.tfstate"
    region         = "<AWS_REGION>"
    dynamodb_table = "<YOUR_TF_LOCK_TABLE>"
    encrypt        = true
  }
}

provider "aws" {
  region = var.region
}

module "vpc" {
  source = "../../modules/vpc"
  name   = "suuupra-dev"
  cidr   = var.vpc_cidr
  azs    = var.azs
}

module "eks" {
  source              = "../../modules/eks"
  cluster_name        = "suuupra-dev-eks"
  vpc_id              = module.vpc.vpc_id
  private_subnet_ids  = module.vpc.private_subnet_ids
  public_subnet_ids   = module.vpc.public_subnet_ids
  node_instance_types = ["t3.large"]
  desired_capacity    = 3
}

module "rds" {
  source                = "../../modules/rds"
  name                  = "suuupra-dev-rds"
  engine_version        = "15"
  instance_class        = "db.t3.medium"
  vpc_id                = module.vpc.vpc_id
  private_subnet_ids    = module.vpc.private_subnet_ids
  allowed_security_groups = [module.eks.cluster_security_group_id]
  multi_az              = true
}

module "redis" {
  source               = "../../modules/monitoring" # replace with dedicated redis module if available
  # placeholder: use ElastiCache module when present
}

module "kms" {
  source      = "../../modules/monitoring" # placeholder: swap with kms module when available
}

output "vpc_id" {
  value = module.vpc.vpc_id
}

output "eks_cluster_name" {
  value = module.eks.cluster_name
}

output "rds_endpoint" {
  value = module.rds.endpoint
}

