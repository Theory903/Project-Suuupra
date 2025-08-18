"""
Terraform variables
"""

variable "aws_region" {
  description = "The AWS region to deploy to."
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
  default     = "llm-tutor-cluster"
}

variable "vpc_id" {
  description = "The ID of the VPC to deploy to."
  type        = string
}

variable "subnet_ids" {
  description = "A list of subnet IDs to deploy to."
  type        = list(string)
}
