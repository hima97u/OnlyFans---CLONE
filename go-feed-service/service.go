package main

import (
	"context"
	"database/sql"
	"encoding/base64"
	"encoding/json"
	"errors"
	"fmt"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/golang-jwt/jwt/v5"
)

type Clock func() time.Time

type Server struct {
	db     *sql.DB
	secret []byte
	now    Clock
}

func NewServer(db *sql.DB, secret []byte, now Clock) *Server {
	return &Server{db: db, secret: secret, now: now}
}

func (s *Server) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	origin := r.Header.Get("Origin")
	if origin == "http://localhost:5173" || origin == "http://127.0.0.1:5173" {
		w.Header().Set("Access-Control-Allow-Origin", origin)
	}
	w.Header().Set("Access-Control-Allow-Headers", "Authorization, Content-Type")
	w.Header().Set("Access-Control-Allow-Methods", "GET, OPTIONS")
	if r.Method == http.MethodOptions {
		w.WriteHeader(http.StatusNoContent)
		return
	}
	if r.URL.Path == "/healthz" {
		writeJSON(w, http.StatusOK, map[string]string{"status": "ok"})
		return
	}
	if !strings.HasPrefix(r.URL.Path, "/api/feed/") {
		http.NotFound(w, r)
		return
	}
	userID, ok := s.authenticate(w, r)
	if !ok {
		return
	}
	kind := strings.Trim(strings.TrimPrefix(r.URL.Path, "/api/feed/"), "/")
	if kind == "" {
		http.NotFound(w, r)
		return
	}
	s.handleFeed(w, r, userID, kind)
}

func (s *Server) authenticate(w http.ResponseWriter, r *http.Request) (int64, bool) {
	header := r.Header.Get("Authorization")
	if !strings.HasPrefix(header, "Bearer ") {
		writeError(w, http.StatusUnauthorized, "missing bearer token")
		return 0, false
	}
	token, err := jwt.Parse(strings.TrimSpace(strings.TrimPrefix(header, "Bearer ")), func(token *jwt.Token) (interface{}, error) {
		if token.Method != jwt.SigningMethodHS256 && token.Method != jwt.SigningMethodHS384 && token.Method != jwt.SigningMethodHS512 {
			return nil, errors.New("unsupported signing method")
		}
		return s.secret, nil
	}, jwt.WithValidMethods([]string{"HS256", "HS384", "HS512"}), jwt.WithLeeway(30*time.Second))
	if err != nil || !token.Valid {
		writeError(w, http.StatusUnauthorized, "invalid or expired token")
		return 0, false
	}
	var userID int64
	claims, ok := token.Claims.(jwt.MapClaims)
	if !ok {
		writeError(w, http.StatusUnauthorized, "token claims are invalid")
		return 0, false
	}
	claimValue, exists := claims["user_id"]
	if !exists {
		claimValue, exists = claims["sub"]
	}
	if !exists {
		writeError(w, http.StatusUnauthorized, "token user ID is missing")
		return 0, false
	}
	if _, err := fmt.Sscan(fmt.Sprint(claimValue), &userID); err != nil || userID < 1 {
		writeError(w, http.StatusUnauthorized, "token user ID is invalid")
		return 0, false
	}
	var active bool
	if err := s.db.QueryRow("SELECT is_active FROM auth_user WHERE id = ?", userID).Scan(&active); err != nil || !active {
		writeError(w, http.StatusUnauthorized, "account is unavailable")
		return 0, false
	}
	return userID, true
}

func (s *Server) handleFeed(w http.ResponseWriter, r *http.Request, userID int64, kind string) {
	options, err := feedOptionsFromRequest(r, kind, userID)
	if err != nil {
		writeError(w, http.StatusBadRequest, err.Error())
		return
	}
	if kind == "recommended-creators" {
		creators, err := s.queryCreators(r.Context(), userID, options.limit)
		if err != nil {
			writeError(w, http.StatusInternalServerError, "creator query failed")
			return
		}
		writeJSON(w, http.StatusOK, map[string]interface{}{"results": creators, "next_cursor": ""})
		return
	}
	posts, next, err := s.queryPosts(r.Context(), userID, options)
	if err != nil {
		writeError(w, http.StatusInternalServerError, "feed query failed")
		return
	}
	writeJSON(w, http.StatusOK, map[string]interface{}{"results": posts, "next_cursor": next})
}

