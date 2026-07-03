package handlers

import (
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
	Nickname     string `json:"nickname"`
	CategoryName string `json:"category_name"`
	LikeCount    int    `json:"like_count"`
	DislikeCount int    `json:"dislike_count"`
	UserReaction string `json:"user_reaction,omitempty"` // like | dislike | ""
}
type CategoryResponse struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// fetch all posts when the page loads with like and deslik for all posts
func GetPostsAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}
	userID, _ := GetUserIDFromSession(r)

	rows, err := database.Database.Query(`
		SELECT
    p.id,
    p.title,
    p.content,
    p.user_id,
    u.nickname,
    c.name,
    COALESCE(SUM(CASE WHEN pr.is_like = 1 THEN 1 ELSE 0 END), 0) AS like_count,
    COALESCE(SUM(CASE WHEN pr.is_like = 0 THEN 1 ELSE 0 END), 0) AS dislike_count
		FROM posts p
		JOIN users u ON p.user_id = u.id
		JOIN categories c ON p.category_id = c.id
		LEFT JOIN post_reactions pr ON pr.post_id = p.id
		GROUP BY p.id
		ORDER BY p.id DESC
		`)
	if err != nil {
		log.Printf("GetPostsAPI: %v", err)
		HandleError(w, http.StatusInternalServerError, "Database error loading posts")
		return
	}
	defer rows.Close()

	posts := []PostResponse{}
	for rows.Next() {
		var p PostResponse
		if err := rows.Scan(&p.ID, &p.Title, &p.Content, &p.UserID, &p.Nickname, &p.CategoryName,
			&p.LikeCount, &p.DislikeCount); err != nil {
			continue
		}
		posts = append(posts, p)
	}

	if userID != 0 {
		reactRows, err := database.Database.Query(
			"SELECT post_id, is_like FROM POST_REACTIONS WHERE user_id = ?", userID)
		if err == nil {
			defer reactRows.Close()
			userReactions := map[int]int{}
			for reactRows.Next() {
				var postID, isLike int
				if scanErr := reactRows.Scan(&postID, &isLike); scanErr == nil {
					userReactions[postID] = isLike
				}
			}
			for i := range posts {
				if v, ok := userReactions[posts[i].ID]; ok {
					if v == 1 {
						posts[i].UserReaction = "like"
					} else {
						posts[i].UserReaction = "dislike"
					}
				}
			}
		}
	}

	RespondJSON(w, http.StatusOK, posts)
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

	RespondJSON(w, http.StatusOK, categories)
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

	title := strings.TrimSpace(r.FormValue("title"))
	content := strings.TrimSpace(r.FormValue("content"))
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
	postID, err := result.LastInsertId()
	if err != nil {
		HandleError(w, http.StatusInternalServerError, "Could not get new post ID")
		return
	}
	var post PostResponse
	err = database.Database.QueryRow(`
		SELECT
    p.id,
    p.title,
    p.content,
    p.user_id,
    u.nickname,
    c.name
		FROM posts p
		JOIN users u ON p.user_id = u.id
		JOIN categories c ON p.category_id = c.id
		WHERE p.id = ?`, postID,
	).Scan(&post.ID, &post.Title, &post.Content, &post.UserID, &post.Nickname, &post.CategoryName)
	if err == nil {
		BroadcastNewPost(post)
	}

	RespondJSON(w, http.StatusCreated, map[string]string{"message": "Post created successfully!"})
}
