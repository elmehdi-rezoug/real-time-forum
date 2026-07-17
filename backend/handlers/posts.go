package handlers

import (
	"log"
	"net/http"
	"strconv"
	"strings"
	"zone/backend/database"
)

type PostResponse struct {
	ID           int      `json:"id"`
	Title        string   `json:"title"`
	Content      string   `json:"content"`
	UserID       int      `json:"user_id"`
	Nickname     string   `json:"nickname"`
	Categories   []string `json:"categories"`
	LikeCount    int      `json:"like_count"`
	DislikeCount int      `json:"dislike_count"`
	UserReaction string   `json:"user_reaction,omitempty"` // like | dislike | ""
}
type CategoryResponse struct {
	ID   int    `json:"id"`
	Name string `json:"name"`
}

// It also checks if the user liked or disliked them GetPostsAPI fetches all posts to show on the page.
func GetPostsAPI(w http.ResponseWriter, r *http.Request) {
	// 1. Check if the request is a GET request. If not, return an error.
	if r.Method != http.MethodGet {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	// 2. See who is asking for the posts. If no one is logged in, userID is 0.
	userID, _ := GetUserIDFromSession(r)

	// 3. Set up limits for pagination (how many posts to show at once).
	// Default limit is 10 posts. Maximum is 50.
	limit, err := strconv.Atoi(r.URL.Query().Get("limit"))
	if err != nil || limit <= 0 {
		limit = 10
	}
	if limit > 50 {
		limit = 50 // sane upper bound
	}

	// Default offset is 0 start from the first post
	offset, err := strconv.Atoi(r.URL.Query().Get("offset"))
	if err != nil || offset < 0 {
		offset = 0
	}

	beforeStr := r.URL.Query().Get("before")
	var beforeID int
	if beforeStr != "" {
		beforeID, err = strconv.Atoi(beforeStr)
		if err != nil || beforeID <= 0 {
			HandleError(w, http.StatusBadRequest, "Invalid before id")
			return
		}
	}

	// 4. Check if the user wants to filter by categories.
	categories := r.URL.Query()["category"]

	var whereConditions []string
	args := []interface{}{}

	if beforeStr != "" {
		whereConditions = append(whereConditions, "p.id <= ?")
		args = append(args, beforeID)
	}

	if len(categories) > 0 {
		// If there are categories, create a filter for the database query.
		placeholders := strings.TrimSuffix(strings.Repeat("?,", len(categories)), ",")
		whereConditions = append(whereConditions,
			"EXISTS (SELECT * FROM post_categories pc3 JOIN categories c3 ON pc3.category_id = c3.id WHERE pc3.post_id = p.id AND c3.name IN ("+placeholders+"))")
		for _, cat := range categories {
			args = append(args, cat)
		}
	}

	whereClause := ""
	if len(whereConditions) > 0 {
		whereClause = "WHERE " + strings.Join(whereConditions, " AND ")
	}

	args = append(args, limit, offset)

	// 5. Ask the database for the posts, their categories, and the total number of likes/dislikes.
	rows, err := database.Database.Query(`
		SELECT
    p.id,
    p.title,
    p.content,
    p.user_id,
    u.nickname,
    (SELECT GROUP_CONCAT(c2.name) FROM post_categories pc2 JOIN categories c2 ON pc2.category_id = c2.id WHERE pc2.post_id = p.id) AS categories,
    COALESCE(SUM(CASE WHEN pr.is_like = 1 THEN 1 ELSE 0 END), 0) AS like_count,
    COALESCE(SUM(CASE WHEN pr.is_like = 0 THEN 1 ELSE 0 END), 0) AS dislike_count
		FROM posts p
		JOIN users u ON p.user_id = u.id
		LEFT JOIN post_reactions pr ON pr.post_id = p.id
		`+whereClause+`
		GROUP BY p.id
		ORDER BY p.id DESC
		LIMIT ? OFFSET ?
		`, args...)
	if err != nil {
		log.Printf("GetPostsAPI: %v", err)
		HandleError(w, http.StatusInternalServerError, "Database error loading posts")
		return
	}
	defer rows.Close()

	// 6. Read the posts from the database and put them in a list.
	posts := []PostResponse{}
	for rows.Next() {
		var p PostResponse
		var categoriesStr string

		if err := rows.Scan(
			&p.ID,
			&p.Title,
			&p.Content,
			&p.UserID,
			&p.Nickname,
			&categoriesStr,
			&p.LikeCount,
			&p.DislikeCount,
		); err != nil {
			continue
		}
		p.Categories = strings.Split(categoriesStr, ",")
		posts = append(posts, p)
	}

	// 7. If the user is logged in, find out which posts they liked or disliked.
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

			// Update each post with the user's reaction ("like" or "dislike").
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

	// 7b. First page only: report the current newest post id so the client
	if beforeStr == "" {
		var maxID int
		if err := database.Database.QueryRow("SELECT COALESCE(MAX(id), 0) FROM posts").Scan(&maxID); err == nil {
			w.Header().Set("X-Max-Post-Id", strconv.Itoa(maxID))
		}
	}

	// 8. Send the final list of posts back to the web browser.
	RespondJSON(w, http.StatusOK, posts)
}

// GetPostByIDAPI fetches a single post by id from /api/posts/{id}.
func GetPostByIDAPI(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
		return
	}

	idStr := r.PathValue("id")
	postID, err := strconv.Atoi(idStr)
	if err != nil || postID <= 0 {
		HandleError(w, http.StatusBadRequest, "Invalid post id")
		return
	}

	userID, _ := GetUserIDFromSession(r)

	var p PostResponse
	err = database.Database.QueryRow(`
		SELECT p.id, p.title, p.content, p.user_id, u.nickname
		FROM posts p
		JOIN users u ON p.user_id = u.id
		WHERE p.id = ?
	`, postID).Scan(&p.ID, &p.Title, &p.Content, &p.UserID, &p.Nickname)
	if err != nil {
		HandleError(w, http.StatusNotFound, "Post not found")
		return
	}

	p.Categories, err = getPostCategories(postID)
	if err != nil {
		HandleError(w, http.StatusInternalServerError, "Failed to load categories")
		return
	}

	p.LikeCount, p.DislikeCount, err = getPostReactionCounts(postID)
	if err != nil {
		HandleError(w, http.StatusInternalServerError, "Failed to load reactions")
		return
	}

	if userID != 0 {
		p.UserReaction = getUserReaction(userID, postID)
	}

	RespondJSON(w, http.StatusOK, p)
}

