package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"sync"

	"zone/backend/database"

	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool { return true },
}

// connected clients: userID → list of conns (multiple tabs)
var (
	mu    sync.Mutex
	conns = map[int][]*websocket.Conn{}
)

type wsMsg struct {
	Type  string             `json:"type"`
	Users []UserOnlineStatus `json:"users,omitempty"`
	Post  *PostResponse      `json:"post,omitempty"`
}

// ---- ServeWS --------------------------------------------------------

func ServeWS(w http.ResponseWriter, r *http.Request) {
	userID, err := GetUserIDFromSession(r)
	if err != nil {
		http.Error(w, "unauthorized", http.StatusUnauthorized)
		return
	}

	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("[ws] upgrade: %v", err)
		return
	}

	mu.Lock()
	conns[userID] = append(conns[userID], conn)
	mu.Unlock()

	log.Printf("[ws] user %d connected", userID)
	broadcastUsers()

	// read loop — just to detect disconnect
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}

	mu.Lock()
	list := conns[userID]
	for i, c := range list {
		if c == conn {
			conns[userID] = append(list[:i], list[i+1:]...)
			break
		}
	}
	if len(conns[userID]) == 0 {
		delete(conns, userID)
	}
	mu.Unlock()

	conn.Close()
	log.Printf("[ws] user %d disconnected", userID)
	broadcastUsers()
}

// ---- broadcast helpers ----------------------------------------------

func broadcastAll(v wsMsg) {
	data, _ := json.Marshal(v)
	mu.Lock()
	defer mu.Unlock()
	for _, list := range conns {
		for _, c := range list {
			c.WriteMessage(websocket.TextMessage, data)
		}
	}
}

func broadcastUsers() {
	rows, err := database.Database.Query("SELECT id, nickname FROM users ORDER BY nickname ASC")
	if err != nil {
		log.Printf("[ws] broadcastUsers: %v", err)
		return
	}
	defer rows.Close()

	var users []UserOnlineStatus
	for rows.Next() {
		var u UserOnlineStatus
		if err := rows.Scan(&u.ID, &u.Nickname); err != nil {
			continue
		}
		mu.Lock()
		u.Online = len(conns[u.ID]) > 0
		mu.Unlock()
		users = append(users, u)
	}

	broadcastAll(wsMsg{Type: "users", Users: users})
}

// BroadcastNewPost — called from CreatePostAPI after insert
func BroadcastNewPost(post PostResponse) {
	broadcastAll(wsMsg{Type: "new_post", Post: &post})
}

// KickUser — sends session_kicked to all connections of a user then closes them
func KickUser(userID int) {
	data, _ := json.Marshal(map[string]string{"type": "session_kicked"})
	mu.Lock()
	defer mu.Unlock()
	for _, c := range conns[userID] {
		c.WriteMessage(websocket.TextMessage, data)
		c.Close()
	}
	delete(conns, userID)
}

// IsOnline — used by GetUsersAPI REST fallback
func IsOnline(userID int) bool {
	mu.Lock()
	defer mu.Unlock()
	return len(conns[userID]) > 0
}