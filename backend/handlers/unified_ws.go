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

// Unified WebSocket message types
const (
	MsgTypeChat = "chat"
	MsgTypeFile = "file"
	MsgTypeP2P  = "p2p"
)

// UnifiedMessage represents any WebSocket message
type UnifiedMessage struct {
	Type       string `json:"type"`
	UserID     int    `json:"user_id"`
	ReceiverID int    `json:"receiver_id,omitempty"`
	Content    string `json:"content,omitempty"`
	FileID     int    `json:"file_id,omitempty"`
	IsFile     bool   `json:"is_file,omitempty"`
	CreatedAt  string `json:"created_at,omitempty"`

	// P2P specific fields
	ResourceID int        `json:"resource_id,omitempty"`
	PieceIndex int        `json:"piece_index,omitempty"`
	PieceData  []byte     `json:"piece_data,omitempty"`
	PeerList   []PeerInfo `json:"peer_list,omitempty"`
	SwarmStats SwarmStats `json:"swarm_stats,omitempty"`
	Data       any        `json:"data,omitempty"`
	Timestamp  time.Time  `json:"timestamp"`
}

// UnifiedClient represents a unified WebSocket client
type UnifiedClient struct {
	userID    int
	conn      *websocket.Conn
	send      chan UnifiedMessage
	resources map[int]bool // Resources this client is participating in (for P2P)
	lastPing  time.Time
	mu        sync.Mutex
}

// UnifiedManager manages all WebSocket connections
type UnifiedManager struct {
	clients    map[int]*UnifiedClient
	register   chan *UnifiedClient
	unregister chan *UnifiedClient
	broadcast  chan UnifiedMessage
	upgrader   websocket.Upgrader
	mu         sync.RWMutex
}

var unifiedManager = &UnifiedManager{
	clients:    make(map[int]*UnifiedClient),
	register:   make(chan *UnifiedClient),
	unregister: make(chan *UnifiedClient),
	broadcast:  make(chan UnifiedMessage),
	upgrader: websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for development
		},
	},
}

// StartUnifiedManager starts the unified WebSocket manager
func StartUnifiedManager() {
	go unifiedManager.run()
}

func (m *UnifiedManager) run() {
	for {
		select {
		case client := <-m.register:
			m.mu.Lock()
			m.clients[client.userID] = client
			m.mu.Unlock()
			log.Printf("Unified client connected: user %d", client.userID)

			// Send pending chat messages
			go m.sendPendingMessages(client)

			// Notify other clients about new peer (for P2P)
			message := UnifiedMessage{
				Type:      PeerConnect,
				UserID:    client.userID,
				Timestamp: time.Now(),
			}
			m.broadcastToOthers(client.userID, message)

		case client := <-m.unregister:
			m.mu.Lock()
			if _, ok := m.clients[client.userID]; ok {
				delete(m.clients, client.userID)
				close(client.send)
				log.Printf("Unified client disconnected: user %d", client.userID)

				// Notify other clients about peer disconnect (for P2P)
				message := UnifiedMessage{
					Type:      PeerDisconnect,
					UserID:    client.userID,
					Timestamp: time.Now(),
				}
				m.mu.Unlock()
				m.broadcastToOthers(client.userID, message)
			} else {
				m.mu.Unlock()
			}

		case message := <-m.broadcast:
			m.broadcastMessage(message)
		}
	}
}

func (m *UnifiedManager) broadcastMessage(message UnifiedMessage) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for userID, client := range m.clients {
		// Route message based on type
		switch message.Type {
		case MsgTypeChat, MsgTypeFile:
			// Chat messages - send to specific receiver
			if message.ReceiverID == userID {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(m.clients, userID)
				}
			}
		case PeerAnnounce, SwarmUpdate:
			// P2P messages - send to clients participating in the same resource
			client.mu.Lock()
			if client.resources[message.ResourceID] {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(m.clients, userID)
				}
			}
			client.mu.Unlock()
		case PeerConnect, PeerDisconnect:
			// Peer connection notifications - send to everyone except the peer
			if userID != message.UserID {
				select {
				case client.send <- message:
				default:
					close(client.send)
					delete(m.clients, userID)
				}
			}
		}
	}
}

func (m *UnifiedManager) broadcastToOthers(excludeUserID int, message UnifiedMessage) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	for userID, client := range m.clients {
		if userID != excludeUserID {
			select {
			case client.send <- message:
			default:
				close(client.send)
				delete(m.clients, userID)
			}
		}
	}
}

