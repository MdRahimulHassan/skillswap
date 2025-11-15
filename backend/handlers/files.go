package handlers

import (
	"database/sql"
	"encoding/json"
	"fmt"
	"io"
	"main/db"
	"mime/multipart"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"
)

func saveFile(fh *multipart.FileHeader, dstDir string) (storedName string, err error) {
	in, err := fh.Open()
	if err != nil {
		return "", err
	}
	defer in.Close()

	fn := filepath.Base(fh.Filename)
	storedName = fmt.Sprintf("%d_%s", time.Now().UnixNano(), fn)
	dst := filepath.Join(dstDir, storedName)

	out, err := os.Create(dst)
	if err != nil {
		return "", err
	}
	defer out.Close()

	_, err = io.Copy(out, in)
	return storedName, err
}

// POST /api/upload  (multipart form: sender_id, receiver_id, file)
func UploadFile(w http.ResponseWriter, r *http.Request) {
	if err := r.ParseMultipartForm(100 << 20); err != nil { // 100MB
		http.Error(w, "cannot parse form", http.StatusBadRequest)
		return
	}

	senderStr := r.FormValue("sender_id")
	receiverStr := r.FormValue("receiver_id")
	if senderStr == "" || receiverStr == "" {
		http.Error(w, "sender_id and receiver_id required", http.StatusBadRequest)
		return
	}
	senderID, _ := strconv.Atoi(senderStr)
	receiverID, _ := strconv.Atoi(receiverStr)

	fhs := r.MultipartForm.File["file"]
	if len(fhs) == 0 {
		http.Error(w, "file required", http.StatusBadRequest)
		return
	}
	fh := fhs[0]

	os.MkdirAll("./uploads", 0755)
	storedName, err := saveFile(fh, "./uploads")
	if err != nil {
		http.Error(w, "save failed:"+err.Error(), http.StatusInternalServerError)
		return
	}
	stat, _ := os.Stat("./uploads/" + storedName)
	size := stat.Size()
	mime := fh.Header.Get("Content-Type")

	var fileID int
	err = db.DB.QueryRow(`INSERT INTO files(filename, stored_name, size, mime_type, uploader_id) VALUES($1,$2,$3,$4,$5) RETURNING id`,
		fh.Filename, storedName, size, mime, senderID).Scan(&fileID)
	if err != nil {
		http.Error(w, "db insert file:"+err.Error(), http.StatusInternalServerError)
		return
	}

	var created time.Time
	err = db.DB.QueryRow(`INSERT INTO messages(sender_id, receiver_id, is_file, file_id) VALUES($1,$2,true,$3) RETURNING created_at`,
		senderID, receiverID, fileID).Scan(&created)
	if err != nil {
		http.Error(w, "db insert message:"+err.Error(), http.StatusInternalServerError)
		return
	}

	// notify via WS
	msg := WSMsg{
		Type:       "file",
		SenderID:   senderID,
		ReceiverID: receiverID,
		FileID:     fileID,
		CreatedAt:  created.UTC().Format(time.RFC3339),
	}
	if rc, ok := getClient(receiverID); ok {
		rc.send <- msg
	}
	if sc, ok := getClient(senderID); ok {
		sc.send <- msg
	}

	resp := map[string]interface{}{
		"file_id":  fileID,
		"file_url": "/uploads/" + storedName,
	}
	w.Header().Set("Content-Type", "application/json")
	json.NewEncoder(w).Encode(resp)
}

// GET /api/file?id=123  -> returns filename & stored_name & url
func FileInfo(w http.ResponseWriter, r *http.Request) {
	idStr := r.URL.Query().Get("id")
	if idStr == "" {
		http.Error(w, "id required", http.StatusBadRequest)
		return
	}
	id, _ := strconv.Atoi(idStr)

	var filename, stored string
	err := db.DB.QueryRow(`SELECT filename, stored_name FROM files WHERE id=$1`, id).Scan(&filename, &stored)
	if err == sql.ErrNoRows {
		http.Error(w, "not found", http.StatusNotFound)
		return
	} else if err != nil {
		http.Error(w, "db error:"+err.Error(), http.StatusInternalServerError)
		return
	}

	json.NewEncoder(w).Encode(map[string]string{
		"filename": filename,
		"url":      "/uploads/" + stored,
	})
}
