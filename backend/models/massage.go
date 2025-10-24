package models

type Message struct {
	ID       int    `json:"id"`
	MatchID  int    `json:"match_id"`
	SenderID int    `json:"sender_id"`
	Content  string `json:"content"`
	SentAt   string `json:"sent_at"`
}
