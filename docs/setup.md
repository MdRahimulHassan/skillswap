# Setup Guide for SkillSwap

## Detailed Backend Setup

1. Ensure Go is installed:
   ```bash
   go version
   ```

2. Initialize the Go module (already done):
   - The `go.mod` file is present in the backend directory

3. Install dependencies (already done via go get commands):
   - gorilla/mux for routing
   - lib/pq for PostgreSQL driver
   - golang-jwt for JWT handling
   - golang.org/x/crypto for password hashing
   - gorilla/handlers for CORS

4. PostgreSQL Setup:
   - Install PostgreSQL if not already installed
   - Create a database: `createdb skillswap`
   - Create a user with appropriate permissions
   - Update the connection string in `main.go` if your credentials differ

5. Run database migrations:
   - The tables are created automatically when the server starts
   - Check `schema.sql` for the database structure

## Detailed Frontend Setup

1. Ensure Node.js is installed:
   ```bash
   node --version
   npm --version
   ```

2. Install dependencies (already done):
   - react-router-dom for routing
   - axios for HTTP requests

3. Environment variables:
   - The backend URL is hardcoded to `http://localhost:8080`
   - For production, consider using environment variables

## Running the Application

1. Start the backend:
   ```bash
   cd backend
   go run main.go
   ```

2. In a new terminal, start the frontend:
   ```bash
   cd frontend
   npm start
   ```

3. Open `http://localhost:3000` in your browser

## Troubleshooting

- **Backend connection issues**: Ensure PostgreSQL is running and credentials are correct
- **CORS errors**: Check that the frontend is running on localhost:3000
- **JWT errors**: Ensure the token is stored in localStorage correctly
- **Go import errors**: Run `go mod tidy` to resolve dependencies