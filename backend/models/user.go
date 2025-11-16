package models

type User struct {
    ID           int    `json:"id"`
    Username     string `json:"username"`
    Email        string `json:"email"`
    Name         string `json:"name"`
    ProfilePhoto string `json:"profile_photo"`
    SkillsHave   string `json:"skills_have"`
    SkillsWant   string `json:"skills_want"`
}