func (s *Server) queryPosts(ctx context.Context, userID int64, options feedOptions) ([]post, string, error) {
	if !tableExists(ctx, s.db, "posts_post") {
		return []post{}, "", nil
	}
	limit := options.limit + 1
	likedSelect := "0"
	args := []interface{}{}
	if tableExists(ctx, s.db, "posts_postlike") {
		likedSelect = "EXISTS (SELECT 1 FROM posts_postlike pl WHERE pl.post_id = p.id AND pl.user_id = ?) "
		args = append(args, userID)
	}
	query := `SELECT p.id, p.author_id, u.username,
		COALESCE(NULLIF(ap.display_name, ''), u.username), p.body,
		COALESCE(p.media, ''), COALESCE(p.media_type, ''),
		p.visibility, COALESCE(p.category, ''), COALESCE(p.hashtags, ''),
		p.published_at, COALESCE(p.likes_count, 0), COALESCE(p.comments_count, 0), ` + likedSelect + `
		FROM posts_post p
		JOIN auth_user u ON u.id = p.author_id AND u.is_active = 1
		LEFT JOIN accounts_profile ap ON ap.user_id = p.author_id
		WHERE p.deleted_at IS NULL AND p.suspended_at IS NULL
		AND p.published_at IS NOT NULL AND p.published_at <= CURRENT_TIMESTAMP`
	query, args = addVisibility(query, args, options, s)
	query, args = addFeedFilter(query, args, options, s)
	if !options.cursor.At.IsZero() {
		if options.sort == "oldest" {
			query += " AND (p.published_at > ? OR (p.published_at = ? AND p.id > ?))"
		} else if options.sort == "most_liked" {
			query += " AND (p.likes_count < ? OR (p.likes_count = ? AND (p.published_at < ? OR (p.published_at = ? AND p.id < ?))))"
			args = append(args, options.cursor.Score, options.cursor.Score, options.cursor.At.UTC().Format(time.RFC3339Nano), options.cursor.At.UTC().Format(time.RFC3339Nano), options.cursor.ID)
		} else {
			query += " AND (p.published_at < ? OR (p.published_at = ? AND p.id < ?))"
		}
		if options.sort != "most_liked" {
			args = append(args, options.cursor.At.UTC().Format(time.RFC3339Nano), options.cursor.At.UTC().Format(time.RFC3339Nano), options.cursor.ID)
		}
	}
	switch options.sort {
	case "oldest":
		query += " ORDER BY p.published_at ASC, p.id ASC LIMIT ?"
	case "most_liked":
		query += " ORDER BY p.likes_count DESC, p.published_at DESC, p.id DESC LIMIT ?"
	default:
		if options.kind == "trending" {
			query += " ORDER BY (COALESCE(p.likes_count, 0) + COALESCE(p.comments_count, 0)) DESC, p.published_at DESC, p.id DESC LIMIT ?"
		} else {
			query += " ORDER BY p.published_at DESC, p.id DESC LIMIT ?"
		}
	}
	args = append(args, limit)
	rows, err := s.db.QueryContext(ctx, query, args...)
	if err != nil {
		return nil, "", err
	}

	defer rows.Close()
	results := make([]post, 0, options.limit)
	for rows.Next() {
		var item post
		var published string
		if err := rows.Scan(&item.ID, &item.AuthorID, &item.Username, &item.DisplayName, &item.Body,
			&item.MediaURL, &item.MediaType, &item.Visibility, &item.Category, &item.Hashtags,
			&published, &item.LikesCount, &item.CommentsCount, &item.LikedByMe); err != nil {
			return nil, "", err
		}
		item.PublishedAt = parseDatabaseTime(published)
		item.Locked = item.Visibility != "free" && !canViewPaidPost(ctx, s.db, options.userID, item.AuthorID, item.Visibility)
		if len(results) < options.limit {
			results = append(results, item)
		}
	}
	if err := rows.Err(); err != nil {
		return nil, "", err
	}
	next := ""
	if len(results) == options.limit {
		last := results[len(results)-1]
		next = encodeCursor(cursor{At: last.PublishedAt, ID: last.ID, Score: last.LikesCount})
	}
	return results, next, nil
}

type creator struct {
	ID             int64  `json:"id"`
	Username       string `json:"username"`
	DisplayName    string `json:"display_name"`
	FollowersCount int64  `json:"followers_count"`
}

