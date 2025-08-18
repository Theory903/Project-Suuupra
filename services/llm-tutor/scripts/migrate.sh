#!/bin/bash
set -e

# LLM Tutor Service Database Migration Script
# Handles database schema migrations and data management

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ACTION=${1:-"upgrade"}
ENVIRONMENT=${ENVIRONMENT:-"development"}

echo "🗃️  LLM Tutor Database Migration"
echo "  Action: $ACTION"
echo "  Environment: $ENVIRONMENT"

# Change to project directory
cd "$PROJECT_DIR"

# Load environment variables
if [[ -f ".env.$ENVIRONMENT" ]]; then
    export $(cat .env.$ENVIRONMENT | grep -v '^#' | xargs)
elif [[ -f ".env" ]]; then
    export $(cat .env | grep -v '^#' | xargs)
fi

# Validate database URL
if [[ -z "$DATABASE_URL" ]]; then
    echo "❌ DATABASE_URL not set"
    exit 1
fi

echo "  Database: ${DATABASE_URL%%@*}@***"

# Ensure virtual environment is activated
if [[ -d "venv" ]]; then
    source venv/bin/activate
fi

# Validate alembic setup
if [[ ! -f "alembic.ini" ]]; then
    echo "⚠️  alembic.ini not found, initializing Alembic..."
    alembic init migrations
    
    # Update alembic.ini with our database URL
    sed -i.bak "s|sqlalchemy.url = driver://user:pass@localhost/dbname|sqlalchemy.url = ${DATABASE_URL}|g" alembic.ini
    
    # Update env.py to use our models
    cat > migrations/env.py << 'EOF'
from logging.config import fileConfig
from sqlalchemy import engine_from_config, pool
from alembic import context
import os
import sys

# Add the src directory to the path
sys.path.append(os.path.join(os.path.dirname(__file__), '..', 'src'))

from src.models import Base
from src.config.settings import get_settings

# this is the Alembic Config object
config = context.config

# Interpret the config file for Python logging
if config.config_file_name is not None:
    fileConfig(config.config_file_name)

# Set the database URL from environment
settings = get_settings()
config.set_main_option('sqlalchemy.url', settings.DATABASE_URL)

target_metadata = Base.metadata

def run_migrations_offline() -> None:
    """Run migrations in 'offline' mode."""
    url = config.get_main_option("sqlalchemy.url")
    context.configure(
        url=url,
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )

    with context.begin_transaction():
        context.run_migrations()

def run_migrations_online() -> None:
    """Run migrations in 'online' mode."""
    connectable = engine_from_config(
        config.get_section(config.config_ini_section),
        prefix="sqlalchemy.",
        poolclass=pool.NullPool,
    )

    with connectable.connect() as connection:
        context.configure(
            connection=connection, target_metadata=target_metadata
        )

        with context.begin_transaction():
            context.run_migrations()

if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
EOF
fi

# Function to check database connectivity
check_database() {
    echo "🔍 Checking database connectivity..."
    python -c "
import asyncio
import sys
from sqlalchemy.ext.asyncio import create_async_engine
from src.config.settings import get_settings

async def check_db():
    settings = get_settings()
    engine = create_async_engine(settings.DATABASE_URL)
    try:
        async with engine.connect() as conn:
            await conn.execute('SELECT 1')
        print('✅ Database connection successful')
        return True
    except Exception as e:
        print(f'❌ Database connection failed: {e}')
        return False
    finally:
        await engine.dispose()

result = asyncio.run(check_db())
sys.exit(0 if result else 1)
"
}

