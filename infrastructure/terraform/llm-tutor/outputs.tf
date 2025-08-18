output "cluster_name" {
  description = "The name of the EKS cluster."
  value       = aws_eks_cluster.this.name
}

output "cluster_endpoint" {
  description = "The endpoint for the EKS cluster's Kubernetes API."
  value       = aws_eks_cluster.this.endpoint
}

output "cluster_ca_certificate" {
  description = "The CA certificate for the EKS cluster."
  value       = aws_eks_cluster.this.certificate_authority[0].data
}