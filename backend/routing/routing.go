package routing

import (
	"net/http"
	"time"
	"zone/backend/handlers"
	middlewares "zone/backend/middleware"
)

func RegisterRout() {
	limiter := middlewares.NewRateLimiter(60, time.Second*3) // 60 requests per 3 seconds

	// Auth routes
	//main rout
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if len(r.URL.Path) >= 4 && r.URL.Path[:4] == "/api" {
			w.Header().Set("Content-Type", "application/json")
			w.WriteHeader(http.StatusNotFound)
			w.Write([]byte(`{"error":"endpoint not found"}`))
			return
		}
		// Everything else → SPA (index.html handles routing + error display)
		http.ServeFile(w, r, "./frontend/index.html")
	})
	// Static files
	http.HandleFunc("/static/", handlers.HandleStatic)
	// Public
	http.HandleFunc("/register", limiter.Middleware(handlers.Register))
	http.HandleFunc("/login", limiter.Middleware(handlers.Login))

	// Protected
	http.HandleFunc("/logout", limiter.Middleware(middlewares.Auth(handlers.Logout)))

	// API routes
	http.HandleFunc("/api/me", limiter.Middleware(handlers.Me))

	http.HandleFunc("/api/posts/create", limiter.Middleware(middlewares.Auth(handlers.CreatePostAPI)))

	http.HandleFunc("/api/posts/react", limiter.Middleware(middlewares.Auth(handlers.ReactToPost)))

	http.HandleFunc("/api/posts/comment", limiter.Middleware(middlewares.Auth(handlers.CreateCommentAPI)))
	http.HandleFunc("/api/posts/comments", limiter.Middleware(middlewares.Auth(handlers.GetCommentsAPI)))
	http.HandleFunc("/api/posts/{id}", limiter.Middleware(middlewares.Auth(handlers.GetPostByIDAPI)))
	// Public
	http.HandleFunc("/api/posts", limiter.Middleware(middlewares.Auth(handlers.GetPostsAPI)))
	http.HandleFunc("/api/categories", limiter.Middleware(middlewares.Auth(handlers.GetCategoriesAPI)))
}
