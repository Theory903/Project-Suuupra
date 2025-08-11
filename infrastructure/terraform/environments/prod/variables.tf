variable "region" { type = string default = "us-east-1" }
variable "vpc_cidr" { type = string default = "10.30.0.0/16" }
variable "azs" { type = list(string) default = ["us-east-1a","us-east-1b","us-east-1c"] }
variable "public_subnets" { type = list(string) default = ["10.30.1.0/24","10.30.2.0/24","10.30.3.0/24"] }
variable "private_subnets" { type = list(string) default = ["10.30.11.0/24","10.30.12.0/24","10.30.13.0/24"] }


