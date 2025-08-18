#!/usr/bin/env python3
"""
Local development runner for Commerce Service

This script ensures proper Python path configuration for running
the Commerce service locally outside of Docker.
"""

import os
import sys
from pathlib import Path

def main():
    """Run the Commerce service locally with proper configuration."""
    
    # Get the project root (commerce service directory)
    project_root = Path(__file__).parent.absolute()
    src_dir = project_root / "src"
    
    # Add src directory to Python path
    os.environ["PYTHONPATH"] = str(src_dir)
    
    # Set default environment variables for local development
    env_defaults = {
        "ENVIRONMENT": "development",
        "LOG_LEVEL": "DEBUG",
        "PORT": "8084",
        "DATABASE_URL": "postgresql+asyncpg://postgres:postgres@localhost:5432/commerce",
        "REDIS_URL": "redis://localhost:6379/1",
        "KAFKA_BOOTSTRAP_SERVERS": "localhost:9092",
    }
    
    for key, value in env_defaults.items():
        if key not in os.environ:
            os.environ[key] = value
    
    print("🚀 Starting Commerce Service in development mode...")
    print(f"📂 Project Root: {project_root}")
    print(f"🐍 Python Path: {os.environ['PYTHONPATH']}")
    print(f"🌍 Environment: {os.environ.get('ENVIRONMENT', 'development')}")
    print(f"🔌 Port: {os.environ.get('PORT', '8084')}")
    
    # Change to src directory and run the application
    os.chdir(src_dir)
    
    # Import and run the application
    try:
        import uvicorn
        uvicorn.run(
            "main:app",
            host="0.0.0.0",
            port=int(os.environ.get("PORT", "8084")),
            reload=True,
            log_level=os.environ.get("LOG_LEVEL", "DEBUG").lower(),
        )
    except ImportError:
        print("❌ Error: uvicorn not found. Please install requirements:")
        print("   pip install -r requirements.txt")
        sys.exit(1)
    except Exception as e:
        print(f"❌ Error starting service: {e}")
        sys.exit(1)

if __name__ == "__main__":
    main()
