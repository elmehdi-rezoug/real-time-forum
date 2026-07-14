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

// connected clients: userID → single conn (one session per user)
var (
	mu    sync.Mutex
	conns = map[int]*websocket.Conn{}
)

type wsMsg struct {
	Type  string             `json:"type"`
	Users []UserOnlineStatus `json:"users,omitempty"`
}

// ---- ServeWS --------------------------------------------------------

func ServeWS(w http.ResponseWriter, r *http.Request) {
	
	userID, err := GetUserIDFromSession(r)
	if err != nil {
		HandleError(w, http.StatusUnauthorized, "unauthorized")
		return
	}
	
	conn, err := upgrader.Upgrade(w, r, nil)

	if err != nil {
		log.Printf("[ws] upgrade: %v", err)
		return
	}

	mu.Lock()
	// if this user already has a connection open 
	if old, ok := conns[userID]; ok {
		old.Close()
	}

	conns[userID] = conn
	mu.Unlock()

	broadcastUsers()

	// read loop — just to detect disconnect
	for {
		if _, _, err := conn.ReadMessage(); err != nil {
			break
		}
	}

	mu.Lock()
	if c, ok := conns[userID]; ok && c == conn {
			log.Println("Deleting user:", userID)
		delete(conns, userID)
	}
	mu.Unlock()

	conn.Close()
	broadcastUsers()
}

// ---- broadcast helpers ----------------------------------------------

func broadcastAll(v wsMsg) {
	data, _ := json.Marshal(v)
	mu.Lock()
	defer mu.Unlock()
	for _, c := range conns {
		c.WriteMessage(websocket.TextMessage, data)
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
		_, u.Online = conns[u.ID]
		mu.Unlock()
		users = append(users, u)
	}

	broadcastAll(wsMsg{Type: "users", Users: users})
}



// KickUser — sends session_kicked to a user's connection then closes it
func KickUser(userID int) {
	data, _ := json.Marshal(map[string]string{"type": "session_kicked"})
	mu.Lock()
	defer mu.Unlock()
	if c, ok := conns[userID]; ok {
		c.WriteMessage(websocket.TextMessage, data)
		c.Close()
		delete(conns, userID)
	}
}

// IsOnline — used by GetUsersAPI REST fallback
func IsOnline(userID int) bool {
	mu.Lock()
	defer mu.Unlock()
	_, ok := conns[userID]
	return ok
}