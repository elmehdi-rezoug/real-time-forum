package handlers

import (
	"encoding/json"
	"log"
	"net/http"
	"strconv"
	"strings"
	"zone/backend/database"
)

type PostResponse struct {
	ID           int    `json:"id"`
	Title        string `json:"title"`
	Content      string `json:"content"`
	UserID       int    `json:"user_id"`
	CategoryName string `json:"category_name"`
}

type CategoryResponse struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}


func GetPostsAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	rows, err := database.Database.Query(`
		SELECT p.id, p.title, p.content, p.user_id, c.name
		FROM posts p
		JOIN categories c ON p.category_id = c.id
		ORDER BY p.id DESC`)
	if err != nil {
		log.Printf("GetPostsAPI: %v", err)
		HandleError(w, http.StatusInternalServerError, "Database error loading posts")
		return
	}
	defer rows.Close()

	posts := []PostResponse{}
	for rows.Next() {
		var p PostResponse
		if err := rows.Scan(&p.ID, &p.Title, &p.Content, &p.UserID, &p.CategoryName); err != nil {
			continue
		}
		posts = append(posts, p)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(posts)
}

func GetCategoriesAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	rows, err := database.Database.Query("SELECT id, name FROM categories ORDER BY id ASC")
	if err != nil {
		HandleError(w, http.StatusInternalServerError, "Database error loading categories")
		return
	}
	defer rows.Close()

	categories := []CategoryResponse{}
	for rows.Next() {
		var c CategoryResponse
		if err := rows.Scan(&c.ID, &c.Name); err != nil {
			continue
		}
		categories = append(categories, c)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(categories)
}

func CreatePostAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	userID, err := GetUserIDFromSession(r)
	if err != nil {
		HandleError(w, http.StatusUnauthorized, "You must be logged in to post")
		return
	}

	title        := strings.TrimSpace(r.FormValue("title"))
	content      := strings.TrimSpace(r.FormValue("content"))
	categoryIDStr := r.FormValue("category_id")

	if title == "" || content == "" || categoryIDStr == "" {
		HandleError(w, http.StatusBadRequest, "All fields are required")
		return
	}

	categoryID, err := strconv.Atoi(categoryIDStr)
	if err != nil {
		HandleError(w, http.StatusBadRequest, "Invalid category selection")
		return
	}

	result, err := database.Database.Exec(
		"INSERT INTO posts (title, content, user_id, category_id) VALUES (?, ?, ?, ?)",
		title, content, userID, categoryID,
	)
	if err != nil {
		log.Printf("CreatePostAPI insert: %v", err)
		HandleError(w, http.StatusInternalServerError, "Failed to create post")
		return
	}

	// broadcast new post to all connected clients via WebSocket
	postID, _ := result.LastInsertId()
	var post PostResponse
	err = database.Database.QueryRow(`
		SELECT p.id, p.title, p.content, p.user_id, c.name
		FROM posts p JOIN categories c ON p.category_id = c.id
		WHERE p.id = ?`, postID,
	).Scan(&post.ID, &post.Title, &post.Content, &post.UserID, &post.CategoryName)
	if err == nil {
		BroadcastNewPost(post)
	}

	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(http.StatusCreated)
	json.NewEncoder(w).Encode(map[string]string{"message": "Post created successfully!"})
}