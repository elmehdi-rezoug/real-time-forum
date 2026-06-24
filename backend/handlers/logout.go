package handlers

import (
	"log"
	"net/http"
	"time"
	"zone/backend/database"
)

func Logout(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/logout" {
		HandleError(w, http.StatusNotFound, "Page not found")
		return
	}

	if r.Method != http.MethodPost {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// If a session_token cookie is present, remove that session from
	// the database so the token can't be reused even if it leaked.
	cookie, err := r.Cookie("session_token")
	if err != nil {
		log.Printf("Logout: no session_token cookie on request: %v", err)
	} else {
		_, err := database.Database.Exec("DELETE FROM sessions WHERE id = ?", cookie.Value)
		if err != nil {
			log.Printf("Logout: failed to delete session %s: %v", cookie.Value, err)
		} 
	}

	expired := time.Unix(0, 0)

	// Clear the HttpOnly session cookie. This MUST happen here —
	// the frontend JS has no way to touch this cookie itself.
	http.SetCookie(w, &http.Cookie{
		Name:     "session_token",
		Value:    "",
		Path:     "/",
		Expires:  expired,
		HttpOnly: true,
		SameSite: http.SameSiteLaxMode,
	})

	w.WriteHeader(http.StatusOK)
}