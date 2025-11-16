package handlers

import (
	"encoding/json"
	"main/db"
	"main/models"
	"net/http"
	"strconv"
)

func GetProfile(w http.ResponseWriter, r *http.Request) {
	id, _ := strconv.Atoi(r.URL.Query().Get("id"))

	var user models.User
	err := db.DB.QueryRow(`
        SELECT id, username, email, name, profile_photo, skills_have, skills_want
        FROM users WHERE id = $1
    `, id).Scan(
		&user.ID,
		&user.Username,
		&user.Email,
		&user.Name,
		&user.ProfilePhoto,
		&user.SkillsHave,
		&user.SkillsWant,
	)

	if err != nil {
		http.Error(w, "User not found", 404)
		return
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(user)
}

func UpdateProfile(w http.ResponseWriter, r *http.Request) {
	r.ParseForm()

	id := r.FormValue("id")
	name := r.FormValue("name")
	photo := r.FormValue("profile_photo")
	skillsHave := r.FormValue("skills_have")
	skillsWant := r.FormValue("skills_want")

	_, err := db.DB.Exec(`
        UPDATE users SET 
            name=$1, 
            profile_photo=$2,
            skills_have=$3,
            skills_want=$4
        WHERE id=$5
    `, name, photo, skillsHave, skillsWant, id)

	if err != nil {
		http.Error(w, "Failed to update", 500)
		return
	}

	w.Write([]byte("OK"))
}
