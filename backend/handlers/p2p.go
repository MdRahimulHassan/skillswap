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
		INSERT INTO resources(title, description, skill_category, file_hash, file_size, mime_type, 
			uploader_id, piece_count, piece_size, pieces_hash, tags, difficulty_level)
		VALUES($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12) RETURNING id`,
		title, description, skillCategory, fileHash, fileSize, fh.Header.Get("Content-Type"),
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

	// Get resource info
	var filePath, piecesHash string
	var pieceSize int

	err = db.DB.QueryRow(`
		SELECT file_hash, piece_size, pieces_hash 
		FROM resources 
		WHERE id = $1`, resourceID).Scan(&filePath, &pieceSize, &piecesHash)

	if err != nil {
		http.Error(w, "resource not found", http.StatusNotFound)
		return
	}

	// Open the file
	file, err := os.Open("./p2p_resources/" + filePath)
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
