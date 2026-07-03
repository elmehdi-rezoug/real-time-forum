// handlers/reactions.go
package handlers

import (
	"database/sql"
	"encoding/json"
	"log"
	"net/http"
	"zone/backend/database"
)

type ReactRequest struct {
	PostID int    `json:"post_id"`
	Type   string `json:"type"` // lik or dislike
}

type ReactResponse struct {
	LikeCount    int    `json:"like_count"`
	DislikeCount int    `json:"dislike_count"`
	UserReaction string `json:"user_reaction"` // "like", "dislike", or ""
}

func ReactToPost(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromSession(r)
	if err != nil {
		HandleError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	var req ReactRequest
	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		HandleError(w, http.StatusBadRequest, "Invalid request body")
		return
	}
	if req.Type != "like" && req.Type != "dislike" {
		HandleError(w, http.StatusBadRequest, "type must be 'like' or 'dislike'")
		return
	}
	newIsLike := 0
	if req.Type == "like" {
		newIsLike = 1
	}

	// check existing reaction
	var existingIsLike int
	err = database.Database.QueryRow(
		"SELECT is_like FROM POST_REACTIONS WHERE user_id = ? AND post_id = ?",
		userID, req.PostID,
	).Scan(&existingIsLike)

	switch {
	case err == sql.ErrNoRows:
		_, err = database.Database.Exec(
			"INSERT INTO POST_REACTIONS (user_id, post_id, is_like) VALUES (?, ?, ?)",
			userID, req.PostID, newIsLike,
		)
	case err == nil && existingIsLike == newIsLike:
		_, err = database.Database.Exec(
			"DELETE FROM POST_REACTIONS WHERE user_id = ? AND post_id = ?",
			userID, req.PostID,
		)
	case err == nil:
		_, err = database.Database.Exec(
			"UPDATE POST_REACTIONS SET is_like = ? WHERE user_id = ? AND post_id = ?",
			newIsLike, userID, req.PostID,
		)
	}
	if err != nil {
		log.Printf("ReactToPost: %v", err)
		HandleError(w, http.StatusInternalServerError, "Could not save reaction")
		return
	}

	resp, err := getReactionSummary(req.PostID, userID)
	if err != nil {
		log.Printf("ReactToPost summary: %v", err)
		HandleError(w, http.StatusInternalServerError, "Could not load reaction counts")
		return
	}

	RespondJSON(w, http.StatusOK, resp)
}

// It calculates the likes and dislikes for a single post after the Like/Dislike button is pressed.
func getReactionSummary(postID, userID int) (ReactResponse, error) {
	var resp ReactResponse

	err := database.Database.QueryRow(`
		SELECT
			COALESCE(SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END), 0)
		FROM POST_REACTIONS WHERE post_id = ?`,
		postID,
	).Scan(&resp.LikeCount, &resp.DislikeCount)
	if err != nil {
		return resp, err
	}

	var userIsLike int
	err = database.Database.QueryRow(
		"SELECT is_like FROM POST_REACTIONS WHERE post_id = ? AND user_id = ?",
		postID, userID,
	).Scan(&userIsLike)

	if err == nil {
		if userIsLike == 1 {
			resp.UserReaction = "like"
		} else {
			resp.UserReaction = "dislike"
		}
	} else if err != sql.ErrNoRows {
		return resp, err
	}

	return resp, nil
}
