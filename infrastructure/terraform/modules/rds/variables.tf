variable "name" { type = string }
variable "engine_version" { type = string default = "15" }
variable "instance_class" { type = string }
variable "vpc_id" { type = string }
variable "private_subnet_ids" { type = list(string) }
variable "allowed_security_groups" { type = list(string) }
variable "multi_az" { type = bool default = true }
variable "db_name" { type = string default = "app" }
variable "username" { type = string default = "app" }
variable "password" { type = string default = "ChangeMe123!" }
variable "tags" { type = map(string) default = {} }


