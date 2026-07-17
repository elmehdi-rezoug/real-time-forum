package handlers

import (
	"log"
	"net/http"
	"sync"
	"time"

	"github.com/gorilla/websocket"
)

var (
	clientsMu sync.Mutex
	clients   = make(map[int][]*websocket.Conn)
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

	clientsMu.Lock()
	clients[userID] = append(clients[userID], conn)
	clientsMu.Unlock()

	go readPump(userID, conn)
	go writePump(userID, conn)
}

// readPump listens for incoming WebSocket messages and keeps the connection alive until it closes.
func readPump(userID int, conn *websocket.Conn) {
	defer cleanupConnection(userID, conn)

	for {
		_, _, err := conn.ReadMessage()
		if err != nil {
			return
		}
	}
}

// writePump sends periodic WebSocket ping frames and detects when the connection is no longer available.
func writePump(userID int, conn *websocket.Conn) {
	defer cleanupConnection(userID, conn)

	for {
		if err := conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(time.Second)); err != nil {
			return
		}
		time.Sleep(30 * time.Second)
	}
}

// cleanupConnection removes the WebSocket from the client registry and closes the connection.
func cleanupConnection(userID int, conn *websocket.Conn) {
	removeClient(userID, conn)
	conn.Close()
}

// removeClient removes a closed connection from the user's list of active WebSocket connections.
func removeClient(userID int, conn *websocket.Conn) {
	clientsMu.Lock()
	defer clientsMu.Unlock()

	conns := clients[userID]
	filtered := make([]*websocket.Conn, 0, len(conns))
	for _, existing := range conns {
		if existing != conn {
			filtered = append(filtered, existing)
		}
	}

	if len(filtered) == 0 {
		delete(clients, userID)
		return
	}

	clients[userID] = filtered
}
