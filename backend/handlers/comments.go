package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"zone/backend/database"
	"zone/backend/types"
)

// GetCommentsAPI fetches comments with pagination for a specific post.
func GetCommentsAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromSession(r)
	if err != nil {
		HandleError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}

	postID, err := strconv.Atoi(r.URL.Query().Get("post_id"))
	if err != nil || postID <= 0 {
		log.Println("Invalid post_id:", r.URL.Query().Get("post_id"))
		HandleError(w, http.StatusBadRequest, "Invalid post_id")
		return
	}

	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50
	}

	offset, err := strconv.Atoi(r.URL.Query().Get("offset"))
	if err != nil || offset < 0 {
		offset = 0
	}

	comments, err := database.GetComments(postID, userID, limit, offset)
	if err != nil {
		HandleError(w, http.StatusInternalServerError, "Database error")
		return
	}

	response := types.CommentsResponse{Comments: comments}
	RespondJSON(w, http.StatusOK, response)
}

// CreateCommentAPI handles the creation of a new comment for a specific post.
func CreateCommentAPI(w http.ResponseWriter, r *http.Request) {
	// Restrict the request method to POST
	if r.Method != http.MethodPost {
		log.Println("here", r.Method)
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// check authentication
	payload := types.CommentPayload{}
	userID, err := GetUserIDFromSession(r)
	if err != nil || userID == 0 {
		HandleError(w, http.StatusUnauthorized, "Unauthorized")
		return
	}
	payload.UserID = userID

	// Parse Payload: Read post_id and content from the request and validate them
	payload.PostID, err = strconv.Atoi(r.FormValue("post_id"))
	if err != nil || payload.PostID <= 0 {
		HandleError(w, http.StatusBadRequest, "Invalid post_id")
		return
	}
	payload.Content = strings.TrimSpace(r.FormValue("content"))
	if payload.Content == "" || len(payload.Content) > 500 {
		HandleError(w, http.StatusBadRequest, "Content cannot be empty or too long")
		return
	}

	//Foreign Key Check: Query the database to verify the post_id actually exists
	doesPostExist, err := database.DoesPostExist(payload.PostID)
	if err != nil {
		HandleError(w, http.StatusInternalServerError, "Database error")
		return
	}
	if !doesPostExist {
		HandleError(w, http.StatusBadRequest, "Post does not exist")
		return
	}

	// Database Insert: Execute the insert query
	err = database.CreateComment(payload.PostID, payload.UserID, payload.Content)

	// failed to insert comment into the database
	if err != nil {
		HandleError(w, http.StatusInternalServerError, "Database error")
		return
	}

	// Success Response: Return a success message
	RespondJSON(w, http.StatusCreated, map[string]string{"message": "Comment created successfully"})
}
