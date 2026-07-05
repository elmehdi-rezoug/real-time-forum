package handlers

import (
	"net/http"
	"strconv"
	"strings"
	"zone/backend/database"

	"golang.org/x/crypto/bcrypt"
)

type User struct {
	ID        int    `json:"id"`
	Nickname  string `json:"nickname"`
	FirstName string `json:"first_name"`
	LastName  string `json:"last_name"`
	Age       int    `json:"age"`
	Gender    string `json:"gender"`
	Email     string `json:"email"`
	Password  string `json:"password"`
}

func Register(w http.ResponseWriter, r *http.Request) {
	if r.URL.Path != "/register" {
		HandleError(w, http.StatusNotFound, "Page not found")
		return
	}

	switch r.Method {
			case http.MethodGet:
		http.ServeFile(w, r, "./frontend/index.html")
		return
	case http.MethodPost:
		confirmPassword := r.FormValue("confirm_password")
		rawAge := r.FormValue("age")

		user := User{
			Nickname:  strings.TrimSpace(r.FormValue("nickname")),
			FirstName: strings.TrimSpace(r.FormValue("first_name")),
			LastName:  strings.TrimSpace(r.FormValue("last_name")),
			Email:     strings.TrimSpace(r.FormValue("email")),
			Password:  r.FormValue("password"),
			Gender:    r.FormValue("gender"),
		}

		// 1. Check if ANY field is empty FIRST
		if user.Nickname == "" || user.Email == "" || user.Password == "" ||
			user.FirstName == "" || user.LastName == "" || confirmPassword == "" ||
			user.Gender == "" || rawAge == "" {
			HandleError(w, http.StatusBadRequest, "All fields are required")
			return
		}

		// 2. Parse age safely now that we know it's not empty
		age, err := strconv.Atoi(rawAge)
		if err != nil {
			HandleError(w, http.StatusBadRequest, "Invalid age format")
			return
		}
		user.Age = age

		// 3. Length validations
		if len(user.Nickname) < 2 || len(user.Nickname) > 50 ||
			len(user.FirstName) < 2 || len(user.FirstName) > 50 ||
			len(user.LastName) < 2 || len(user.LastName) > 50 {
			HandleError(w, http.StatusBadRequest, "Names must be between 2 and 50 characters")
			return
		}

		// 4. Email format validation
		if !strings.Contains(user.Email, "@") || !strings.Contains(user.Email, ".") {
			HandleError(w, http.StatusBadRequest, "Invalid email address")
			return
		}

		// 5. Gender validation
		if user.Gender != "male" && user.Gender != "female" {
			HandleError(w, http.StatusBadRequest, "Invalid gender choice")
			return
		}

		// 6. Password length validation
		if len(user.Password) < 6 || len(user.Password) > 21 {
			HandleError(w, http.StatusBadRequest, "Password must be between 6 and 21 characters")
			return
		}

		// 7. Password match validation
		if user.Password != confirmPassword {
			HandleError(w, http.StatusBadRequest, "Password and confirm password do not match")
			return
		}

		// 8. Age restriction validation
		if user.Age < 18 {
			HandleError(w, http.StatusBadRequest, "You must be at least 18 years old")
			return
		}

		// 9. Check if email already exists
		var emailExists bool
		err = database.Database.QueryRow(
			"SELECT EXISTS(SELECT 1 FROM users WHERE email = ?)", user.Email,
		).Scan(&emailExists)
		if err != nil {
			HandleError(w, http.StatusInternalServerError, "Database error checking email")
			return
		}
		if emailExists {
			HandleError(w, http.StatusBadRequest, "Email already registered")
			return
		}

		// 10. Check if username already exists
		var nameExists bool
		err = database.Database.QueryRow(
			"SELECT EXISTS(SELECT 1 FROM users WHERE nickname = ?)", user.Nickname,
		).Scan(&nameExists)
		if err != nil {
			HandleError(w, http.StatusInternalServerError, "Database error checking username")
			return
		}
		if nameExists {
			HandleError(w, http.StatusBadRequest, "Username already taken")
			return
		}

		// 11. Hash password
		hashedPassword, err := bcrypt.GenerateFromPassword([]byte(user.Password), bcrypt.DefaultCost)
		if err != nil {
			HandleError(w, http.StatusInternalServerError, "Password hashing error")
			return
		}

		// 12. Insert user into database
		_, err = database.Database.Exec(
			`INSERT INTO users (nickname, first_name, last_name, age, gender, email, password) 
			 VALUES (?, ?, ?, ?, ?, ?, ?)`,
			user.Nickname, user.FirstName, user.LastName, user.Age, user.Gender, user.Email, string(hashedPassword),
		)
		if err != nil {
			HandleError(w, http.StatusInternalServerError, "Could not create account in database")
			return
		}

		// Success response
		RespondJSON(w, http.StatusOK, map[string]string{
			"message": "User created successfully!",
		})

	default:
		HandleError(w, http.StatusMethodNotAllowed, "Method not allowed")
	}
}