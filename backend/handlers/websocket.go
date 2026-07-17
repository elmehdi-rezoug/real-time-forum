package handlers

// WebSocket connection manager and status broadcaster
//
// Implements:
// - HTTP -> WebSocket upgrade for authenticated users
// - per-user multi-tab connection registry (map[userID][]*wsClient)
// - simple read/write pumps (connection lifecycle, pings)
// - broadcast of user_online/user_offline events to connected clients

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"
	"time"

	"zone/backend/database"
	"zone/backend/types"

	"github.com/gorilla/websocket"
)

type wsClient struct {
	conn *websocket.Conn
	mu   sync.Mutex
}

type historyRequest struct {
	Type      string `json:"type"`
	PartnerID int    `json:"partner_id"`
	Offset    int    `json:"offset"`
}

type historyResponse struct {
	Type     string          `json:"type"`
	Messages []types.Message `json:"messages"`
	Offset   int             `json:"offset"`
	HasMore  bool            `json:"has_more"`
}

func (c *wsClient) sendJSON(v interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	err := c.conn.WriteJSON(v)
	return err
}

var (
	clientsMu sync.Mutex
	clients   = make(map[int][]*wsClient)
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// HandleWebSocket validates the session, upgrades the HTTP request to a WebSocket,
// and registers the new connection under the authenticated user ID.
func HandleWebSocket(w http.ResponseWriter, r *http.Request) {
	userID, err := GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Println("websocket upgrade failed:", err)
		return
	}

	ws := &wsClient{conn: conn}
	clientsMu.Lock()
	connected := len(clients[userID]) > 0
	clients[userID] = append(clients[userID], ws)
	clientsMu.Unlock()

	if !connected {
		broadcastStatusChange(userID, "user_online")
	}

	go readPump(userID, ws)
	go writePump(userID, ws)
}

// readPump listens for incoming WebSocket messages and keeps the connection alive until it closes.
func readPump(userID int, client *wsClient) {
	defer cleanupConnection(userID, client)

	for {
		_, message, err := client.conn.ReadMessage()
		if err != nil {
			return
		}
		if err := handleIncomingMessage(userID, client, message); err != nil {
			log.Println("handleIncomingMessage:", err)
		}
	}
}

// handleIncomingMessage is the WebSocket entry point for incoming message events.
// It currently handles history requests, and it can be extended later for other message types.
func handleIncomingMessage(userID int, client *wsClient, payload []byte) error {
	var req historyRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return err
	}
	if req.Type != "get_history" {
		return nil
	}
	if req.PartnerID == 0 {
		return nil
	}

	offset := req.Offset
	if offset < 0 {
		offset = 0
	}

	messages, hasMore, err := database.GetMessages(userID, req.PartnerID, 10, offset)
	if err != nil {
		return err
	}

	response := historyResponse{
		Type:     "history_response",
		Messages: messages,
		Offset:   offset,
		HasMore:  hasMore,
	}

	return client.sendJSON(response)
}

// writePump sends periodic WebSocket ping frames and detects when the connection is no longer available.
func writePump(userID int, client *wsClient) {
	defer cleanupConnection(userID, client)

	for {
		client.mu.Lock()
		err := client.conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(time.Second))
		client.mu.Unlock()
		if err != nil {
			return
		}
		time.Sleep(30 * time.Second)
	}
}

// cleanupConnection removes the WebSocket from the client registry and closes the connection.
func cleanupConnection(userID int, client *wsClient) {
	last := removeClient(userID, client)
	client.conn.Close()
	if last {
		broadcastStatusChange(userID, "user_offline")
	}
}

// broadcastStatusChange sends an online/offline event to every connected client.
func broadcastStatusChange(userID int, status string) {
	payload := types.WebSocketPayload{Type: status, UserID: userID}

	clientsMu.Lock()
	allClients := make([]*wsClient, 0)
	for _, conns := range clients {
		allClients = append(allClients, conns...)
	}
	clientsMu.Unlock()

	for _, c := range allClients {
		if err := c.sendJSON(payload); err != nil {
			log.Println("broadcastStatusChange:", err)
		}
	}
}

// removeClient removes a closed connection from the user's list of active WebSocket connections.
func removeClient(userID int, client *wsClient) bool {
	clientsMu.Lock()
	defer clientsMu.Unlock()

	conns := clients[userID]
	filtered := make([]*wsClient, 0, len(conns))
	for _, existing := range conns {
		if existing != client {
			filtered = append(filtered, existing)
		}
	}

	if len(filtered) == 0 {
		delete(clients, userID)
		return true
	}

	clients[userID] = filtered
	return false
}
