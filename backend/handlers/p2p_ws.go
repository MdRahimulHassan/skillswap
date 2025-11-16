package handlers

import (
	"encoding/json"
	"fmt"
	"log"
	"net/http"
	"strconv"
	"time"

	"github.com/gorilla/websocket"
)

// P2P WebSocket message types
const (
	PeerAnnounce   = "peer_announce"
	PieceRequest   = "piece_request"
	PieceResponse  = "piece_response"
	SwarmUpdate    = "swarm_update"
	PeerConnect    = "peer_connect"
	PeerDisconnect = "peer_disconnect"
)

// P2PMessage represents a P2P WebSocket message
type P2PMessage struct {
	Type       string      `json:"type"`
	UserID     int         `json:"user_id"`
	ResourceID int         `json:"resource_id,omitempty"`
	PieceIndex int         `json:"piece_index,omitempty"`
	PieceData  []byte      `json:"piece_data,omitempty"`
	PeerList   []PeerInfo  `json:"peer_list,omitempty"`
	SwarmStats SwarmStats  `json:"swarm_stats,omitempty"`
	Data       any      `json:"data,omitempty"`
	Timestamp  time.Time   `json:"timestamp"`
}

// P2PClient represents a P2P WebSocket client
type P2PClient struct {
	userID     int
	conn       *websocket.Conn
	send       chan P2PMessage
	resources  map[int]bool // Resources this client is participating in
	lastPing   time.Time
}

// P2PManager manages P2P WebSocket connections
type P2PManager struct {
	clients    map[int]*P2PClient
	register   chan *P2PClient
	unregister chan *P2PClient
	broadcast  chan P2PMessage
	upgrader   websocket.Upgrader
}

var p2pManager = &P2PManager{
	clients:    make(map[int]*P2PClient),
	register:   make(chan *P2PClient),
	unregister: make(chan *P2PClient),
	broadcast:  make(chan P2PMessage),
	upgrader: websocket.Upgrader{
		CheckOrigin: func(r *http.Request) bool {
			return true // Allow all origins for development
		},
	},
}

// StartP2PManager starts the P2P WebSocket manager
func StartP2PManager() {
	go p2pManager.run()
}

func (m *P2PManager) run() {
	for {
		select {
		case client := <-m.register:
			m.clients[client.userID] = client
			log.Printf("P2P client connected: user %d", client.userID)
			
			// Notify other clients about new peer
			message := P2PMessage{
				Type:      PeerConnect,
				UserID:    client.userID,
				Timestamp: time.Now(),
			}
			m.broadcastToOthers(client.userID, message)

		case client := <-m.unregister:
			if _, ok := m.clients[client.userID]; ok {
				delete(m.clients, client.userID)
				close(client.send)
				log.Printf("P2P client disconnected: user %d", client.userID)
				
				// Notify other clients about peer disconnect
				message := P2PMessage{
					Type:      PeerDisconnect,
					UserID:    client.userID,
					Timestamp: time.Now(),
				}
				m.broadcastToOthers(client.userID, message)
			}

		case message := range m.broadcast:
			m.broadcastMessage(message)
		}
	}
}

func (m *P2PManager) broadcastMessage(message P2PMessage) {
	for userID, client := range m.clients {
		// Send to clients participating in the same resource
		if client.resources[message.ResourceID] || message.Type == SwarmUpdate {
			select {
			case client.send <- message:
			default:
				close(client.send)
				delete(m.clients, userID)
			}
		}
	}
}

func (m *P2PManager) broadcastToOthers(excludeUserID int, message P2PMessage) {
	for userID, client := range m.clients {
		if userID != excludeUserID {
			select {
			case client.send <- message:
				// Message sent successfully
			default:
				close(client.send)
				delete(m.clients, userID)
			}
		}
	}
}

func (m *P2PManager) sendToUser(userID int, message P2PMessage) {
	if client, ok := m.clients[userID]; ok {
		select {
		case client.send <- message:
		default:
			close(client.send)
			delete(m.clients, userID)
		}
	}
}

