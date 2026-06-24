package handlers
import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"zone/backend/database"
)

type MeResponse struct {
	Authenticated bool   `json:"authenticated"`
	UserID        int    `json:"user_id,omitempty"`
	Nickname      string `json:"nickname,omitempty"`
	Email         string `json:"email,omitempty"`
}

func Me(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/api/me" {
		sendJSONError(w, http.StatusNotFound, "Not found")
		return
	}
	if r.Method != http.MethodGet {
		sendJSONError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	w.Header().Set("Content-Type", "application/json")

	cookie, err := r.Cookie("session_token")
	if err != nil {
		json.NewEncoder(w).Encode(MeResponse{Authenticated: false})
		return
	}

	var resp MeResponse
	query := `
		SELECT u.id, u.nickname, u.email
		FROM sessions s
		JOIN users u ON s.user_id = u.id
		WHERE s.id = ? AND s.expires_at > DATETIME('now')`

	err = database.Database.QueryRow(query, cookie.Value).
		Scan(&resp.UserID, &resp.Nickname, &resp.Email)

	if err == sql.ErrNoRows {
		json.NewEncoder(w).Encode(MeResponse{Authenticated: false})
		return
	}
	if err != nil {
		log.Printf("Me: db error: %v", err)
		sendJSONError(w, http.StatusInternalServerError, "Server error")
		return
	}

	resp.Authenticated = true
	json.NewEncoder(w).Encode(resp)
}