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
	"errors"
	"log"
	"net/http"
	"strings"
	"sync"
	"time"

	"zone/backend/database"
	"zone/backend/types"

	"github.com/gorilla/websocket"
)

// wsClient wraps a WebSocket connection with a write mutex and a once-only cleanup guard.
type wsClient struct {
	conn *websocket.Conn
	mu   sync.Mutex
	once sync.Once
}

// WebSocket tuning constants.
const (
	messageHistoryPageSize = 10  // messages returned per history page
	maxMessageLength       = 500 // max UTF-8 bytes per message
	pingInterval           = 30 * time.Second
	pingWriteDeadline      = time.Second
)

// historyRequest is sent by the client to fetch a page of past messages.
type historyRequest struct {
	Type      string `json:"type"`
	PartnerID int    `json:"partner_id"`
	Offset    int    `json:"offset"`
}

// chatMessageRequest is sent by the client to deliver a private message.
type chatMessageRequest struct {
	Type       string `json:"type"`
	SenderID   int    `json:"sender_id"`
	ReceiverID int    `json:"receiver_id"`
	Content    string `json:"content"`
}

// historyResponse is returned to the client with a page of message history.
type historyResponse struct {
	Type     string          `json:"type"`
	Messages []types.Message `json:"messages"`
	Offset   int             `json:"offset"`
	HasMore  bool            `json:"has_more"`
}

// socketErrorResponse is sent to the client when a request cannot be fulfilled.
type socketErrorResponse struct {
	Type    string `json:"type"`
	Message string `json:"message"`
}

// sendJSON serialises v and writes it to the connection under the write lock.
func (c *wsClient) sendJSON(v interface{}) error {
	c.mu.Lock()
	defer c.mu.Unlock()
	err := c.conn.WriteJSON(v)
	return err
}

// clients maps each authenticated user ID to their open WebSocket connections.
// A user may have multiple connections open simultaneously (multi-tab).
var (
	clientsMu sync.Mutex
	clients   = make(map[int][]*wsClient)
)

// upgrader upgrades HTTP connections to WebSocket. Origin check is permissive for now.
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
// It currently handles history requests and chat-message routing.
func handleIncomingMessage(userID int, client *wsClient, payload []byte) error {
	envelope, err := parseEnvelope(payload)
	if err != nil {
		return sendSocketError(client, "invalid websocket payload")
	}

	switch envelope.Type {
	case "get_history":
		return handleHistoryRequest(userID, client, payload)
	case "send_message":
		return handleSendMessage(userID, client, payload)
	default:
		return sendSocketError(client, "unknown type")
	}
}

// parseEnvelope extracts only the message type from a raw WebSocket payload.
func parseEnvelope(payload []byte) (struct {
	Type string `json:"type"`
}, error) {
	var envelope struct {
		Type string `json:"type"`
	}
	if err := json.Unmarshal(payload, &envelope); err != nil {
		return envelope, err
	}
	return envelope, nil
}

// parseHistoryPayload decodes a raw payload into a historyRequest.
func parseHistoryPayload(payload []byte) (historyRequest, error) {
	var req historyRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return historyRequest{}, err
	}
	return req, nil
}

// handleHistoryRequest validates and serves a paginated message history response.
func handleHistoryRequest(userID int, client *wsClient, payload []byte) error {
	req, err := parseHistoryPayload(payload)
	if err != nil {
		return sendSocketError(client, "invalid history payload")
	}

	if err := validateHistoryRequest(req); err != nil {
		return sendSocketError(client, err.Error())
	}

	messages, hasMore, err := database.GetMessages(userID, req.PartnerID, messageHistoryPageSize, req.Offset)
	if err != nil {
		log.Println("GetMessages:", err)
		return sendSocketError(client, "history load failed")
	}

	response := historyResponse{
		Type:     "history_response",
		Messages: messages,
		Offset:   req.Offset,
		HasMore:  hasMore,
	}

	return client.sendJSON(response)
}

// handleSendMessage validates, persists, and fans out a new private message.
func handleSendMessage(userID int, client *wsClient, payload []byte) error {
	req, err := parseChatMessagePayload(payload)
	if err != nil {
		return sendSocketError(client, "invalid message payload")
	}

	// Validate that the sender_id from the payload matches the authenticated user
	if req.SenderID != userID {
		return sendSocketError(client, "sender_id mismatch")
	}

	content, err := validateChatMessageRequest(userID, req)
	if err != nil {
		return sendSocketError(client, err.Error())
	}

	messageID, err := database.InsertMessage(userID, req.ReceiverID, content)
	if err != nil {
		log.Println("InsertMessage:", err)
		return sendSocketError(client, "message persist failed")
	}

	message, err := database.GetMessageByID(messageID)
	if err != nil {
		log.Println("GetMessageByID:", err)
		return sendSocketError(client, "message load failed")
	}

	payloadToSend := types.WebSocketPayload{
		Type:    "new_message",
		Message: &message,
	}
	broadcastToUsers(payloadToSend, userID, req.ReceiverID)

	return nil
}

