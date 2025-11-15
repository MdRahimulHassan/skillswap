package handlers

import (
	"encoding/json"
	"database/sql"
	"main/db"
	"net/http"
	"strconv"
)

type ChatListItem struct {
	UserID    int    `json:"user_id"`
	LastMsg   string `json:"last_msg"`
	IsFile    bool   `json:"is_file"`
	CreatedAt string `json:"created_at"`
}

// GET /api/chats?user_id=1
func GetChatList(w http.ResponseWriter, r *http.Request) {
	uidStr := r.URL.Query().Get("user_id")
	if uidStr == "" { http.Error(w, "user_id required", http.StatusBadRequest); return }
	uid, _ := strconv.Atoi(uidStr)

	rows, err := db.DB.Query(`
		SELECT other_id, content, is_file, created_at FROM (
		  SELECT CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END AS other_id,
		         content, is_file, created_at
		  FROM messages
		  WHERE sender_id=$1 OR receiver_id=$1
		  ORDER BY created_at DESC
		) t
		GROUP BY other_id, content, is_file, created_at
		ORDER BY created_at DESC
	`, uid)
	if err != nil { http.Error(w, "db error:"+err.Error(), http.StatusInternalServerError); return }
	defer rows.Close()

	var out []ChatListItem
	for rows.Next() {
		var it ChatListItem
		rows.Scan(&it.UserID, &it.LastMsg, &it.IsFile, &it.CreatedAt)
		out = append(out, it)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// GET /api/history?user1=1&user2=2
func GetHistory(w http.ResponseWriter, r *http.Request) {
	u1 := r.URL.Query().Get("user1")
	u2 := r.URL.Query().Get("user2")
	if u1 == "" || u2 == "" { http.Error(w, "user1 and user2 required", http.StatusBadRequest); return }

	rows, err := db.DB.Query(`SELECT id, sender_id, receiver_id, content, is_file, file_id, created_at
		FROM messages
		WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)
		ORDER BY created_at ASC`, u1, u2)
	if err != nil { http.Error(w, "db error:"+err.Error(), http.StatusInternalServerError); return }
	defer rows.Close()

	type H struct {
		ID         int    `json:"id"`
		SenderID   int    `json:"sender_id"`
		ReceiverID int    `json:"receiver_id"`
		Content    string `json:"content"`
		IsFile     bool   `json:"is_file"`
		FileID     *int   `json:"file_id"`
		CreatedAt  string `json:"created_at"`
	}

	var out []H
	for rows.Next() {
		var it H
		var fileID sql.NullInt32
		rows.Scan(&it.ID, &it.SenderID, &it.ReceiverID, &it.Content, &it.IsFile, &fileID, &it.CreatedAt)
		if fileID.Valid { v := int(fileID.Int32); it.FileID = &v }
		out = append(out, it)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}