func getPostCategories(postID int) ([]string, error) {
	rows, err := database.Database.Query(`
		SELECT c.name FROM post_categories pc
		JOIN categories c ON pc.category_id = c.id
		WHERE pc.post_id = ?
	`, postID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()

	categories := []string{}
	for rows.Next() {
		var name string
		if err := rows.Scan(&name); err != nil {
			return nil, err
		}
		categories = append(categories, name)
	}
	return categories, rows.Err()
}

func getPostReactionCounts(postID int) (likes, dislikes int, err error) {
	err = database.Database.QueryRow(`
		SELECT
			COALESCE(SUM(CASE WHEN is_like = 1 THEN 1 ELSE 0 END), 0),
			COALESCE(SUM(CASE WHEN is_like = 0 THEN 1 ELSE 0 END), 0)
		FROM post_reactions
		WHERE post_id = ?
	`, postID).Scan(&likes, &dislikes)
	return
}

func getUserReaction(userID, postID int) string {
	var isLike int
	err := database.Database.QueryRow(
		"SELECT is_like FROM post_reactions WHERE user_id = ? AND post_id = ?",
		userID, postID,
	).Scan(&isLike)
	if err != nil {
		return ""
	}
	if isLike == 1 {
		return "like"
	}
	return "dislike"
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

	err = r.ParseForm()
	if err != nil {
		HandleError(w, http.StatusBadRequest, "Invalid form data")
		return
	}

	title := strings.TrimSpace(r.FormValue("title"))
	content := strings.TrimSpace(r.FormValue("content"))
	categoryIDStrs := r.Form["categories"]

	if title == "" || content == "" || len(categoryIDStrs) == 0 {
		HandleError(w, http.StatusBadRequest, "All fields are required")
		return
	}
	if len(title) > 200 || len(content) > 2000 {
		HandleError(w, http.StatusBadRequest, "title or contant to long")
		return
	}
	validCategories := map[string]bool{
		"1": true,
		"2": true,
		"3": true,
		"4": true,
		"5": true,
		"6": true,
	}

	for _, cat := range categoryIDStrs {
		if !validCategories[cat] {
			HandleError(w, http.StatusBadRequest, "Invalid category")
			return
		}
	}
	result, err := database.Database.Exec(
		"INSERT INTO posts (title, content, user_id) VALUES (?, ?, ?)",
		title, content, userID,
	)
	if err != nil {
		log.Printf("CreatePostAPI insert: %v", err)
		HandleError(w, http.StatusInternalServerError, "Failed to create post")
		return
	}

	postID, err := result.LastInsertId()
	if err != nil {
		HandleError(w, http.StatusInternalServerError, "Could not get new post ID")
		return
	}

	for _, catIDStr := range categoryIDStrs {
		catID, err := strconv.Atoi(catIDStr)
		if err != nil {
			continue
		}
		_, err = database.Database.Exec("INSERT INTO post_categories (post_id, category_id) VALUES (?, ?)", postID, catID)
		if err != nil {
			HandleError(w, http.StatusBadRequest, "Invalid category")
			return
		}
	}

	RespondJSON(w, http.StatusCreated, map[string]string{"message": "Post created successfully!"})
}