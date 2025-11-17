package handlers

import (
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"main/db"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"time"
)

// P2P Resource Management

// Helper function to check if user has approved connection for resource
func hasApprovedConnection(userID, resourceID int) (bool, error) {
	var skillName string
	var ownerID int

	// Get skill name and owner for this resource
	err := db.DB.QueryRow(`
		SELECT sr.skill_name, sr.owner_id 
		FROM skill_resources sr
		WHERE sr.resource_id = $1
		LIMIT 1
	`, resourceID).Scan(&skillName, &ownerID)

	if err != nil {
		// If not found in skill_resources, check if user owns the resource
		err = db.DB.QueryRow("SELECT uploader_id FROM resources WHERE id = $1", resourceID).Scan(&ownerID)
		if err != nil {
			return false, err
		}
		// If user owns the resource, allow access
		if ownerID == userID {
			return true, nil
		}
		// Resource exists but not in skill_resources, deny access
		return false, nil
	}

	// If user owns the resource, allow access
	if ownerID == userID {
		return true, nil
	}

	// Check if user has approved connection for this skill
	var hasConnection bool
	err = db.DB.QueryRow(`
		SELECT EXISTS (
			SELECT 1 FROM p2p_connections 
			WHERE ((requester_id = $1 AND target_user_id = $2) OR (requester_id = $2 AND target_user_id = $1))
			AND skill_name = $3 
			AND status = 'approved'
		)
	`, userID, ownerID, skillName).Scan(&hasConnection)

	return hasConnection, err
}

type Resource struct {
	ID              int       `json:"id"`
	Title           string    `json:"title"`
	Description     string    `json:"description"`
	SkillCategory   string    `json:"skill_category"`
	FileHash        string    `json:"file_hash"`
	FileSize        int64     `json:"file_size"`
	MimeType        string    `json:"mime_type"`
	UploaderID      int       `json:"uploader_id"`
	PieceCount      int       `json:"piece_count"`
	PieceSize       int       `json:"piece_size"`
	PiecesHash      string    `json:"pieces_hash"`
	Tags            []string  `json:"tags"`
	DifficultyLevel string    `json:"difficulty_level"`
	Rating          float64   `json:"rating"`
	DownloadCount   int       `json:"download_count"`
	CreatedAt       time.Time `json:"created_at"`
	Username        string    `json:"username,omitempty"`
	Name            string    `json:"name,omitempty"`
}

type SwarmStats struct {
	ResourceID int   `json:"resource_id"`
	Seeders    int   `json:"seeders"`
	Leechers   int   `json:"leechers"`
	Completed  int   `json:"completed"`
	TotalSize  int64 `json:"total_size"`
}

type PeerInfo struct {
	UserID        int       `json:"user_id"`
	Username      string    `json:"username"`
	Status        string    `json:"status"`
	Progress      float64   `json:"progress"`
	UploadSpeed   int64     `json:"upload_speed"`
	DownloadSpeed int64     `json:"download_speed"`
	PiecesHave    []int     `json:"pieces_have"`
	LastSeen      time.Time `json:"last_seen"`
}

