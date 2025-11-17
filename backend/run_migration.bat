@echo off
REM SkillSwap Database Migration Script for Windows
REM This script will run database migration for new skill-based resource system

echo 🚀 Starting SkillSwap Database Migration...

REM Database connection details (set these in your environment)
set DB_HOST=localhost
set DB_PORT=5432
set DB_USER=postgres
set DB_NAME=skillswap

echo 📊 Connecting to database: %DB_NAME% on %DB_HOST%:%DB_PORT%

REM Run migration
psql -h %DB_HOST% -p %DB_PORT% -U %DB_USER% -d %DB_NAME% -f "skill_connections_migration.sql"

if %ERRORLEVEL% EQU 0 (
    echo ✅ Database migration completed successfully!
    echo 🎯 New tables created: skill_resources, p2p_connections
    echo 🔗 Connection management system is now ready
) else (
    echo ❌ Migration failed. Please check error above.
    pause
    exit /b 1
)

pause