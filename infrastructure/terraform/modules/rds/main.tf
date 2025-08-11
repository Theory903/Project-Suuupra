terraform {
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = ">= 5.0"
    }
  }
}

resource "aws_db_subnet_group" "this" {
  name       = "${var.name}-subnets"
  subnet_ids = var.private_subnet_ids
  tags       = var.tags
}

resource "aws_db_instance" "this" {
  identifier              = var.name
  engine                  = "postgres"
  engine_version          = var.engine_version
  instance_class          = var.instance_class
  allocated_storage       = 50
  db_name                 = var.db_name
  username                = var.username
  password                = var.password
  publicly_accessible     = false
  multi_az                = var.multi_az
  db_subnet_group_name    = aws_db_subnet_group.this.name
  skip_final_snapshot     = true
  storage_encrypted       = true
  deletion_protection     = false
  apply_immediately       = true
  vpc_security_group_ids  = var.allowed_security_groups
}

output "endpoint" { value = aws_db_instance.this.address }


