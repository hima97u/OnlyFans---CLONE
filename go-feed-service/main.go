package main

import (
	"database/sql"
	"errors"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"strconv"
	"time"

	_ "modernc.org/sqlite"
)

func main() {
	dbPath := os.Getenv("DJANGO_DB_PATH")
	if dbPath == "" {
		dbPath = filepath.Join("..", "backend", "db.sqlite3")
	}
	db, err := sql.Open("sqlite", dbPath)
	if err != nil {
		log.Fatal(err)
	}
	defer db.Close()
	if err := db.Ping(); err != nil {
		log.Fatal(err)
	}

	secret := os.Getenv("DJANGO_SECRET_KEY")
	if secret == "" {
		log.Fatal("DJANGO_SECRET_KEY must be set to the Django SECRET_KEY")
	}
	port := os.Getenv("FEED_SERVICE_PORT")
	if port == "" {
		port = "8081"
	}
	server := NewServer(db, []byte(secret), time.Now)
	log.Printf("feed service listening on :%s", port)
	log.Fatal(http.ListenAndServe(":"+port, server))
}

func parsePositiveInt(value string, fallback, maximum int) int {
	n, err := strconv.Atoi(value)
	if err != nil || n < 1 {
		return fallback
	}
	if n > maximum {
		return maximum
	}
	return n
}

var errInvalidCursor = errors.New("invalid cursor")
