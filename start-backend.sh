#!/bin/bash

echo "Starting SkillSwap Backend..."

# Check if .env file exists
if [ ! -f .env ]; then
    echo "Creating .env file with default values..."
    cat > .env << EOF
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=skillswap
EOF
fi

# Check if PostgreSQL is running
if ! pg_isready -h localhost -p 5432 >/dev/null 2>&1; then
    echo "PostgreSQL is not running. Please start PostgreSQL first."
    echo "On macOS: brew services start postgresql"
    echo "On Ubuntu: sudo systemctl start postgresql"
    exit 1
fi

# Start the backend
echo "Starting backend server..."
cd backend
go run main.go