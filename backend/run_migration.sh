#!/bin/bash

# SkillSwap Database Migration Script
# This script will run the database migration for the new skill-based resource system

echo "🚀 Starting SkillSwap Database Migration..."

# Check if PostgreSQL is running
if ! pg_isready -q; then
    echo "❌ PostgreSQL is not running. Please start PostgreSQL first."
    exit 1
fi

# Database connection details
DB_HOST=${DB_HOST:-localhost}
DB_PORT=${DB_PORT:-5432}
DB_USER=${DB_USER:-postgres}
DB_NAME=${DB_NAME:-skillswap}

echo "📊 Connecting to database: $DB_NAME on $DB_HOST:$DB_PORT"

# Run the migration
psql -h "$DB_HOST" -p "$DB_PORT" -U "$DB_USER" -d "$DB_NAME" -f "skill_connections_migration.sql"

if [ $? -eq 0 ]; then
    echo "✅ Database migration completed successfully!"
    echo "🎯 New tables created: skill_resources, p2p_connections"
    echo "🔗 Connection management system is now ready"
else
    echo "❌ Migration failed. Please check the error above."
    exit 1
fi