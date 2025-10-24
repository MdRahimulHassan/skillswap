package middleware

import (
	"fmt"
	"net/http"
	"skillswap-backend/config"
	"strings"

	"github.com/golang-jwt/jwt/v4"
)

func JWTMiddleware(cfg *config.Config) func(http.Handler) http.Handler {
	return func(next http.Handler) http.Handler {
		return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
			authHeader := r.Header.Get("Authorization")
			if authHeader == "" {
				http.Error(w, "Missing token", http.StatusUnauthorized)
				return
			}
			tokenString := strings.Replace(authHeader, "Bearer ", "", 1)
			token, err := jwt.Parse(tokenString, func(token *jwt.Token) (interface{}, error) {
				return cfg.JWTSecret, nil
			})
			if err != nil || !token.Valid {
				http.Error(w, "Invalid token", http.StatusUnauthorized)
				return
			}
			if claims, ok := token.Claims.(jwt.MapClaims); ok {
				r.Header.Set("user_id", fmt.Sprintf("%.0f", claims["user_id"]))
			}
			next.ServeHTTP(w, r)
		})
	}
}
