# SkillSwap - Learn & Teach Platform

A web platform where users can exchange skills directly by teaching one skill and learning another.

## Features

- **User Profiles**: Display teachable and learnable skills.
- **Skill-Based Matchmaking**: Match users based on complementary skills.
- **Swap Requests**: Allow users to send and accept learning/teaching requests.
- **Messaging System**: Enable direct communication between matched users.
- **Admin Dashboard**: Manage users, monitor activities, and ensure fair use.

## Technology Stack

- **Frontend**: React, JavaScript, HTML, CSS
- **Backend**: Go (Golang)
- **Database**: PostgreSQL
- **Authentication**: JWT (JSON Web Token)
- **Version Control**: Git & GitHub

## Prerequisites

- Go 1.19 or later
- Node.js 16 or later
- PostgreSQL 12 or later
- Git

## Setup Instructions

### 1. Clone the Repository

```bash
git clone <repository-url>
cd skill_swap
```

### 2. Backend Setup

1. Navigate to the backend directory:
   ```bash
   cd backend
   ```

2. Install Go dependencies:
   ```bash
   go mod tidy
   ```

3. Set up PostgreSQL database:
   - Create a database named `skillswap`
   - Update the connection string in `main.go` if necessary (default: `user=postgres password=password dbname=skillswap sslmode=disable`)

4. Run the backend server:
   ```bash
   go run main.go
   ```
   The server will start on `http://localhost:8080`

### 3. Frontend Setup

1. Navigate to the frontend directory:
   ```bash
   cd frontend
   ```

2. Install Node.js dependencies:
   ```bash
   npm install
   ```

3. Start the React development server:
   ```bash
   npm start
   ```
   The app will be available at `http://localhost:3000`

## Usage

### User Registration and Login

1. Open the app in your browser at `http://localhost:3000`
2. Click on "Register" to create a new account
3. Fill in your email, password, name, and bio
4. After registration, log in with your credentials

### Managing Your Profile

1. After logging in, go to the Profile page
2. Update your name and bio
3. Add skills you want to teach or learn by selecting from the dropdown

### Finding Matches

1. Navigate to the Matches page
2. View potential matches based on complementary skills
3. Click "Connect" to initiate a skill swap

### Messaging

- Use the Messages page to communicate with matched users (feature under development)

### Admin Features

- If you have admin privileges, access the Admin page to view all users

## API Endpoints

### Public Endpoints
- `POST /register` - Register a new user
- `POST /login` - Login and receive JWT token

### Protected Endpoints (require JWT token in Authorization header)
- `GET /api/profile` - Get user profile
- `PUT /api/profile` - Update user profile
- `GET /api/skills` - Get all available skills
- `POST /api/user-skills` - Add a skill to user profile
- `GET /api/matches` - Get potential matches
- `POST /api/matches/{id}/accept` - Accept a match
- `GET /api/messages/{matchId}` - Get messages for a match
- `POST /api/messages` - Send a message

### Admin Endpoints
- `GET /api/admin/users` - Get all users (admin only)

## Database Schema

The application uses the following main tables:
- `users`: User information
- `skills`: Available skills
- `user_skills`: User's teach/learn skills
- `matches`: Skill swap matches
- `messages`: Chat messages
- `swap_requests`: Direct swap requests
- `admin_logs`: Admin activity logs

## Security

- Passwords are hashed using bcrypt
- JWT tokens are used for authentication
- CORS is configured for frontend-backend communication
- Admin routes are protected with additional middleware

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Test thoroughly
5. Submit a pull request

## License

This project is licensed under the MIT License.