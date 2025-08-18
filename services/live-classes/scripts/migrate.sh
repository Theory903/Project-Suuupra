#!/bin/bash

# Database migration script for Live Classes Service
set -euo pipefail

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}🗄️ Live Classes Database Migration...${NC}"

# Configuration
ENVIRONMENT=${ENVIRONMENT:-"development"}
DATABASE_URL=${DATABASE_URL:-""}

echo -e "${YELLOW}📋 Migration Configuration:${NC}"
echo "  Environment: ${ENVIRONMENT}"
echo "  Database URL: ${DATABASE_URL:0:30}..." # Show only first 30 chars for security

# Pre-migration checks
echo -e "${BLUE}🔍 Running pre-migration checks...${NC}"

# Check if Prisma is available
if ! command -v npx >/dev/null 2>&1; then
    echo -e "${RED}❌ npx is not installed${NC}"
    exit 1
fi

# Check if database URL is provided
if [[ -z "${DATABASE_URL}" ]]; then
    echo -e "${RED}❌ DATABASE_URL environment variable is required${NC}"
    exit 1
fi

# Test database connection
echo -e "${BLUE}🔌 Testing database connection...${NC}"
if ! npx prisma db execute --stdin <<< "SELECT 1;" >/dev/null 2>&1; then
    echo -e "${RED}❌ Cannot connect to database${NC}"
    echo "Please check your DATABASE_URL and ensure the database server is running"
    exit 1
fi

echo -e "${GREEN}✅ Database connection successful${NC}"

# Generate Prisma client
echo -e "${BLUE}🔧 Generating Prisma client...${NC}"
npx prisma generate

# Run migrations
echo -e "${BLUE}📈 Applying database migrations...${NC}"

case "${ENVIRONMENT}" in
    "development"|"test")
        echo -e "${YELLOW}⚠️ Development/Test environment detected${NC}"
        echo "This will reset the database and apply all migrations"
        read -p "Continue? (y/N): " -n 1 -r
        echo
        if [[ $REPLY =~ ^[Yy]$ ]]; then
            npx prisma db push --force-reset
            echo -e "${GREEN}✅ Database reset and migrations applied${NC}"
        else
            echo -e "${YELLOW}⏹️ Migration cancelled${NC}"
            exit 0
        fi
        ;;
    "staging"|"production")
        echo -e "${BLUE}🚀 Production environment detected${NC}"
        echo "Applying migrations safely..."
        
        # Check for pending migrations
        if npx prisma migrate status | grep -q "Database schema is up to date"; then
            echo -e "${GREEN}✅ Database is already up to date${NC}"
        else
            echo -e "${BLUE}📈 Applying pending migrations...${NC}"
            npx prisma migrate deploy
            echo -e "${GREEN}✅ Migrations applied successfully${NC}"
        fi
        ;;
    *)
        echo -e "${RED}❌ Unknown environment: ${ENVIRONMENT}${NC}"
        exit 1
        ;;
esac

# Seed data (optional)
if [[ -f "prisma/seed.ts" && "${SEED_DATA:-false}" == "true" ]]; then
    echo -e "${BLUE}🌱 Seeding database...${NC}"
    npx prisma db seed
    echo -e "${GREEN}✅ Database seeded${NC}"
fi

# Verify schema
echo -e "${BLUE}🔍 Verifying database schema...${NC}"
npx prisma db pull --print > /tmp/current-schema.prisma
if npx prisma format --schema /tmp/current-schema.prisma >/dev/null 2>&1; then
    echo -e "${GREEN}✅ Database schema is valid${NC}"
else
    echo -e "${RED}❌ Database schema validation failed${NC}"
    exit 1
fi

# Show migration status
echo -e "${BLUE}📊 Migration status:${NC}"
npx prisma migrate status

# Show database info
echo -e "${BLUE}📋 Database information:${NC}"
DB_TABLES=$(npx prisma db execute --stdin <<< "SELECT table_name FROM information_schema.tables WHERE table_schema = 'public';" | tail -n +3 | wc -l)
echo "  Tables: ${DB_TABLES}"

# Performance check
echo -e "${BLUE}⚡ Running performance check...${NC}"
QUERY_TIME=$(npx prisma db execute --stdin <<< "SELECT COUNT(*) FROM users;" 2>&1 | grep -o '[0-9]*ms' || echo "0ms")
echo "  Sample query time: ${QUERY_TIME}"

# Backup recommendation for production
if [[ "${ENVIRONMENT}" == "production" ]]; then
    echo -e "${YELLOW}💾 Production Migration Complete${NC}"
    echo -e "${YELLOW}🔔 Recommendation: Create a database backup after successful migration${NC}"
    echo "  Example: pg_dump \$DATABASE_URL > backup-$(date +%Y%m%d-%H%M%S).sql"
fi

echo -e "${GREEN}🎉 Database migration completed successfully!${NC}"

# Cleanup
rm -f /tmp/current-schema.prisma