func (m *UnifiedManager) sendToUser(userID int, message UnifiedMessage) {
	m.mu.RLock()
	defer m.mu.RUnlock()

	if client, ok := m.clients[userID]; ok {
		select {
		case client.send <- message:
		default:
			close(client.send)
			delete(m.clients, userID)
		}
	}
}

func (m *UnifiedManager) sendPendingMessages(c *UnifiedClient) {
	rows, err := db.DB.Query(`
		SELECT id, sender_id, receiver_id, content, is_file, file_id, created_at
		FROM messages
		WHERE receiver_id=$1 AND delivered=false
		ORDER BY created_at ASC
	`, c.userID)
	if err != nil {
		log.Printf("Error fetching pending messages for user %d: %v", c.userID, err)
		return
	}
	defer rows.Close()

	var pendingMsgs []UnifiedMessage
	var msgIDs []int

	for rows.Next() {
		var id int
		var msg UnifiedMessage
		var fileID sql.NullInt32

		err := rows.Scan(&id, &msg.UserID, &msg.ReceiverID, &msg.Content, &msg.IsFile, &fileID, &msg.CreatedAt)
		if err != nil {
			log.Printf("Error scanning pending message: %v", err)
			continue
		}

		if fileID.Valid {
			v := int(fileID.Int32)
			msg.FileID = v
			msg.Type = MsgTypeFile
		} else {
			msg.Type = MsgTypeChat
		}
		msg.Timestamp = time.Now()

		pendingMsgs = append(pendingMsgs, msg)
		msgIDs = append(msgIDs, id)
	}

	// Send pending messages to the user
	for _, msg := range pendingMsgs {
		select {
		case c.send <- msg:
			log.Printf("Delivered pending message from %d to %d", msg.UserID, msg.ReceiverID)
		default:
			log.Printf("Channel full, skipping pending message from %d to %d", msg.UserID, msg.ReceiverID)
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
			log.Printf("Marked %d messages as delivered for user %d", len(msgIDs), c.userID)
		}
	}
}

func (c *UnifiedClient) readPump() {
	defer func() {
		unifiedManager.unregister <- c
		c.conn.Close()
	}()

	c.conn.SetReadLimit(512 * 1024) // 512KB max message size
	c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
	c.conn.SetPongHandler(func(string) error {
		c.conn.SetReadDeadline(time.Now().Add(60 * time.Second))
		c.lastPing = time.Now()
		return nil
	})

	for {
		var message UnifiedMessage
		err := c.conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("Unified WebSocket error: %v", err)
			}
			break
		}

		message.UserID = c.userID
		message.Timestamp = time.Now()
		c.handleMessage(message)
	}
}

