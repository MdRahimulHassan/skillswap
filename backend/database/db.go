package database


import (
"database/sql"
"fmt"
"log"
"os"


_ "github.com/lib/pq"
)


func Connect() *sql.DB {
connStr := fmt.Sprintf(
"host=%s port=%s user=%s password=%s dbname=%s sslmode=disable",
os.Getenv("DB_HOST"),
os.Getenv("DB_PORT"),
os.Getenv("DB_USER"),
os.Getenv("DB_PASSWORD"),
os.Getenv("DB_NAME"),
)


db, err := sql.Open("postgres", connStr)
if err != nil {
log.Fatal("DB connection error:", err)
}


if err := db.Ping(); err != nil {
log.Fatal("DB ping failed:", err)
}


return db
}