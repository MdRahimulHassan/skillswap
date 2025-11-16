package models

import "database/sql"

type User struct {
	ID           int    `json:"id"`
	Username     string `json:"username"`
	Email        string `json:"email"`
	Name         string `json:"name"`
	ProfilePhoto string `json:"profile_photo"`
	SkillsHave   string `json:"skills_have"`
	SkillsWant   string `json:"skills_want"`
}

type UserDB struct {
	ID           int            `json:"id"`
	Username     string         `json:"username"`
	Email        string         `json:"email"`
	Name         sql.NullString `json:"name"`
	ProfilePhoto sql.NullString `json:"profile_photo"`
	SkillsHave   sql.NullString `json:"skills_have"`
	SkillsWant   sql.NullString `json:"skills_want"`
}
