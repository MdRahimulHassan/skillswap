@echo off
echo Starting SkillSwap Backend...

REM Check if .env file exists
if not exist .env (
    echo Creating .env file with default values...
    (
        echo DB_HOST=localhost
        echo DB_PORT=5432
        echo DB_USER=postgres
        echo DB_PASSWORD=postgres
        echo DB_NAME=skillswap
    ) > .env
)

REM Start the backend
echo Starting backend server...
cd backend
go run main.go

pause