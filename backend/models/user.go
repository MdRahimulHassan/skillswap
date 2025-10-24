package models

type User struct {
	ID      int    `json:"id"`
	Email   string `json:"email"`
	Name    string `json:"name"`
	Bio     string `json:"bio"`
	IsAdmin bool   `json:"is_admin"`
}