// validateHistoryRequest checks that the history request fields are in range.
func validateHistoryRequest(req historyRequest) error {
	if req.PartnerID <= 0 {
		return errors.New("invalid partner_id")
	}
	if req.Offset < 0 {
		return errors.New("invalid offset")
	}
	return nil
}

// validateChatMessageRequest checks the message request and returns the trimmed content.
func validateChatMessageRequest(senderID int, req chatMessageRequest) (string, error) {
	if req.SenderID <= 0 {
		return "", errors.New("invalid sender_id")
	}
	if req.ReceiverID <= 0 {
		return "", errors.New("invalid receiver_id")
	}
	if req.ReceiverID == req.SenderID {
		return "", errors.New("self message blocked")
	}

	content := strings.TrimSpace(req.Content)
	if content == "" {
		return "", errors.New("content is required")
	}
	if len(content) > maxMessageLength {
		return "", errors.New("content too long")
	}

	return content, nil
}

// sendSocketError sends a structured error event to the client.
func sendSocketError(client *wsClient, message string) error {
	return client.sendJSON(socketErrorResponse{
		Type:    "error",
		Message: message,
	})
}

// parseChatMessagePayload decodes a raw payload into a chatMessageRequest.
func parseChatMessagePayload(payload []byte) (chatMessageRequest, error) {
	var req chatMessageRequest
	if err := json.Unmarshal(payload, &req); err != nil {
		return chatMessageRequest{}, err
	}
	return req, nil
}

// writePump sends periodic WebSocket ping frames and detects when the connection is no longer available.
func writePump(userID int, client *wsClient) {
	defer cleanupConnection(userID, client)

	for {
		client.mu.Lock()
		err := client.conn.WriteControl(websocket.PingMessage, []byte{}, time.Now().Add(pingWriteDeadline))
		client.mu.Unlock()
		if err != nil {
			return
		}
		time.Sleep(pingInterval)
	}
}

// cleanupConnection removes the WebSocket from the client registry and closes the connection.
func cleanupConnection(userID int, client *wsClient) {
	client.once.Do(func() {
		last := removeClient(userID, client)
		client.conn.Close()
		if last {
			broadcastStatusChange(userID, "user_offline")
		}
	})
}

// broadcastStatusChange sends an online/offline event to every connected client.
func broadcastStatusChange(userID int, status string) {
	nickname, err := getNicknameByUserID(userID)
	if err != nil {
		log.Println("getNicknameByUserID:", err)
	}

	payload := types.WebSocketPayload{Type: status, UserID: userID, Nickname: nickname}
	broadcastToUsers(payload)
}

// getNicknameByUserID returns a user's nickname for status events.
func getNicknameByUserID(userID int) (string, error) {
	var nickname string
	err := database.Database.QueryRow("SELECT nickname FROM users WHERE id = ?", userID).Scan(&nickname)
	if err != nil {
		return "", err
	}
	return nickname, nil
}

// broadcastToUsers sends a payload to all open connections for the given user IDs.
// If no IDs are provided, it broadcasts to every connected client.
func broadcastToUsers(payload types.WebSocketPayload, userIDs ...int) {
	clientsMu.Lock()
	allClients := make([]*wsClient, 0)
	if len(userIDs) == 0 {
		for _, conns := range clients {
			for _, conn := range conns {
				allClients = append(allClients, conn)
			}
		}
	} else {
		for _, userID := range userIDs {
			for _, conn := range clients[userID] {
				allClients = append(allClients, conn)
			}
		}
	}
	clientsMu.Unlock()

	for _, c := range allClients {
		if err := c.sendJSON(payload); err != nil {
			log.Println("broadcastToUsers:", err)
		}
	}
}

// removeClient removes the given connection from the user's connection list.
// Returns true if this was the user's last connection.
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

// DisconnectUserSockets force-closes all active websocket connections for a user.
// Used by logout to immediately broadcast offline status.
func DisconnectUserSockets(userID int) {
	clientsMu.Lock()
	conns := append([]*wsClient(nil), clients[userID]...)
	clientsMu.Unlock()

	for _, client := range conns {
		cleanupConnection(userID, client)
	}
}
