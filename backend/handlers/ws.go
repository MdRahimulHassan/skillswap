package handlers

import (
	"database/sql"
	"log"
	"main/db"
	"net/http"
	"strconv"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

type WSMsg struct {
	Type       string `json:"type"` // "message" | "file"
	SenderID   int    `json:"sender_id"`
	ReceiverID int    `json:"receiver_id"`
	Content    string `json:"content,omitempty"`
	FileID     int    `json:"file_id,omitempty"`
	IsFile     bool   `json:"is_file,omitempty"`
	CreatedAt  string `json:"created_at,omitempty"`
}

var upgrader = websocket.Upgrader{CheckOrigin: func(r *http.Request) bool { return true }}

type client struct {
	uid  int
	conn *websocket.Conn
	send chan WSMsg
}

var (
	clients   = make(map[int]*client)
	clientsMu sync.RWMutex
)

func addClient(c *client) {
	clientsMu.Lock()
	clients[c.uid] = c
	clientsMu.Unlock()
	log.Printf("User %d is now online", c.uid)
}
func removeClient(uid int) {
	clientsMu.Lock()
	if cl, ok := clients[uid]; ok {
		close(cl.send)
		cl.conn.Close()
		delete(clients, uid)
		log.Printf("User %d is now offline", uid)
	}
	clientsMu.Unlock()
}
func getClient(uid int) (*client, bool) {
	clientsMu.RLock()
	cl, ok := clients[uid]
	clientsMu.RUnlock()
	return cl, ok
}

// Send pending messages to a user when they come online
func sendPendingMessages(c *client) {
	rows, err := db.DB.Query(`
		SELECT id, sender_id, receiver_id, content, is_file, file_id, created_at
		FROM messages
		WHERE receiver_id=$1 AND delivered=false
		ORDER BY created_at ASC
	`, c.uid)
	if err != nil {
		log.Printf("Error fetching pending messages for user %d: %v", c.uid, err)
		return
	}
	defer rows.Close()

	var pendingMsgs []WSMsg
	var msgIDs []int

	for rows.Next() {
		var id int
		var msg WSMsg
		var fileID sql.NullInt32

		err := rows.Scan(&id, &msg.SenderID, &msg.ReceiverID, &msg.Content, &msg.IsFile, &fileID, &msg.CreatedAt)
		if err != nil {
			log.Printf("Error scanning pending message: %v", err)
			continue
		}

		if fileID.Valid {
			v := int(fileID.Int32)
			msg.FileID = v
			msg.Type = "file"
		} else {
			msg.Type = "message"
		}

		pendingMsgs = append(pendingMsgs, msg)
		msgIDs = append(msgIDs, id)
	}

	// Send pending messages to the user
	for _, msg := range pendingMsgs {
		select {
		case c.send <- msg:
			log.Printf("Delivered pending message from %d to %d", msg.SenderID, msg.ReceiverID)
		default:
			log.Printf("Channel full, skipping pending message from %d to %d", msg.SenderID, msg.ReceiverID)
		}
	}

	// Mark messages as delivered
	if len(msgIDs) > 0 {
		_, err = db.DB.Exec(`
			UPDATE messages 
			SET delivered=true 
			WHERE id = ANY($1)
		`, msgIDs)
		if err != nil {
			log.Printf("Error marking messages as delivered: %v", err)
		} else {
			log.Printf("Marked %d messages as delivered for user %d", len(msgIDs), c.uid)
		}
	}
}

func wsWritePump(c *client) {
	for msg := range c.send {
		_ = c.conn.WriteJSON(msg)
	}
}

func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	// For now: expect ?user_id=123
	uidStr := r.URL.Query().Get("user_id")
	if uidStr == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}
	uid, err := strconv.Atoi(uidStr)
	if err != nil {
		http.Error(w, "invalid user_id", http.StatusBadRequest)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("upgrade:", err)
		return
	}

	cl := &client{uid: uid, conn: conn, send: make(chan WSMsg, 32)}
	addClient(cl)
	log.Printf("ws connected: %d\n", uid)

	// Send pending messages when user comes online
	go sendPendingMessages(cl)

	go wsWritePump(cl)

	for {
		var m WSMsg
		if err := conn.ReadJSON(&m); err != nil {
			log.Println("ws read:", err)
			break
		}

		// Check if receiver is online
		receiverOnline := false
		if _, ok := getClient(m.ReceiverID); ok {
			receiverOnline = true
		}

		// Persist message
		if m.Type == "message" {
			var created time.Time
			err := db.DB.QueryRow(
				`INSERT INTO messages(sender_id, receiver_id, content, is_file, delivered) VALUES($1,$2,$3,false,$4) RETURNING created_at`,
				m.SenderID, m.ReceiverID, m.Content, receiverOnline).Scan(&created)
			if err != nil {
				log.Println("insert message:", err)
				continue
			}
			m.CreatedAt = created.UTC().Format(time.RFC3339)
		} else if m.Type == "file" {
			// file message may be created by upload endpoint; but support here too
			var created time.Time
			err := db.DB.QueryRow(
				`INSERT INTO messages(sender_id, receiver_id, is_file, file_id, delivered) VALUES($1,$2,true,$3,$4) RETURNING created_at`,
				m.SenderID, m.ReceiverID, m.FileID, receiverOnline).Scan(&created)
			if err != nil {
				log.Println("insert file message:", err)
				continue
			}
			m.CreatedAt = created.UTC().Format(time.RFC3339)
		}

		// deliver to receiver if online
		if receiverClient, ok := getClient(m.ReceiverID); ok {
			receiverClient.send <- m
			// Mark as delivered since receiver is online
			_, err := db.DB.Exec(`UPDATE messages SET delivered=true WHERE sender_id=$1 AND receiver_id=$2 AND created_at=$3`,
				m.SenderID, m.ReceiverID, m.CreatedAt)
			if err != nil {
				log.Printf("Error marking message as delivered: %v", err)
			}
		}
		// Always send to sender for their own record
		if senderClient, ok := getClient(m.SenderID); ok {
			senderClient.send <- m
		}
	}

	removeClient(uid)
}
