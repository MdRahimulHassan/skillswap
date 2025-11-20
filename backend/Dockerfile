#what the Dockerfile does:
#1. Build your Go backend inside a Go image
#2. Copy the compiled binary into a tiny Alpine image
#3. Runs your backend on port 8080


# Build stage
FROM golang:1.25-alpine AS builder

WORKDIR /app

# Copy go.mod and go.sum first (cache dependencies)
COPY go.mod go.sum ./
RUN go mod download

# Copy the rest of the source code
COPY . .

# Build the binary
RUN go build -o backend .

# Final stage
FROM alpine:latest

WORKDIR /app

COPY --from=builder /app/backend .

EXPOSE 8080

CMD ["./backend"]