// POST /api/p2p/resource/create
func CreateResource(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(500 << 20); err != nil { // 500MB limit
		http.Error(w, "cannot parse form", http.StatusBadRequest)
		return
	}

	title := r.FormValue("title")
	description := r.FormValue("description")
	skillCategory := r.FormValue("skill_category")
	tagsStr := r.FormValue("tags")
	difficultyLevel := r.FormValue("difficulty_level")
	uploaderIDStr := r.FormValue("uploader_id")

	if title == "" || skillCategory == "" || uploaderIDStr == "" {
		http.Error(w, "title, skill_category, and uploader_id required", http.StatusBadRequest)
		return
	}

	uploaderID, err := strconv.Atoi(uploaderIDStr)
	if err != nil {
		http.Error(w, "invalid uploader_id", http.StatusBadRequest)
		return
	}

	// Handle file upload
	fhs := r.MultipartForm.File["file"]
	if len(fhs) == 0 {
		http.Error(w, "file required", http.StatusBadRequest)
		return
	}
	fh := fhs[0]

	// Create uploads directory if it doesn't exist
	os.MkdirAll("./p2p_resources", 0755)

	// Save file and calculate hash
	filePath := filepath.Join("./p2p_resources", fh.Filename)
	file, err := fh.Open()
	if err != nil {
		http.Error(w, "cannot open file", http.StatusInternalServerError)
		return
	}
	defer file.Close()

	// Calculate file hash
	hasher := sha256.New()
	if _, err := io.Copy(hasher, file); err != nil {
		http.Error(w, "hash calculation failed", http.StatusInternalServerError)
		return
	}
	fileHash := hex.EncodeToString(hasher.Sum(nil))

	// Reset file pointer and save to disk
	file.Seek(0, 0)
	outFile, err := os.Create(filePath)
	if err != nil {
		http.Error(w, "cannot save file", http.StatusInternalServerError)
		return
	}
	defer outFile.Close()

	fileSize, err := io.Copy(outFile, file)
	if err != nil {
		http.Error(w, "file save failed", http.StatusInternalServerError)
		return
	}

	// Split file into pieces and calculate piece hashes
	pieceSize := int64(1024 * 1024) // 1MB pieces
	pieceCount := int((fileSize + pieceSize - 1) / pieceSize)
	pieceHashes := make([]string, pieceCount)

	file.Seek(0, 0)
	for i := range pieceCount {
		pieceHasher := sha256.New()
		pieceBuffer := make([]byte, pieceSize)
		n, _ := file.Read(pieceBuffer)
		pieceHasher.Write(pieceBuffer[:n])
		pieceHashes[i] = hex.EncodeToString(pieceHasher.Sum(nil))
	}

	piecesHash := strings.Join(pieceHashes, ",")

	// Parse tags
	var tags []string
	if tagsStr != "" {
		tags = strings.Split(tagsStr, ",")
		for i := range tags {
			tags[i] = strings.TrimSpace(tags[i])
		}
	}

	// Insert resource into database
	var resourceID int
	err = db.DB.QueryRow(`
		INSERT INTO resources(title, description, skill_category, file_hash, file_name, file_size, mime_type, 
			uploader_id, piece_count, piece_size, pieces_hash, tags, difficulty_level)
		VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13) RETURNING id`,
		title, description, skillCategory, fileHash, fh.Filename, fileSize, fh.Header.Get("Content-Type"),
		uploaderID, pieceCount, int(pieceSize), piecesHash, tags, difficultyLevel).Scan(&resourceID)

	if err != nil {
		http.Error(w, "database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Create torrent entry
	_, err = db.DB.Exec(`
		INSERT INTO torrents(resource_id, announce_url, piece_hashes, created_by)
		VALUES($1, $2, $3, $4)`,
		resourceID, "/api/p2p/announce", piecesHash, uploaderID)

	if err != nil {
		http.Error(w, "torrent creation error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Initialize swarm
	_, err = db.DB.Exec(`
		INSERT INTO swarms(resource_id, total_seeders, total_leechers, total_completed)
		VALUES($1, 1, 0, 0)`,
		resourceID)

	if err != nil {
		http.Error(w, "swarm initialization error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Add uploader as seeder
	piecesArray := make([]string, pieceCount)
	for i := range piecesArray {
		piecesArray[i] = strconv.Itoa(i)
	}
	piecesHaveStr := "[" + strings.Join(piecesArray, ",") + "]"

	_, err = db.DB.Exec(`
		INSERT INTO peer_participation(user_id, resource_id, status, progress, pieces_have, uploaded_total, downloaded_total)
		VALUES($1, $2, 'seeding', 100.0, $3, $4, 0)`,
		uploaderID, resourceID, piecesHaveStr, fileSize)

	if err != nil {
		http.Error(w, "peer participation error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Return resource info
	resource := Resource{
		ID:              resourceID,
		Title:           title,
		Description:     description,
		SkillCategory:   skillCategory,
		FileHash:        fileHash,
		FileSize:        fileSize,
		MimeType:        fh.Header.Get("Content-Type"),
		UploaderID:      uploaderID,
		PieceCount:      pieceCount,
		PieceSize:       int(pieceSize),
		PiecesHash:      piecesHash,
		Tags:            tags,
		DifficultyLevel: difficultyLevel,
		CreatedAt:       time.Now(),
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resource)
}

// GET /api/p2p/resources
func GetResources(w http.ResponseWriter, r *http.Request) {
	category := r.URL.Query().Get("category")
	tags := r.URL.Query().Get("tags")
	minSeeders := r.URL.Query().Get("min_seeders")
	difficulty := r.URL.Query().Get("difficulty")

	query := `
		SELECT r.id, r.title, r.description, r.skill_category, r.file_hash, r.file_size,
			   r.mime_type, r.uploader_id, r.piece_count, r.piece_size, r.pieces_hash,
			   r.tags, r.difficulty_level, r.rating, r.download_count, r.created_at,
			   u.username, u.name
		FROM resources r
		JOIN users u ON r.uploader_id = u.id
		WHERE 1=1`

	args := []interface{}{}
	argIndex := 1

	if category != "" {
		query += fmt.Sprintf(" AND r.skill_category = $%d", argIndex)
		args = append(args, category)
		argIndex++
	}

	if tags != "" {
		tagList := strings.Split(tags, ",")
		for i := range tagList {
			query += fmt.Sprintf(" AND $%d = ANY(r.tags)", argIndex)
			args = append(args, strings.TrimSpace(tagList[i]))
			argIndex++
		}
	}

	if difficulty != "" {
		query += fmt.Sprintf(" AND r.difficulty_level = $%d", argIndex)
		args = append(args, difficulty)
		argIndex++
	}

	if minSeeders != "" {
		query += fmt.Sprintf(`
			AND EXISTS (
				SELECT 1 FROM swarms s 
				WHERE s.resource_id = r.id AND s.total_seeders >= $%d
			)`, argIndex)
		args = append(args, minSeeders)
		argIndex++
	}

	query += " ORDER BY r.created_at DESC"

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		http.Error(w, "database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var resources []Resource
	for rows.Next() {
		var resource Resource
		var tagsArray sql.NullString

		err := rows.Scan(
			&resource.ID, &resource.Title, &resource.Description, &resource.SkillCategory,
			&resource.FileHash, &resource.FileSize, &resource.MimeType, &resource.UploaderID,
			&resource.PieceCount, &resource.PieceSize, &resource.PiecesHash, &tagsArray,
			&resource.DifficultyLevel, &resource.Rating, &resource.DownloadCount,
			&resource.CreatedAt, &resource.Username, &resource.Name,
		)
		if err != nil {
			continue
		}

		if tagsArray.Valid {
			resource.Tags = strings.Split(tagsArray.String, ",")
		}

		resources = append(resources, resource)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resources)
}

// GET /api/p2p/resource/:id
func GetResourceDetails(w http.ResponseWriter, r *http.Request) {
	resourceIDStr := r.URL.Path[len("/api/p2p/resource/"):]
	resourceID, err := strconv.Atoi(resourceIDStr)
	if err != nil {
		http.Error(w, "invalid resource id", http.StatusBadRequest)
		return
	}

	// Check user authentication and connection status
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		http.Error(w, "user_id parameter required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "invalid user_id", http.StatusBadRequest)
		return
	}

	// Check if user has approved connection for this resource
	hasAccess, err := hasApprovedConnection(userID, resourceID)
	if err != nil {
		http.Error(w, "error checking access: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !hasAccess {
		http.Error(w, "access denied: approved connection required for this resource", http.StatusForbidden)
		return
	}

	var resource Resource
	var tagsArray sql.NullString

	err = db.DB.QueryRow(`
		SELECT r.id, r.title, r.description, r.skill_category, r.file_hash, r.file_size,
			   r.mime_type, r.uploader_id, r.piece_count, r.piece_size, r.pieces_hash,
			   r.tags, r.difficulty_level, r.rating, r.download_count, r.created_at,
			   u.username, u.name
		FROM resources r
		JOIN users u ON r.uploader_id = u.id
		WHERE r.id = $1`, resourceID).Scan(
		&resource.ID, &resource.Title, &resource.Description, &resource.SkillCategory,
		&resource.FileHash, &resource.FileSize, &resource.MimeType, &resource.UploaderID,
		&resource.PieceCount, &resource.PieceSize, &resource.PiecesHash, &tagsArray,
		&resource.DifficultyLevel, &resource.Rating, &resource.DownloadCount,
		&resource.CreatedAt, &resource.Username, &resource.Name,
	)

	if err == sql.ErrNoRows {
		http.Error(w, "resource not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if tagsArray.Valid {
		resource.Tags = strings.Split(tagsArray.String, ",")
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resource)
}

// GET /api/p2p/swarm/:id/stats
func GetSwarmStats(w http.ResponseWriter, r *http.Request) {
	resourceIDStr := r.URL.Path[len("/api/p2p/swarm/"):]
	resourceIDStr = strings.TrimSuffix(resourceIDStr, "/stats")
	resourceID, err := strconv.Atoi(resourceIDStr)
	if err != nil {
		http.Error(w, "invalid resource id", http.StatusBadRequest)
		return
	}

	var stats SwarmStats
	var fileSize int64

	err = db.DB.QueryRow(`
		SELECT s.resource_id, s.total_seeders, s.total_leechers, s.total_completed, r.file_size
		FROM swarms s
		JOIN resources r ON s.resource_id = r.id
		WHERE s.resource_id = $1`, resourceID).Scan(
		&stats.ResourceID, &stats.Seeders, &stats.Leechers, &stats.Completed, &fileSize,
	)

	if err == sql.ErrNoRows {
		http.Error(w, "swarm not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	stats.TotalSize = fileSize

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(stats)
}

// GET /api/p2p/swarm/:id/peers
func GetSwarmPeers(w http.ResponseWriter, r *http.Request) {
	resourceIDStr := r.URL.Path[len("/api/p2p/swarm/"):]
	resourceIDStr = strings.TrimSuffix(resourceIDStr, "/peers")
	resourceID, err := strconv.Atoi(resourceIDStr)
	if err != nil {
		http.Error(w, "invalid resource id", http.StatusBadRequest)
		return
	}

	rows, err := db.DB.Query(`
		SELECT pp.user_id, u.username, pp.status, pp.progress, pp.upload_speed, 
			   pp.download_speed, pp.last_announce
		FROM peer_participation pp
		JOIN users u ON pp.user_id = u.id
		WHERE pp.resource_id = $1
		ORDER BY pp.last_announce DESC`, resourceID)

	if err != nil {
		http.Error(w, "database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var peers []PeerInfo
	for rows.Next() {
		var peer PeerInfo
		var piecesArray sql.NullString

		err := rows.Scan(
			&peer.UserID, &peer.Username, &peer.Status, &peer.Progress,
			&peer.UploadSpeed, &peer.DownloadSpeed, &peer.LastSeen,
		)
		if err != nil {
			continue
		}

		if piecesArray.Valid {
			// Parse pieces array if needed
			peer.PiecesHave = []int{} // Simplified for now
		}

		peers = append(peers, peer)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(peers)
}

// POST /api/p2p/announce
func AnnouncePeer(w http.ResponseWriter, r *http.Request) {
	var announce struct {
		UserID     int     `json:"user_id"`
		ResourceID int     `json:"resource_id"`
		Status     string  `json:"status"` // seeding, leeching, completed
		Progress   float64 `json:"progress"`
		Event      string  `json:"event"` // started, stopped, completed
	}

	if err := json.NewDecoder(r.Body).Decode(&announce); err != nil {
		http.Error(w, "invalid JSON", http.StatusBadRequest)
		return
	}

	// Update or insert peer participation
	_, err := db.DB.Exec(`
		INSERT INTO peer_participation(user_id, resource_id, status, progress, last_announce)
		VALUES($1, $2, $3, $4, NOW())
		ON CONFLICT (user_id, resource_id) 
		DO UPDATE SET 
			status = EXCLUDED.status,
			progress = EXCLUDED.progress,
			last_announce = NOW()`,
		announce.UserID, announce.ResourceID, announce.Status, announce.Progress)

	if err != nil {
		http.Error(w, "database error: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Update swarm statistics
	updateSwarmStats(announce.ResourceID)

	// Return updated peer list
	peers := getSwarmPeers(announce.ResourceID)
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(map[string]interface{}{
		"peers": peers,
		"stats": getSwarmStats(announce.ResourceID),
	})
}

// GET /api/p2p/piece/:resource_id/:piece_index
func GetPiece(w http.ResponseWriter, r *http.Request) {
	pathParts := strings.Split(r.URL.Path, "/")
	resourceID, err := strconv.Atoi(pathParts[4])
	if err != nil {
		http.Error(w, "invalid resource id", http.StatusBadRequest)
		return
	}

	pieceIndex, err := strconv.Atoi(pathParts[5])
	if err != nil {
		http.Error(w, "invalid piece index", http.StatusBadRequest)
		return
	}

	// Check user authentication and connection status
	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		http.Error(w, "user_id parameter required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "invalid user_id", http.StatusBadRequest)
		return
	}

	// Check if user has approved connection for this resource
	hasAccess, err := hasApprovedConnection(userID, resourceID)
	if err != nil {
		http.Error(w, "error checking access: "+err.Error(), http.StatusInternalServerError)
		return
	}

	if !hasAccess {
		http.Error(w, "access denied: approved connection required for this resource", http.StatusForbidden)
		return
	}

	// Get resource info
	var fileName, piecesHash string
	var pieceSize int

	err = db.DB.QueryRow(`
		SELECT file_name, piece_size, pieces_hash 
		FROM resources 
		WHERE id = $1`, resourceID).Scan(&fileName, &pieceSize, &piecesHash)

	if err != nil {
		http.Error(w, "resource not found", http.StatusNotFound)
		return
	}

	// Open the file
	file, err := os.Open("./p2p_resources/" + fileName)
	if err != nil {
		http.Error(w, "file not found", http.StatusNotFound)
		return
	}
	defer file.Close()

	// Seek to piece position
	offset := int64(pieceIndex) * int64(pieceSize)
	_, err = file.Seek(offset, 0)
	if err != nil {
		http.Error(w, "seek error", http.StatusInternalServerError)
		return
	}

	// Read piece
	piece := make([]byte, pieceSize)
	n, err := file.Read(piece)
	if err != nil && err != io.EOF {
		http.Error(w, "read error", http.StatusInternalServerError)
		return
	}

	// Verify piece hash
	hasher := sha256.New()
	hasher.Write(piece[:n])
	pieceHash := hex.EncodeToString(hasher.Sum(nil))

	pieceHashes := strings.Split(piecesHash, ",")
	if pieceIndex >= len(pieceHashes) || pieceHashes[pieceIndex] != pieceHash {
		http.Error(w, "piece hash mismatch", http.StatusNotFound)
		return
	}

	w.Header().Set("Content-Type", "application/octet-stream")
	w.Header().Set("Content-Length", strconv.Itoa(n))
	w.Write(piece[:n])
}

// Helper functions
func updateSwarmStats(resourceID int) {
	var seeders, leechers, completed int

	err := db.DB.QueryRow(`
		SELECT 
			COUNT(CASE WHEN status = 'seeding' THEN 1 END),
			COUNT(CASE WHEN status = 'leeching' THEN 1 END),
			COUNT(CASE WHEN status = 'completed' THEN 1 END)
		FROM peer_participation 
		WHERE resource_id = $1`, resourceID).Scan(&seeders, &leechers, &completed)

	if err != nil {
		fmt.Printf("Error querying swarm stats: %v\n", err)
		return
	}

	_, err = db.DB.Exec(`
		UPDATE swarms 
		SET total_seeders = $1, total_leechers = $2, total_completed = $3, last_activity = NOW()
		WHERE resource_id = $4`, seeders, leechers, completed, resourceID)

	if err != nil {
		fmt.Printf("Error updating swarm stats: %v\n", err)
	}
}

func getSwarmPeers(resourceID int) []PeerInfo {
	rows, err := db.DB.Query(`
		SELECT pp.user_id, u.username, pp.status, pp.progress, pp.upload_speed, 
			   pp.download_speed, pp.last_announce
		FROM peer_participation pp
		JOIN users u ON pp.user_id = u.id
		WHERE pp.resource_id = $1
		ORDER BY pp.last_announce DESC`, resourceID)

	if err != nil {
		return []PeerInfo{}
	}
	defer rows.Close()

	var peers []PeerInfo
	for rows.Next() {
		var peer PeerInfo
		err := rows.Scan(&peer.UserID, &peer.Username, &peer.Status, &peer.Progress,
			&peer.UploadSpeed, &peer.DownloadSpeed, &peer.LastSeen)
		if err != nil {
			continue
		}
		peers = append(peers, peer)
	}

	return peers
}

func getSwarmStats(resourceID int) SwarmStats {
	var stats SwarmStats
	var fileSize int64

	err := db.DB.QueryRow(`
		SELECT s.resource_id, s.total_seeders, s.total_leechers, s.total_completed, r.file_size
		FROM swarms s
		JOIN resources r ON s.resource_id = r.id
		WHERE s.resource_id = $1`, resourceID).Scan(
		&stats.ResourceID, &stats.Seeders, &stats.Leechers, &stats.Completed, &fileSize,
	)

	if err != nil {
		return SwarmStats{ResourceID: resourceID}
	}

	stats.TotalSize = fileSize
	return stats
}

// P2P Connection Request System

type P2PRequest struct {
	ID           int       `json:"id"`
	RequesterID  int       `json:"requester_id"`
	TargetUserID int       `json:"target_user_id"`
	Skill        string    `json:"skill"`
	Message      string    `json:"message"`
	Status       string    `json:"status"` // pending, approved, rejected
	CreatedAt    time.Time `json:"created_at"`
	UpdatedAt    time.Time `json:"updated_at"`
}

type P2PRequestResponse struct {
	Success bool   `json:"success"`
	Message string `json:"message"`
}

// POST /api/p2p/request
func CreateP2PRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		RequesterID  int    `json:"requester_id"`
		TargetUserID int    `json:"target_user_id"`
		Skill        string `json:"skill"`
		ResourceIDs  []int  `json:"resource_ids"`
		Message      string `json:"message"`
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate required fields
	if req.RequesterID == 0 || req.TargetUserID == 0 || req.Skill == "" {
		http.Error(w, "requester_id, target_user_id, and skill are required", http.StatusBadRequest)
		return
	}

	// Check if user is requesting from themselves
	if req.RequesterID == req.TargetUserID {
		http.Error(w, "Cannot request resources from yourself", http.StatusBadRequest)
		return
	}

	// Check if there's already a pending request
	var existingRequestID int
	err := db.DB.QueryRow(`
		SELECT id FROM p2p_requests 
		WHERE requester_id = $1 AND target_user_id = $2 AND skill = $3 AND status = 'pending'
	`, req.RequesterID, req.TargetUserID, req.Skill).Scan(&existingRequestID)

	if err == nil {
		w.Header().Set("Content-Type", "application/json")
		json.NewEncoder(w).Encode(P2PRequestResponse{
			Success: false,
			Message: "You already have a pending request for this skill",
		})
		return
	}

	// Create the request
	var requestID int
	err = db.DB.QueryRow(`
		INSERT INTO p2p_requests(requester_id, target_user_id, skill, message, status, created_at, updated_at)
		VALUES($1, $2, $3, $4, 'pending', NOW(), NOW()) RETURNING id
	`, req.RequesterID, req.TargetUserID, req.Skill, req.Message).Scan(&requestID)

	if err != nil {
		http.Error(w, "Failed to create request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	// Get user details for notification
	var requesterName, targetName string
	db.DB.QueryRow("SELECT username FROM users WHERE id = $1", req.RequesterID).Scan(&requesterName)
	db.DB.QueryRow("SELECT username FROM users WHERE id = $1", req.TargetUserID).Scan(&targetName)

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(P2PRequestResponse{
		Success: true,
		Message: fmt.Sprintf("Resource request sent to %s for %s", targetName, req.Skill),
	})
}

// GET /api/p2p/requests
func GetP2PRequests(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	userIDStr := r.URL.Query().Get("user_id")
	if userIDStr == "" {
		http.Error(w, "user_id is required", http.StatusBadRequest)
		return
	}

	userID, err := strconv.Atoi(userIDStr)
	if err != nil {
		http.Error(w, "Invalid user_id", http.StatusBadRequest)
		return
	}

	requestType := r.URL.Query().Get("type") // "sent" or "received"

	var query string
	var args []interface{}

	if requestType == "sent" {
		query = `
			SELECT pr.id, pr.requester_id, pr.target_user_id, pr.skill, pr.message, pr.status, pr.created_at, pr.updated_at,
				   u_target.username as target_username, u_target.name as target_name
			FROM p2p_requests pr
			JOIN users u_target ON pr.target_user_id = u_target.id
			WHERE pr.requester_id = $1
			ORDER BY pr.created_at DESC
		`
		args = []interface{}{userID}
	} else {
		query = `
			SELECT pr.id, pr.requester_id, pr.target_user_id, pr.skill, pr.message, pr.status, pr.created_at, pr.updated_at,
				   u_requester.username as requester_username, u_requester.name as requester_name
			FROM p2p_requests pr
			JOIN users u_requester ON pr.requester_id = u_requester.id
			WHERE pr.target_user_id = $1
			ORDER BY pr.created_at DESC
		`
		args = []interface{}{userID}
	}

	rows, err := db.DB.Query(query, args...)
	if err != nil {
		http.Error(w, "Database error: "+err.Error(), http.StatusInternalServerError)
		return
	}
	defer rows.Close()

	var requests []map[string]interface{}
	for rows.Next() {
		var request P2PRequest
		var otherUsername, otherName *string

		err := rows.Scan(
			&request.ID, &request.RequesterID, &request.TargetUserID, &request.Skill,
			&request.Message, &request.Status, &request.CreatedAt, &request.UpdatedAt,
			&otherUsername, &otherName,
		)
		if err != nil {
			continue
		}

		requestMap := map[string]interface{}{
			"id":             request.ID,
			"requester_id":   request.RequesterID,
			"target_user_id": request.TargetUserID,
			"skill":          request.Skill,
			"message":        request.Message,
			"status":         request.Status,
			"created_at":     request.CreatedAt,
			"updated_at":     request.UpdatedAt,
		}

		if requestType == "sent" {
			requestMap["target_username"] = *otherUsername
			requestMap["target_name"] = otherName
		} else {
			requestMap["requester_username"] = *otherUsername
			requestMap["requester_name"] = otherName
		}

		requests = append(requests, requestMap)
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(requests)
}

// POST /api/p2p/request/respond
func RespondP2PRequest(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodPost {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}

	var req struct {
		RequestID int    `json:"request_id"`
		UserID    int    `json:"user_id"`
		Response  string `json:"response"` // "approve" or "reject"
	}

	if err := json.NewDecoder(r.Body).Decode(&req); err != nil {
		http.Error(w, "Invalid request body", http.StatusBadRequest)
		return
	}

	// Validate request
	if req.RequestID == 0 || req.UserID == 0 || (req.Response != "approve" && req.Response != "reject") {
		http.Error(w, "Invalid request parameters", http.StatusBadRequest)
		return
	}

	// Check if user owns this request (is the target)
	var targetUserID int
	err := db.DB.QueryRow("SELECT target_user_id FROM p2p_requests WHERE id = $1", req.RequestID).Scan(&targetUserID)
	if err != nil {
		http.Error(w, "Request not found", http.StatusNotFound)
		return
	}

	if targetUserID != req.UserID {
		http.Error(w, "You can only respond to requests sent to you", http.StatusForbidden)
		return
	}

	// Update request status
	newStatus := "rejected"
	if req.Response == "approve" {
		newStatus = "approved"
	}

	_, err = db.DB.Exec(`
		UPDATE p2p_requests 
		SET status = $1, updated_at = NOW() 
		WHERE id = $2
	`, newStatus, req.RequestID)

	if err != nil {
		http.Error(w, "Failed to update request: "+err.Error(), http.StatusInternalServerError)
		return
	}

	responseMessage := "Request rejected"
	if req.Response == "approve" {
		responseMessage = "Request approved - You can now share resources"
	}

	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(P2PRequestResponse{
		Success: true,
		Message: responseMessage,
	})
}

// GetP2PStatistics returns overall P2P system statistics
func GetP2PStatistics(w http.ResponseWriter, r *http.Request) {
	w.Header().Set("Content-Type", "application/json")

	// Get total resources count
	var totalResources int
	err := db.DB.QueryRow("SELECT COUNT(*) FROM resources").Scan(&totalResources)
	if err != nil {
		http.Error(w, "Failed to get resources count", http.StatusInternalServerError)
		return
	}

	// Get active seeders count
	var activeSeeders int
	err = db.DB.QueryRow(`
		SELECT COUNT(DISTINCT user_id) 
		FROM peer_participation 
		WHERE status = 'seeding' AND last_announce > NOW() - INTERVAL '1 hour'
	`).Scan(&activeSeeders)
	if err != nil {
		activeSeeders = 0 // Default to 0 if query fails
	}

	// Get active leechers count
	var activeLeechers int
	err = db.DB.QueryRow(`
		SELECT COUNT(DISTINCT user_id) 
		FROM peer_participation 
		WHERE status = 'leeching' AND last_announce > NOW() - INTERVAL '1 hour'
	`).Scan(&activeLeechers)
	if err != nil {
		activeLeechers = 0 // Default to 0 if query fails
	}

	// Get total downloads
	var totalDownloads int
	err = db.DB.QueryRow("SELECT COALESCE(SUM(download_count), 0) FROM resources").Scan(&totalDownloads)
	if err != nil {
		totalDownloads = 0
	}

	stats := map[string]interface{}{
		"total_resources": totalResources,
		"active_seeders":  activeSeeders,
		"active_leechers": activeLeechers,
		"total_downloads": totalDownloads,
		"last_updated":    time.Now().Format(time.RFC3339),
	}

	json.NewEncoder(w).Encode(stats)
}
