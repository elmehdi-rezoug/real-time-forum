package routing

import (
	"net/http"
	"zone/backend/handlers"
	middlewares "zone/backend/middleware"
)

func RegisterRout(){
	// Auth routes
		// Public
http.HandleFunc("/register", handlers.Register)
http.HandleFunc("/login", handlers.Login)

// Protected
http.HandleFunc("/logout",
	middlewares.Auth(handlers.Logout))

	//api routes
http.HandleFunc("/api/me",handlers.Me)

http.HandleFunc("/api/users",
	middlewares.Auth(handlers.GetUsersAPI))

http.HandleFunc("/api/posts/create",
	middlewares.Auth(handlers.CreatePostAPI))

http.HandleFunc("/api/posts/react",
	middlewares.Auth(handlers.ReactToPost))

// Public
http.HandleFunc("/api/posts", handlers.GetPostsAPI)
http.HandleFunc("/api/categories", handlers.GetCategoriesAPI)
http.HandleFunc("/ws",        handlers.ServeWS)
}