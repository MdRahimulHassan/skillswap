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
	CreatedAt    string `json:"created_at,omitempty"`
	Bio          string `json:"bio,omitempty"`
	Location     string `json:"location,omitempty"`
	Availability string `json:"availability,omitempty"`
	LinkedIn     string `json:"linkedin,omitempty"`
	Github       string `json:"github,omitempty"`
}

type UserDB struct {
	ID           int            `json:"id"`
	Username     string         `json:"username"`
	Email        string         `json:"email"`
	Name         sql.NullString `json:"name"`
	ProfilePhoto sql.NullString `json:"profile_photo"`
	SkillsHave   sql.NullString `json:"skills_have"`
	SkillsWant   sql.NullString `json:"skills_want"`
	CreatedAt    sql.NullTime   `json:"created_at"`
	Bio          sql.NullString `json:"bio"`
	Location     sql.NullString `json:"location"`
	Availability sql.NullString `json:"availability"`
	LinkedIn     sql.NullString `json:"linkedin"`
	Github       sql.NullString `json:"github"`
}
