package handlers

import (
	"encoding/json"
	"net/http"
	"zone/backend/database"
)

type MeResponse struct {
	Authenticated bool   `json:"authenticated"`
	UserID        int    `json:"id,omitempty"`
	Nickname      string `json:"nickname,omitempty"`
	Email         string `json:"email,omitempty"`
}

func Me(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/me" {
	HandleError(w, http.StatusNotFound, "Not found")
	return
	}
	if r.Method != http.MethodGet {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	w.Header().Set("Content-Type", "application/json")

	userID, err := GetUserIDFromSession(r)
	if err != nil {
		json.NewEncoder(w).Encode(MeResponse{Authenticated: false})
		return
	}

	var resp MeResponse
	err = database.Database.QueryRow(
		"SELECT nickname, email FROM users WHERE id = ?",
		userID,
	).Scan(&resp.Nickname, &resp.Email)

	if err != nil {
		HandleError(w, http.StatusInternalServerError, "Server error")
		return
	}

	resp.Authenticated = true
	resp.UserID = userID

	json.NewEncoder(w).Encode(resp)
}