func (s *Server) queryCreators(ctx context.Context, userID int64, limit int) ([]creator, error) {
	rows, err := s.db.QueryContext(ctx, `SELECT u.id, u.username,
		COALESCE(NULLIF(p.display_name, ''), u.username), COALESCE(p.followers_count, 0)
		FROM auth_user u JOIN accounts_profile p ON p.user_id = u.id
		WHERE u.is_active = 1 AND u.id != ?
		AND NOT EXISTS (SELECT 1 FROM follows_follow f WHERE f.follower_id = ? AND f.following_id = u.id)
		ORDER BY COALESCE(p.followers_count, 0) DESC, u.id ASC LIMIT ?`, userID, userID, limit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	results := make([]creator, 0, limit)
	for rows.Next() {
		var item creator
		if err := rows.Scan(&item.ID, &item.Username, &item.DisplayName, &item.FollowersCount); err != nil {
			return nil, err
		}
		results = append(results, item)
	}
	return results, rows.Err()
}

func addVisibility(query string, args []interface{}, options feedOptions, s *Server) (string, []interface{}) {
	if options.kind == "free" {
		return query + " AND p.visibility = 'free'", args
	}
	if options.kind == "premium" || options.kind == "subscriber" {
		return query + " AND p.visibility IN ('followers', 'subscriber', 'premium') AND " +
			"(" + permissionSQL(options, s) + ")", appendPermissionArgs(args, options.userID, s)
	}
	return query + " AND (p.visibility = 'free' OR " + permissionSQL(options, s) + ")", appendPermissionArgs(args, options.userID, s)
}

func permissionSQL(_ feedOptions, s *Server) string {
	parts := []string{"p.author_id = ?", "EXISTS (SELECT 1 FROM follows_follow f WHERE f.follower_id = ? AND f.following_id = p.author_id)"}
	if tableExists(context.Background(), s.db, "subscriptions_subscription") {
		parts = append(parts, "EXISTS (SELECT 1 FROM subscriptions_subscription sub WHERE sub.subscriber_id = ? AND sub.creator_id = p.author_id AND sub.expires_at > CURRENT_TIMESTAMP AND COALESCE(sub.status, 'active') = 'active')")
	}
	return "(" + strings.Join(parts, " OR ") + ")"
}

func appendPermissionArgs(args []interface{}, userID int64, s *Server) []interface{} {
	args = append(args, userID)
	args = append(args, userID)
	if tableExists(context.Background(), s.db, "subscriptions_subscription") {
		args = append(args, userID)
	}
	return args
}

func addFeedFilter(query string, args []interface{}, options feedOptions, s *Server) (string, []interface{}) {
	switch options.kind {
	case "following":
		query += " AND (p.visibility = 'free' OR p.author_id = ? OR EXISTS (SELECT 1 FROM follows_follow f WHERE f.follower_id = ? AND f.following_id = p.author_id))"
		args = append(args, options.userID, options.userID)
	case "for-you":
		query += " AND (EXISTS (SELECT 1 FROM follows_follow f WHERE f.follower_id = ? AND f.following_id = p.author_id) OR p.visibility = 'free')"
		args = append(args, options.userID)
	case "creator":
		if options.targetID > 0 {
			query += " AND p.author_id = ?"
			args = append(args, options.targetID)
		}
	case "subscriber":
		if !tableExists(context.Background(), s.db, "subscriptions_subscription") {
			return query + " AND 1 = 0", args
		}
		query += " AND EXISTS (SELECT 1 FROM subscriptions_subscription sub WHERE sub.subscriber_id = ? AND sub.creator_id = p.author_id AND sub.expires_at > CURRENT_TIMESTAMP AND COALESCE(sub.status, 'active') = 'active')"
		args = append(args, options.userID)
	case "bookmarks":
		if tableExists(context.Background(), s.db, "bookmarks_bookmark") {
			query += " AND EXISTS (SELECT 1 FROM bookmarks_bookmark b WHERE b.user_id = ? AND b.post_id = p.id)"
			args = append(args, options.userID)
		} else {
			query += " AND 1 = 0"
		}
	case "category":
		if options.category != "" {
			query += " AND lower(p.category) = lower(?)"
			args = append(args, options.category)
		}
	case "hashtag":
		if options.hashtag != "" {
			query += " AND instr(lower(p.hashtags), lower(?)) > 0"
			args = append(args, options.hashtag)
		}
	case "search":
		if options.query != "" {
			query += " AND (lower(p.body) LIKE lower(?) OR lower(u.username) LIKE lower(?) OR lower(ap.display_name) LIKE lower(?))"
			needle := "%" + options.query + "%"
			args = append(args, needle, needle, needle)
		}
	case "media":
		if options.media != "" {
			query += " AND p.media_type = ?"
			args = append(args, options.media)
		} else {
			query += " AND p.media_type IN ('image', 'video')"
		}
		if options.targetID > 0 {
			query += " AND p.author_id = ?"
			args = append(args, options.targetID)
		}
	}
	return query, args
}

func canViewPaidPost(ctx context.Context, db *sql.DB, userID, authorID int64, visibility string) bool {
	if visibility == "followers" || visibility == "premium" {
		var exists bool
		_ = db.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM follows_follow WHERE follower_id = ? AND following_id = ?)", userID, authorID).Scan(&exists)
		if exists {
			return true
		}
	}
	if tableExists(ctx, db, "subscriptions_subscription") {
		var subscribed bool
		_ = db.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM subscriptions_subscription WHERE subscriber_id = ? AND creator_id = ? AND expires_at > CURRENT_TIMESTAMP AND COALESCE(status, 'active') = 'active')", userID, authorID).Scan(&subscribed)
		return subscribed
	}
	return false
}

