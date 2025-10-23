package middleware


import (
"database/sql"
"net/http"
)


func AdminMiddleware(db *sql.DB) func(http.Handler) http.Handler {
return func(next http.Handler) http.Handler {
return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
userID := r.Header.Get("user_id")
var isAdmin bool
err := db.QueryRow("SELECT is_admin FROM users WHERE id = $1", userID).Scan(&isAdmin)
if err != nil || !isAdmin {
http.Error(w, "Admin access required", http.StatusForbidden)
return
}
next.ServeHTTP(w, r)
})
}
}