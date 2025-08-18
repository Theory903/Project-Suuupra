"""
Terraform configuration for the LLM Tutor service
"""

terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }
}

provider "aws" {
  region = var.aws_region
}

module "eks" {
  source  = "terraform-aws-modules/eks/aws"
  version = "~> 19.0"

  cluster_name    = var.cluster_name
  cluster_version = "1.28"

  vpc_id     = var.vpc_id
  subnet_ids = var.subnet_ids

  eks_managed_node_groups = {
    general = {
      min_size     = 1
      max_size     = 3
      instance_types = ["t3.medium"]
    }

    gpu = {
      min_size     = 1
      max_size     = 2
      instance_types = ["g4dn.xlarge"]
      capacity_type  = "ON_DEMAND"
      k8s_labels = {
        "node.kubernetes.io/instance-type" = "g4dn.xlarge"
      }
      taints = [{
        key    = "nvidia.com/gpu"
        value  = "true"
        effect = "NO_SCHEDULE"
      }]
    }
  }
}
