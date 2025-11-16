package handlers

import (
	"database/sql"
	"encoding/json"
	"main/db"
	"net/http"
	"strconv"
	"strings"
)

type ChatListItem struct {
	UserID       int    `json:"user_id"`
	Username     string `json:"username"`
	Name         string `json:"name"`
	ProfilePhoto string `json:"profile_photo"`
	LastMsg      string `json:"last_msg"`
	IsFile       bool   `json:"is_file"`
	CreatedAt    string `json:"created_at"`
}

// GET /api/chats?user_id=1
func GetChatList(w http.ResponseWriter, r *http.Request) {
	uidStr := r.URL.Query().Get("user_id")
	if uidStr == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	uid, _ := strconv.Atoi(uidStr)

	rows, err := db.DB.Query(`
		SELECT DISTINCT ON (u.id) 
		       u.id, u.username, u.name, u.profile_photo,
		       m.content, m.is_file, m.created_at
		FROM users u
		INNER JOIN (
		  SELECT CASE WHEN sender_id=$1 THEN receiver_id ELSE sender_id END AS other_id,
		         content, is_file, created_at
		  FROM messages
		  WHERE sender_id=$1 OR receiver_id=$1
		  ORDER BY created_at DESC
		) m ON u.id = m.other_id
		ORDER BY u.id, m.created_at DESC
	`, uid)
	if err != nil {
		http.Error(w, "db error:"+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var out []ChatListItem
	for rows.Next() {
		var it ChatListItem
		rows.Scan(&it.UserID, &it.Username, &it.Name, &it.ProfilePhoto, &it.LastMsg, &it.IsFile, &it.CreatedAt)
		out = append(out, it)
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}

// GET /api/users/online?ids=1,2,3 - Check online status of users
func GetOnlineStatus(w http.ResponseWriter, r *http.Request) {
	idsStr := r.URL.Query().Get("ids")
	if idsStr == "" {
		http.Error(w, "ids parameter required", http.StatusBadRequest)
		return
	}

	// Parse comma-separated IDs
	idStrs := strings.Split(idsStr, ",")
	var ids []int
	for _, idStr := range idStrs {
		if id, err := strconv.Atoi(strings.TrimSpace(idStr)); err == nil {
			ids = append(ids, id)
		}
	}

	// Check online status
	type OnlineStatus struct {
		UserID int  `json:"user_id"`
		Online bool `json:"online"`
	}

	var status []OnlineStatus
	for _, id := range ids {
		if _, online := getClient(id); online {
			status = append(status, OnlineStatus{UserID: id, Online: true})
		} else {
			status = append(status, OnlineStatus{UserID: id, Online: false})
		}
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(status)
}

// GET /api/history?user1=1&user2=2
func GetHistory(w http.ResponseWriter, r *http.Request) {
	u1 := r.URL.Query().Get("user1")
	u2 := r.URL.Query().Get("user2")
	if u1 == "" || u2 == "" {
		http.Error(w, "user1 and user2 required", http.StatusBadRequest)
		return
	}

	rows, err := db.DB.Query(`SELECT id, sender_id, receiver_id, content, is_file, file_id, created_at
		FROM messages
		WHERE (sender_id=$1 AND receiver_id=$2) OR (sender_id=$2 AND receiver_id=$1)
		ORDER BY created_at ASC`, u1, u2)
	if err != nil {
		http.Error(w, "db error:"+err.Error(), http.StatusInternalServerError)
		return
	}
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
		if fileID.Valid {
			v := int(fileID.Int32)
			it.FileID = &v
		}
		out = append(out, it)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(out)
}
