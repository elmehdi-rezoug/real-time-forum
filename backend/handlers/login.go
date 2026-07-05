package handlers

import (
	"net/http"
	"strings"
	"time"
	"zone/backend/database"

	"github.com/google/uuid"
	"golang.org/x/crypto/bcrypt"
)

func Login(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/login" {
		HandleError(w, http.StatusNotFound, "Page not found")
		return
	}

	switch r.Method {
		case http.MethodGet:
		http.ServeFile(w, r, "./frontend/index.html")
		return
	case http.MethodPost:
		identifier := strings.TrimSpace(r.FormValue("login"))
		password   := r.FormValue("password")

		if identifier == "" || password == "" {
			HandleError(w, http.StatusBadRequest, "Email/username and password are required")
			return
		}

		var userID int
		var hashedPassword string
		err := database.Database.QueryRow(
			"SELECT id, password FROM users WHERE email = ? OR nickname = ?",
			identifier, identifier,
		).Scan(&userID, &hashedPassword)
		if err != nil {
			HandleError(w, http.StatusUnauthorized, "Invalid email/username or password")
			return
		}

		if err = bcrypt.CompareHashAndPassword([]byte(hashedPassword), []byte(password)); err != nil {
			HandleError(w, http.StatusUnauthorized, "Invalid email/username or password")
			return
		}

		// kick any existing WS connections for this user BEFORE deleting sessions
		
		KickUser(userID)

		// delete old sessions from DB
		_, err = database.Database.Exec("DELETE FROM sessions WHERE user_id = ?", userID)
		if err != nil {
			HandleError(w, http.StatusInternalServerError, "Server error")
			return
		}

		// create new session
		sessionID := uuid.New().String()
		expiration := time.Now().Add(24 * time.Hour)
		_, err = database.Database.Exec(
			"INSERT INTO sessions (id, expires_at, user_id) VALUES (?, ?, ?)",
			sessionID, expiration, userID,
		)
		if err != nil {
			HandleError(w, http.StatusInternalServerError, "Server error")
			return
		}

		database.UpdateLastSeen(userID)

		http.SetCookie(w, &http.Cookie{
			Name:     "session_token",
			Value:    sessionID,
			Path:     "/",
			Expires:  expiration,
			HttpOnly: true,
			SameSite: http.SameSiteLaxMode,
		})

		RespondJSON(w, http.StatusOK, map[string]string{"message": "login successfully"})

	default:
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}