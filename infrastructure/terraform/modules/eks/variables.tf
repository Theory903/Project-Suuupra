variable "cluster_name" { type = string }
variable "cluster_version" { type = string default = "1.28" }
variable "vpc_id" { type = string }
variable "public_subnet_ids" { type = list(string) }
variable "private_subnet_ids" { type = list(string) }
variable "node_instance_types" { type = list(string) default = ["t3.large"] }
variable "desired_capacity" { type = number default = 3 }


