package main

import (
	"log"
	"main/db"
	"main/handlers"
	"net/http"
	"strings"
)

func main() {
	db.Connect()

	// Start Unified WebSocket manager
	handlers.StartUnifiedManager()

	http.Handle("/static/", http.StripPrefix("/static/", http.FileServer(http.Dir("./frontend/static"))))

	http.HandleFunc("/api/signup", cors(handlers.Signup))
	http.HandleFunc("/api/login", cors(handlers.Login))
	http.HandleFunc("/api/ws", cors(handlers.HandleUnifiedWebSocket))
	http.HandleFunc("/api/chats", cors(handlers.GetChatList))
	http.HandleFunc("/api/history", cors(handlers.GetHistory))
	http.HandleFunc("/api/upload", cors(handlers.UploadFile))
	http.HandleFunc("/api/file", cors(handlers.FileInfo))
	http.HandleFunc("/api/profile", cors(handlers.GetProfile))
	http.HandleFunc("/api/profile/update", cors(handlers.UpdateProfile))
	http.HandleFunc("/api/profile/photo", cors(handlers.UploadProfilePhoto))
	http.HandleFunc("/api/users/search", cors(handlers.SearchUsers))
	http.HandleFunc("/api/users/online", cors(handlers.GetOnlineStatus))
	http.HandleFunc("/api/dashboard/stats", cors(handlers.GetDashboardStats))

	// Skills endpoints
	http.HandleFunc("/api/skills/add", cors(handlers.AddSkill))
	http.HandleFunc("/api/skills/remove", cors(handlers.RemoveSkill))
	http.HandleFunc("/api/skills/search", cors(handlers.SearchSkills))
	http.HandleFunc("/api/skills/user", cors(handlers.GetUserSkills))

	// P2P endpoints
	http.HandleFunc("/api/p2p/resource/create", cors(handlers.CreateResource))
	http.HandleFunc("/api/p2p/resources", cors(handlers.GetResources))
	http.HandleFunc("/api/p2p/resource/", cors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" {
			handlers.GetResourceDetails(w, r)
		}
	}))
	http.HandleFunc("/api/p2p/swarm/", cors(func(w http.ResponseWriter, r *http.Request) {
		if r.Method == "GET" && strings.HasSuffix(r.URL.Path, "/stats") {
			handlers.GetSwarmStats(w, r)
		} else if r.Method == "GET" && strings.HasSuffix(r.URL.Path, "/peers") {
			handlers.GetSwarmPeers(w, r)
		}
	}))
	http.HandleFunc("/api/p2p/announce", cors(handlers.AnnouncePeer))
	http.HandleFunc("/api/p2p/piece/", cors(handlers.GetPiece))
	http.HandleFunc("/api/p2p/statistics", cors(handlers.GetP2PStatistics))

	// Serve HTML pages
	http.HandleFunc("/", func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Path == "/" {
			http.ServeFile(w, r, "./frontend/login.html")
			return
		}
		if r.URL.Path == "/login" {
			http.ServeFile(w, r, "./frontend/login.html")
			return
		}
		if r.URL.Path == "/signup" {
			http.ServeFile(w, r, "./frontend/signup.html")
			return
		}
		if r.URL.Path == "/dashboard" {
			http.ServeFile(w, r, "./frontend/dashboard.html")
			return
		}
		if r.URL.Path == "/profile" {
			http.ServeFile(w, r, "./frontend/profile.html")
			return
		}
		if r.URL.Path == "/chat" {
			http.ServeFile(w, r, "./frontend/chat.html")
			return
		}
		if r.URL.Path == "/my-skills" {
			http.ServeFile(w, r, "./frontend/my-skills.html")
			return
		}
		if r.URL.Path == "/find-skills" {
			http.ServeFile(w, r, "./frontend/find-skills.html")
			return
		}
		http.NotFound(w, r)
	})

	// Serve files
	http.Handle("/uploads/", http.StripPrefix("/uploads/", http.FileServer(http.Dir("./uploads"))))
	http.Handle("/p2p_resources/", http.StripPrefix("/p2p_resources/", http.FileServer(http.Dir("./p2p_resources"))))

	log.Println("Backend running on http://localhost:8080")
	http.ListenAndServe(":8080", nil)
}

func cors(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		origin := r.Header.Get("Origin")

		// Allow multiple origins for development
		allowedOrigins := []string{
			"http://127.0.0.1:5500",
			"http://localhost:5500",
			"http://localhost:3000",
			"http://127.0.0.1:3000",
		}

		// Check if origin is allowed
		isAllowed := false
		for _, allowedOrigin := range allowedOrigins {
			if origin == allowedOrigin {
				isAllowed = true
				break
			}
		}

		if isAllowed {
			w.Header().Set("Access-Control-Allow-Origin", origin)
		}

		w.Header().Set("Access-Control-Allow-Methods", "POST, GET, OPTIONS, PUT, DELETE")
		w.Header().Set("Access-Control-Allow-Headers", "Content-Type, Authorization")
		w.Header().Set("Access-Control-Allow-Credentials", "true")

		if r.Method == "OPTIONS" { // Preflight
			w.WriteHeader(http.StatusOK)
			return
		}

		next(w, r)
	}
}