func tableExists(ctx context.Context, db *sql.DB, table string) bool {
	var exists int
	err := db.QueryRowContext(ctx, "SELECT EXISTS (SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = ?)", table).Scan(&exists)
	return err == nil && exists == 1
}

func parseDatabaseTime(value string) time.Time {
	for _, layout := range []string{time.RFC3339Nano, "2006-01-02 15:04:05.999999-07:00", "2006-01-02 15:04:05"} {
		if parsed, err := time.Parse(layout, value); err == nil {
			return parsed
		}
	}
	return time.Time{}
}

type feedOptions struct {
	kind     string
	userID   int64
	targetID int64
	query    string
	category string
	hashtag  string
	media    string
	sort     string
	limit    int
	cursor   cursor
}

type cursor struct {
	At    time.Time
	ID    int64
	Score int64
}

type post struct {
	ID            int64     `json:"id"`
	AuthorID      int64     `json:"author_id"`
	Username      string    `json:"username"`
	DisplayName   string    `json:"display_name"`
	Body          string    `json:"body"`
	MediaURL      string    `json:"media_url,omitempty"`
	MediaType     string    `json:"media_type,omitempty"`
	Visibility    string    `json:"visibility"`
	Category      string    `json:"category,omitempty"`
	Hashtags      string    `json:"hashtags,omitempty"`
	PublishedAt   time.Time `json:"published_at"`
	LikesCount    int64     `json:"likes_count"`
	CommentsCount int64     `json:"comments_count"`
	LikedByMe     bool      `json:"liked_by_me"`
	Locked        bool      `json:"locked"`
}

func feedOptionsFromRequest(r *http.Request, kind string, userID int64) (feedOptions, error) {
	allowed := map[string]bool{
		"following": true, "explore": true, "creator": true, "subscriber": true,
		"trending": true, "for-you": true, "category": true, "hashtag": true,
		"bookmarks": true, "search": true, "latest": true, "recommended-creators": true,
		"free": true, "premium": true, "media": true,
	}
	if !allowed[kind] {
		return feedOptions{}, errors.New("unknown feed type")
	}
	targetID := int64(0)
	if value := r.URL.Query().Get("creator_id"); value != "" {
		if _, err := fmt.Sscan(value, &targetID); err != nil || targetID < 1 {
			return feedOptions{}, errors.New("creator_id must be a positive integer")
		}
	}
	c, err := decodeCursor(r.URL.Query().Get("cursor"))
	if err != nil {
		return feedOptions{}, err
	}
	return feedOptions{
		kind: kind, userID: userID, targetID: targetID,
		query:    strings.TrimSpace(r.URL.Query().Get("q")),
		category: strings.TrimSpace(r.URL.Query().Get("category")),
		hashtag:  strings.TrimSpace(r.URL.Query().Get("hashtag")),
		media:    strings.TrimSpace(r.URL.Query().Get("media_type")),
		sort:     normalizeSort(r.URL.Query().Get("sort")),
		limit:    parsePositiveInt(r.URL.Query().Get("limit"), 20, 100),
		cursor:   c,
	}, nil
}

func decodeCursor(value string) (cursor, error) {
	if value == "" {
		return cursor{}, nil
	}
	raw, err := base64.RawURLEncoding.DecodeString(value)
	if err != nil {
		return cursor{}, errInvalidCursor
	}
	parts := strings.Split(string(raw), "|")
	if len(parts) < 2 || len(parts) > 3 {
		return cursor{}, errInvalidCursor
	}
	at, err := time.Parse(time.RFC3339Nano, parts[0])
	if err != nil {
		return cursor{}, errInvalidCursor
	}
	var id int64
	if _, err := fmt.Sscan(parts[1], &id); err != nil || id < 1 {
		return cursor{}, errInvalidCursor
	}
	var score int64
	if len(parts) == 3 {
		if _, err := fmt.Sscan(parts[2], &score); err != nil || score < 0 {
			return cursor{}, errInvalidCursor
		}
	}
	return cursor{At: at, ID: id, Score: score}, nil
}

func encodeCursor(c cursor) string {
	return base64.RawURLEncoding.EncodeToString([]byte(c.At.UTC().Format(time.RFC3339Nano) + "|" + strconv.FormatInt(c.ID, 10) + "|" + strconv.FormatInt(c.Score, 10)))
}

func normalizeSort(value string) string {
	switch value {
	case "oldest", "most_liked":
		return value
	default:
		return "newest"
	}
}

func writeJSON(w http.ResponseWriter, status int, value interface{}) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}

func writeError(w http.ResponseWriter, status int, message string) {
	writeJSON(w, status, map[string]string{"detail": message})
}
