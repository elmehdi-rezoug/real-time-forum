package handlers

import (
	"net/http"
	"zone/backend/database"
)

type UserListItem struct {
	ID       int    `json:"id"`
	Nickname string `json:"nickname"`
	LastSeen string `json:"last_seen"`
	Online   bool   `json:"online"`
}

// HandleGetUsers returns users sorted by last activity with online status.
func HandleGetUsers(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	users, err := database.GetUsersByLastSeen()
	if err != nil {
		HandleError(w, http.StatusInternalServerError, "Database error")
		return
	}

	onlineByUserID := make(map[int]bool)
	clientsMu.Lock()
	for userID, conns := range clients {
		onlineByUserID[userID] = len(conns) > 0
	}
	clientsMu.Unlock()

	response := make([]UserListItem, 0, len(users))
	for _, user := range users {
		response = append(response, UserListItem{
			ID:       user.UserID,
			Nickname: user.Nickname,
			LastSeen: user.LastSeen,
			Online:   onlineByUserID[user.UserID],
		})
	}

	RespondJSON(w, http.StatusOK, response)
}
