variable "region" { type = string default = "us-east-1" }
variable "vpc_cidr" { type = string default = "10.20.0.0/16" }
variable "azs" { type = list(string) default = ["us-east-1a","us-east-1b","us-east-1c"] }
variable "public_subnets" { type = list(string) default = ["10.20.1.0/24","10.20.2.0/24","10.20.3.0/24"] }
variable "private_subnets" { type = list(string) default = ["10.20.11.0/24","10.20.12.0/24","10.20.13.0/24"] }


