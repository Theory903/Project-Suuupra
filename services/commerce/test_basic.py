#!/usr/bin/env python3
"""
Basic validation script for Commerce Service setup.

This script performs basic checks to ensure the Commerce Service
is properly configured and ready for development.
"""

import os
import sys
from pathlib import Path


def check_file_exists(file_path: str, description: str) -> bool:
    """Check if a file exists."""
    if os.path.exists(file_path):
        print(f"✅ {description}: {file_path}")
        return True
    else:
        print(f"❌ {description}: {file_path} (missing)")
        return False


def check_directory_exists(dir_path: str, description: str) -> bool:
    """Check if a directory exists."""
    if os.path.isdir(dir_path):
        print(f"✅ {description}: {dir_path}")
        return True
    else:
        print(f"❌ {description}: {dir_path} (missing)")
        return False


def check_python_imports() -> bool:
    """Check if key Python packages can be imported."""
    packages = [
        ("fastapi", "FastAPI framework"),
        ("pydantic", "Data validation"),
        ("sqlalchemy", "Database ORM"),
        ("redis", "Redis client"),
        ("structlog", "Structured logging"),
        ("prometheus_client", "Metrics collection"),
    ]
    
    all_good = True
    for package, description in packages:
        try:
            __import__(package)
            print(f"✅ Python package: {package} ({description})")
        except ImportError:
            print(f"❌ Python package: {package} ({description}) - not installed")
            all_good = False
    
    return all_good


def main():
    """Run all validation checks."""
    print("🔍 Commerce Service - Basic Setup Validation")
    print("=" * 50)
    
    all_checks_passed = True
    
    # Check core files
    core_files = [
        ("src/main.py", "Main application entry point"),
        ("src/commerce/__init__.py", "Commerce package"),
        ("src/commerce/config/settings.py", "Configuration settings"),
        ("src/commerce/domain/aggregates/order.py", "Order aggregate"),
        ("src/commerce/domain/events/order_events.py", "Order events"),
        ("src/commerce/infrastructure/persistence/event_store.py", "Event store"),
        ("src/commerce/infrastructure/persistence/cart_repository.py", "Cart repository"),
        ("src/commerce/api/v1/routes/cart.py", "Cart API routes"),
        ("requirements.txt", "Python dependencies"),
        ("pyproject.toml", "Project configuration"),
        ("Dockerfile", "Docker configuration"),
        ("docker-compose.yml", "Docker Compose configuration"),
        ("Makefile", "Development commands"),
        (".env.example", "Environment variables template"),
    ]
    
    print("\n📁 Checking core files:")
    for file_path, description in core_files:
        if not check_file_exists(file_path, description):
            all_checks_passed = False
    
    # Check directories
    directories = [
        ("src/commerce/domain", "Domain layer"),
        ("src/commerce/infrastructure", "Infrastructure layer"),
        ("src/commerce/api", "API layer"),
        ("src/commerce/utils", "Utilities"),
        ("monitoring", "Monitoring configuration"),
        ("scripts", "Database scripts"),
    ]
    
    print("\n📂 Checking directories:")
    for dir_path, description in directories:
        if not check_directory_exists(dir_path, description):
            all_checks_passed = False
    
    # Check Python imports (only if we're in a Python environment)
    print("\n🐍 Checking Python packages:")
    if not check_python_imports():
        print("   Note: Run 'pip install -r requirements.txt' to install missing packages")
        all_checks_passed = False
    
    # Check environment variables template
    print("\n🔧 Checking environment configuration:")
    env_vars = [
        "DATABASE_URL",
        "REDIS_URL",
        "JWT_SECRET",
        "ENVIRONMENT",
        "PORT",
    ]
    
    env_file = ".env.example"
    if os.path.exists(env_file):
        with open(env_file, 'r') as f:
            env_content = f.read()
            for var in env_vars:
                if var in env_content:
                    print(f"✅ Environment variable: {var}")
                else:
                    print(f"❌ Environment variable: {var} (missing from .env.example)")
                    all_checks_passed = False
    
    # Summary
    print("\n" + "=" * 50)
    if all_checks_passed:
        print("🎉 All checks passed! Commerce Service is ready for development.")
        print("\nNext steps:")
        print("1. Copy .env.example to .env and configure your settings")
        print("2. Run 'make quick-start' to start the development environment")
        print("3. Visit http://localhost:8084/docs for API documentation")
        return 0
    else:
        print("❌ Some checks failed. Please review the issues above.")
        print("\nCommon fixes:")
        print("1. Run 'pip install -r requirements.txt' for missing Python packages")
        print("2. Ensure you're in the correct directory (services/commerce)")
        print("3. Check that all files were created correctly")
        return 1


if __name__ == "__main__":
    sys.exit(main())