func (c *P2PClient) readPump() {
	defer func() {
		p2pManager.unregister <- c
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
		var message P2PMessage
		err := c.conn.ReadJSON(&message)
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("P2P WebSocket error: %v", err)
			}
			break
		}

		message.UserID = c.userID
		message.Timestamp = time.Now()
		c.handleMessage(message)
	}
}

func (c *P2PClient) writePump() {
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
				log.Printf("P2P WebSocket write error: %v", err)
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

func (c *P2PClient) handleMessage(message P2PMessage) {
	switch message.Type {
	case PeerAnnounce:
		// Handle peer announcement for a resource
		c.joinResource(message.ResourceID)
		
		// Update swarm stats
		stats := getSwarmStats(message.ResourceID)
		response := P2PMessage{
			Type:       SwarmUpdate,
			UserID:     c.userID,
			ResourceID: message.ResourceID,
			SwarmStats: stats,
			Timestamp:  time.Now(),
		}
		p2pManager.broadcastMessage(response)

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

func (c *P2PClient) joinResource(resourceID int) {
	if c.resources == nil {
		c.resources = make(map[int]bool)
	}
	c.resources[resourceID] = true
	
	// Get current peers for this resource
	peers := getSwarmPeers(resourceID)
	response := P2PMessage{
		Type:       PeerAnnounce,
		UserID:     c.userID,
		ResourceID: resourceID,
		PeerList:   peers,
		Timestamp:  time.Now(),
	}
	p2pManager.sendToUser(c.userID, response)
}

func (c *P2PClient) leaveResource(resourceID int) {
	if c.resources != nil {
		delete(c.resources, resourceID)
	}
}

func (c *P2PClient) handlePieceRequest(message P2PMessage) {
	// In a real implementation, this would serve the requested piece
	// For now, we'll send a placeholder response
	response := P2PMessage{
		Type:       PieceResponse,
		UserID:     c.userID,
		ResourceID: message.ResourceID,
		PieceIndex: message.PieceIndex,
		PieceData:  []byte("piece_data_placeholder"), // Replace with actual piece data
		Timestamp:  time.Now(),
	}
	p2pManager.sendToUser(message.UserID, response)
}

func (c *P2PClient) handlePieceResponse(message P2PMessage) {
	// Handle received piece data
	log.Printf("Received piece %d for resource %d from user %d", 
		message.PieceIndex, message.ResourceID, message.UserID)
}

// HandleP2PWebSocket handles P2P WebSocket connections
func HandleP2PWebSocket(w http.ResponseWriter, r *http.Request) {
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

	conn, err := p2pManager.upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("P2P WebSocket upgrade error: %v", err)
		return
	}

	client := &P2PClient{
		userID:    userID,
		conn:      conn,
		send:      make(chan P2PMessage, 256),
		resources: make(map[int]bool),
		lastPing:  time.Now(),
	}

	p2pManager.register <- client

	// Start goroutines for reading and writing
	go client.writePump()
	go client.readPump()
}

// BroadcastSwarmUpdate broadcasts swarm statistics to all relevant peers
func BroadcastSwarmUpdate(resourceID int) {
	stats := getSwarmStats(resourceID)
	message := P2PMessage{
		Type:       SwarmUpdate,
		ResourceID: resourceID,
		SwarmStats: stats,
		Timestamp:  time.Now(),
	}
	p2pManager.broadcastMessage(message)
}

// NotifyPieceRequest notifies a specific peer about a piece request
func NotifyPieceRequest(fromUserID, toUserID, resourceID, pieceIndex int) {
	message := P2PMessage{
		Type:       PieceRequest,
		UserID:     fromUserID,
		ResourceID: resourceID,
		PieceIndex: pieceIndex,
		Timestamp:  time.Now(),
	}
	p2pManager.sendToUser(toUserID, message)
}

// NotifyPieceResponse notifies a peer about a piece response
func NotifyPieceResponse(fromUserID, toUserID, resourceID, pieceIndex int, pieceData []byte) {
	message := P2PMessage{
		Type:       PieceResponse,
		UserID:     fromUserID,
		ResourceID: resourceID,
		PieceIndex: pieceIndex,
		PieceData:  pieceData,
		Timestamp:  time.Now(),
	}
	p2pManager.sendToUser(toUserID, message)
}