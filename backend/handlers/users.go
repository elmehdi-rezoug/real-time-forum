package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"zone/backend/database"
)


type UserOnlineStatus struct {
	ID       int    `json:"id"`
	Nickname string `json:"nickname"`
	Online   bool   `json:"online"`
}

func GetUsersAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// exclude current user from the list
	currentUserID, err := GetUserIDFromSession(r)
	if err != nil {
		HandleError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	rows, err := database.Database.Query(
		"SELECT id, nickname FROM users WHERE id != ? ORDER BY nickname ASC",
		currentUserID,
	)
	if err != nil {
		log.Printf("GetUsersAPI: %v", err)
		HandleError(w, http.StatusInternalServerError, "Could not load users")
		return
	}
	defer rows.Close()

	users := []UserOnlineStatus{}
	for rows.Next() {
		var u UserOnlineStatus
		if err := rows.Scan(&u.ID, &u.Nickname); err != nil {
			continue
		}
		u.Online = IsOnline(u.ID) // from hub.go
		users = append(users, u)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(users)
}
