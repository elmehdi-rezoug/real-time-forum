package routing

import (
	"net/http"
	"zone/backend/handlers"
	middlewares "zone/backend/middleware"
)

func RegisterRout() {
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
	http.HandleFunc("/register", handlers.Register)
	http.HandleFunc("/login", handlers.Login)

	// Protected
	http.HandleFunc("/logout", middlewares.Auth(handlers.Logout))

	// API routes
	http.HandleFunc("/api/me", handlers.Me)

	http.HandleFunc("/api/users", middlewares.Auth(handlers.GetUsersAPI))

	http.HandleFunc("/api/posts/create", middlewares.Auth(handlers.CreatePostAPI))

	http.HandleFunc("/api/posts/react", middlewares.Auth(handlers.ReactToPost))

	// Public
	http.HandleFunc("/api/posts", handlers.GetPostsAPI)
	http.HandleFunc("/api/categories", handlers.GetCategoriesAPI)
	http.HandleFunc("/ws", handlers.ServeWS)
}