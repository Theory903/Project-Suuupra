
variable "region" {
  description = "The AWS region to deploy the EKS cluster in."
  type        = string
  default     = "us-east-1"
}

variable "cluster_name" {
  description = "The name of the EKS cluster."
  type        = string
  default     = "llm-tutor-eks"
}

variable "vpc_id" {
  description = "The ID of the VPC to deploy the EKS cluster in."
  type        = string
}

variable "subnet_ids" {
  description = "A list of subnet IDs to deploy the EKS cluster in."
  type        = list(string)
}
