package models

type Match struct {
	ID       int    `json:"id"`
	User1ID  int    `json:"user1_id"`
	User2ID  int    `json:"user2_id"`
	Skill1ID int    `json:"skill1_id"`
	Skill2ID int    `json:"skill2_id"`
	Status   string `json:"status"`
}
