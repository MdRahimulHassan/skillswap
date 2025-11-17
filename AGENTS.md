# SkillSwap Development Guidelines

## Build Commands

### Backend (Go)
```bash
# Build backend
cd backend && go build -o skillswap .

# Run backend
cd backend && go run .

# Run tests
cd backend && go test ./...

# Run specific test
cd backend && go test -run TestFunctionName ./handlers
```

### Frontend
```bash
# Install dependencies
npm install

# No build step - static files served directly by Go backend
```

## Code Style Guidelines

### Go Backend
- Use standard Go formatting (`gofmt`)
- Package naming: lowercase, single words when possible
- Error handling: always check and return errors, use `sendErrorResponse` for HTTP responses
- JSON structs: use JSON tags with snake_case
- Database queries: use prepared statements, parameterized queries
- HTTP handlers: check method types, validate input, use CORS wrapper

### JavaScript Frontend
- Use ES6+ features (classes, async/await, arrow functions)
- Error handling: try/catch with `handleError` utility
- API calls: use `apiCall` utility with proper error handling
- Authentication: use `auth` manager for session handling
- UI feedback: use `showToast` for notifications, `loading` utility for buttons

### Database
- Use PostgreSQL with proper foreign key constraints
- Table names: snake_case
- Column naming: snake_case with descriptive names
- Always use parameterized queries to prevent SQL injection

### General
- Follow existing patterns in codebase
- Keep functions small and focused
- Use meaningful variable names
- Add comments only for complex logic