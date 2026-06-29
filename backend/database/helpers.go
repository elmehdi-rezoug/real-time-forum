package database

import "log"

// UpdateLastSeen updates the last_seen timestamp for the given user.
// Shared by handlers (login) and middleware (auth).
func UpdateLastSeen(userID int) {
	_, err := Database.Exec(
		"UPDATE users SET last_seen = CURRENT_TIMESTAMP WHERE id = ?", userID,
	)
	if err != nil {
		log.Println("UpdateLastSeen:", err)
	}
}
