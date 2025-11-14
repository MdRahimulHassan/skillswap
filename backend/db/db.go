package db

import (
    "database/sql"
    "log"

    _ "github.com/lib/pq"
)

var DB *sql.DB

func Connect() {
    var err error
    dsn := "host=localhost port=5432 user=postgres password=1w111bback dbname=skill_swap sslmode=disable"

    DB, err = sql.Open("postgres", dsn)
    if err != nil {
        log.Fatal(err)
    }

    if err = DB.Ping(); err != nil {
        log.Fatal("DB connection failed:", err)
    }

    log.Println("Connected to PostgreSQL")
}
