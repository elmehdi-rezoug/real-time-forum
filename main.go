package main

import (
	"log"
	"net/http"

	"zone/backend/database"
	"zone/backend/routing"
)

func main() {
	if err := database.Init(); err != nil {
		log.Fatalf("Database initialization failed: %v", err)
	}

		routing.RegisterRout()

	port := ":8082"
	log.Println("Server running on http://localhost" + port)
	if err := http.ListenAndServe(port, nil); err != nil {
		log.Fatal("Server error:", err)
	}
}