func (c *UnifiedClient) writePump() {
	ticker := time.NewTicker(54 * time.Second)
	defer func() {
		ticker.Stop()
		c.conn.Close()
	}()

	for {
		select {
		case message, ok := <-c.send:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if !ok {
				c.conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			if err := c.conn.WriteJSON(message); err != nil {
				log.Printf("Unified WebSocket write error: %v", err)
				return
			}

		case <-ticker.C:
			c.conn.SetWriteDeadline(time.Now().Add(10 * time.Second))
			if err := c.conn.WriteMessage(websocket.PingMessage, nil); err != nil {
				return
			}
		}
	}
}

func (c *UnifiedClient) handleMessage(message UnifiedMessage) {
	switch message.Type {
	case MsgTypeChat, MsgTypeFile:
		// Handle chat messages
		c.handleChatMessage(message)
	case PeerAnnounce:
		// Handle peer announcement for a resource
		c.joinResource(message.ResourceID)

		// Update swarm stats
		stats := getSwarmStats(message.ResourceID)
		response := UnifiedMessage{
			Type:       SwarmUpdate,
			UserID:     c.userID,
			ResourceID: message.ResourceID,
			SwarmStats: stats,
			Timestamp:  time.Now(),
		}
		unifiedManager.broadcastMessage(response)

	case PieceRequest:
		// Handle piece request from another peer
		c.handlePieceRequest(message)

	case PieceResponse:
		// Handle piece response from another peer
		c.handlePieceResponse(message)

	case PeerConnect:
		// New peer connected to the swarm
		log.Printf("New peer connected: user %d", message.UserID)

	case PeerDisconnect:
		// Peer disconnected from the swarm
		log.Printf("Peer disconnected: user %d", message.UserID)
		c.leaveResource(message.ResourceID)
	}
}

func (c *UnifiedClient) handleChatMessage(message UnifiedMessage) {
	// Check if receiver is online
	receiverOnline := false
	unifiedManager.mu.RLock()
	if _, ok := unifiedManager.clients[message.ReceiverID]; ok {
		receiverOnline = true
	}
	unifiedManager.mu.RUnlock()

	// Persist message
	if message.Type == MsgTypeChat {
		var created time.Time
		err := db.DB.QueryRow(
			`INSERT INTO messages(sender_id, receiver_id, content, is_file, delivered) VALUES($1,$2,$3,false,$4) RETURNING created_at`,
			message.UserID, message.ReceiverID, message.Content, receiverOnline).Scan(&created)
		if err != nil {
			log.Println("insert message:", err)
			return
		}
		message.CreatedAt = created.UTC().Format(time.RFC3339)
	} else if message.Type == MsgTypeFile {
		// file message may be created by upload endpoint; but support here too
		var created time.Time
		err := db.DB.QueryRow(
			`INSERT INTO messages(sender_id, receiver_id, is_file, file_id, delivered) VALUES($1,$2,true,$3,$4) RETURNING created_at`,
			message.UserID, message.ReceiverID, message.FileID, receiverOnline).Scan(&created)
		if err != nil {
			log.Println("insert file message:", err)
			return
		}
		message.CreatedAt = created.UTC().Format(time.RFC3339)
	}

	// Send to unified manager for routing
	unifiedManager.broadcast <- message
}

func (c *UnifiedClient) joinResource(resourceID int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.resources == nil {
		c.resources = make(map[int]bool)
	}
	c.resources[resourceID] = true

	// Get current peers for this resource
	peers := getSwarmPeers(resourceID)
	response := UnifiedMessage{
		Type:       PeerAnnounce,
		UserID:     c.userID,
		ResourceID: resourceID,
		PeerList:   peers,
		Timestamp:  time.Now(),
	}
	unifiedManager.sendToUser(c.userID, response)
}

func (c *UnifiedClient) leaveResource(resourceID int) {
	c.mu.Lock()
	defer c.mu.Unlock()

	if c.resources != nil {
		delete(c.resources, resourceID)
	}
}

func (c *UnifiedClient) handlePieceRequest(message UnifiedMessage) {
	// In a real implementation, this would serve the requested piece
	// For now, we'll send a placeholder response
	response := UnifiedMessage{
		Type:       PieceResponse,
		UserID:     c.userID,
		ResourceID: message.ResourceID,
		PieceIndex: message.PieceIndex,
		PieceData:  []byte("piece_data_placeholder"), // Replace with actual piece data
		Timestamp:  time.Now(),
	}
	unifiedManager.sendToUser(message.UserID, response)
}

func (c *UnifiedClient) handlePieceResponse(message UnifiedMessage) {
	// Handle received piece data
	log.Printf("Received piece %d for resource %d from user %d",
		message.PieceIndex, message.ResourceID, message.UserID)
}

// HandleUnifiedWebSocket handles unified WebSocket connections for both chat and P2P
func HandleUnifiedWebSocket(w http.ResponseWriter, r *http.Request) {
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		http.Error(w, "user_id required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "invalid user_id", http.StatusBadRequest)
		return
	}

	conn, err := unifiedManager.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Unified WebSocket upgrade error: %v", err)
		return
	}

	client := &UnifiedClient{
		userID:    userID,
		conn:      conn,
		send:      make(chan UnifiedMessage, 256),
		resources: make(map[int]bool),
		lastPing:  time.Now(),
	}

	unifiedManager.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// GetOnlineUsers returns a list of online user IDs
func GetOnlineUsers() []int {
	unifiedManager.mu.RLock()
	defer unifiedManager.mu.RUnlock()

	users := make([]int, 0, len(unifiedManager.clients))
	for userID := range unifiedManager.clients {
		users = append(users, userID)
	}
	return users
}

// IsUserOnline checks if a user is currently online
func IsUserOnline(userID int) bool {
	unifiedManager.mu.RLock()
	defer unifiedManager.mu.RUnlock()

	_, ok := unifiedManager.clients[userID]
	return ok
}
