package config


import (
"log"
"os"


"github.com/joho/godotenv"
)


type Config struct {
JWTSecret []byte
}


func Load() *Config {
_ = godotenv.Load()


secret := os.Getenv("JWT_SECRET")
if secret == "" {
log.Fatal("JWT_SECRET must be set in .env")
}


return &Config{JWTSecret: []byte(secret)}
}