# Function to backup database
backup_database() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo "💾 Creating database backup..."
        BACKUP_FILE="backup_$(date +%Y%m%d_%H%M%S).sql"
        
        # Extract connection details from DATABASE_URL
        DB_URL_REGEX="postgresql\+asyncpg://([^:]+):([^@]+)@([^:]+):([0-9]+)/(.+)"
        if [[ $DATABASE_URL =~ $DB_URL_REGEX ]]; then
            DB_USER="${BASH_REMATCH[1]}"
            DB_PASS="${BASH_REMATCH[2]}"
            DB_HOST="${BASH_REMATCH[3]}"
            DB_PORT="${BASH_REMATCH[4]}"
            DB_NAME="${BASH_REMATCH[5]}"
            
            PGPASSWORD="$DB_PASS" pg_dump \
                -h "$DB_HOST" \
                -p "$DB_PORT" \
                -U "$DB_USER" \
                -d "$DB_NAME" \
                --no-password \
                --verbose \
                --file="$BACKUP_FILE"
            
            echo "✅ Backup created: $BACKUP_FILE"
        else
            echo "⚠️  Could not parse DATABASE_URL for backup"
        fi
    fi
}

# Function to generate migration
generate_migration() {
    local message=${2:-"Auto-generated migration"}
    echo "📝 Generating new migration: $message"
    alembic revision --autogenerate -m "$message"
    echo "✅ Migration generated"
}

# Function to show current revision
show_current() {
    echo "📍 Current database revision:"
    alembic current -v
}

# Function to show migration history
show_history() {
    echo "📚 Migration history:"
    alembic history -v
}

# Function to upgrade database
upgrade_database() {
    local target=${2:-"head"}
    echo "⬆️  Upgrading database to: $target"
    
    # Show current state
    show_current
    
    # Run upgrade
    alembic upgrade "$target"
    
    echo "✅ Database upgrade completed"
    show_current
}

# Function to downgrade database
downgrade_database() {
    local target=${2:-"-1"}
    echo "⬇️  Downgrading database to: $target"
    
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo "⚠️  Production downgrade detected!"
        read -p "Are you sure you want to downgrade production database? (yes/no): " confirm
        if [[ "$confirm" != "yes" ]]; then
            echo "❌ Downgrade cancelled"
            exit 1
        fi
        backup_database
    fi
    
    # Show current state
    show_current
    
    # Run downgrade
    alembic downgrade "$target"
    
    echo "✅ Database downgrade completed"
    show_current
}

# Function to reset database (development only)
reset_database() {
    if [[ "$ENVIRONMENT" == "production" ]]; then
        echo "❌ Database reset not allowed in production"
        exit 1
    fi
    
    echo "🔄 Resetting database..."
    read -p "This will destroy all data. Are you sure? (yes/no): " confirm
    if [[ "$confirm" != "yes" ]]; then
        echo "❌ Reset cancelled"
        exit 1
    fi
    
    # Drop all tables and recreate
    alembic downgrade base
    alembic upgrade head
    
    echo "✅ Database reset completed"
}

# Function to seed database with test data
seed_database() {
    echo "🌱 Seeding database with test data..."
    python -c "
import asyncio
from src.scripts.seed_data import seed_test_data

asyncio.run(seed_test_data())
print('✅ Test data seeded')
"
}

# Main execution
case $ACTION in
    "check")
        check_database
        ;;
    "current")
        show_current
        ;;
    "history")
        show_history
        ;;
    "generate"|"revision")
        generate_migration "$@"
        ;;
    "upgrade")
        check_database
        upgrade_database "$@"
        ;;
    "downgrade")
        check_database
        downgrade_database "$@"
        ;;
    "reset")
        check_database
        reset_database
        ;;
    "seed")
        check_database
        seed_database
        ;;
    "backup")
        backup_database
        ;;
    *)
        echo "❌ Unknown action: $ACTION"
        echo ""
        echo "Usage: $0 <action> [options]"
        echo ""
        echo "Actions:"
        echo "  check              - Check database connectivity"
        echo "  current            - Show current revision"
        echo "  history            - Show migration history"
        echo "  generate <message> - Generate new migration"
        echo "  upgrade [target]   - Upgrade to target (default: head)"
        echo "  downgrade [target] - Downgrade to target (default: -1)"
        echo "  reset              - Reset database (dev only)"
        echo "  seed               - Seed with test data"
        echo "  backup             - Create database backup"
        echo ""
        echo "Environment variables:"
        echo "  ENVIRONMENT        - Environment (development, staging, production)"
        echo "  DATABASE_URL       - Database connection URL"
        exit 1
        ;;
esac

echo "✅ Migration operation completed!"
