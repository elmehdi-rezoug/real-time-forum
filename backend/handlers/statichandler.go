package handlers

import (
	"net/http"
	"os"
	"path/filepath"
)

// HandleStatic serves CSS files and prevents direct access to /static/
func HandleStatic(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path == "/static" || r.URL.Path == "/static/" {
		HandleError(w, http.StatusNotFound, "Not Found!")
		return
	}
	filePath := filepath.Join("frontend/static", r.URL.Path[len("/static/"):])

	if _, err := os.Stat(filePath); err != nil {
		HandleError(w, http.StatusNotFound, "Not Found!")
		return
	}
	http.ServeFile(w, r, filePath)
}