package handlers

import (
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
}
func removeClient(uid int) {
	clientsMu.Lock()
	if cl, ok := clients[uid]; ok {
		close(cl.send)
		cl.conn.Close()
		delete(clients, uid)
	}
	clientsMu.Unlock()
}
func getClient(uid int) (*client, bool) {
	clientsMu.RLock()
	cl, ok := clients[uid]
	clientsMu.RUnlock()
	return cl, ok
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

	go wsWritePump(cl)

	for {
		var m WSMsg
		if err := conn.ReadJSON(&m); err != nil {
			log.Println("ws read:", err)
			break
		}

		// Persist message
		if m.Type == "message" {
			var created time.Time
			err := db.DB.QueryRow(
				`INSERT INTO messages(sender_id, receiver_id, content, is_file) VALUES($1,$2,$3,false) RETURNING created_at`,
				m.SenderID, m.ReceiverID, m.Content).Scan(&created)
			if err != nil {
				log.Println("insert message:", err)
				continue
			}
			m.CreatedAt = created.UTC().Format(time.RFC3339)
		} else if m.Type == "file" {
			// file message may be created by upload endpoint; but support here too
			var created time.Time
			err := db.DB.QueryRow(
				`INSERT INTO messages(sender_id, receiver_id, is_file, file_id) VALUES($1,$2,true,$3) RETURNING created_at`,
				m.SenderID, m.ReceiverID, m.FileID).Scan(&created)
			if err != nil {
				log.Println("insert file message:", err)
				continue
			}
			m.CreatedAt = created.UTC().Format(time.RFC3339)
		}

		// deliver
		if rc, ok := getClient(m.ReceiverID); ok {
			rc.send <- m
		}
		if sc, ok := getClient(m.SenderID); ok {
			sc.send <- m
		}
	}

	removeClient(uid)
}
