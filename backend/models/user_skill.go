package models

type UserSkill struct {
	ID        int    `json:"id"`
	UserID    int    `json:"user_id"`
	SkillID   int    `json:"skill_id"`
	SkillType string `json:"skill_type"`
}
