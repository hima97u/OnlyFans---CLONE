package main

import (
	"context"
	"database/sql"
	"net/http"
	"net/http/httptest"
	"testing"
	"time"

	"github.com/golang-jwt/jwt/v5"
	_ "modernc.org/sqlite"
)

func testDB(t *testing.T) *sql.DB {
	t.Helper()
	db, err := sql.Open("sqlite", "file::memory:?cache=shared")
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { db.Close() })
	schema := `
	CREATE TABLE auth_user (id INTEGER PRIMARY KEY, username TEXT, is_active BOOLEAN);
	CREATE TABLE accounts_profile (id INTEGER PRIMARY KEY, user_id INTEGER, display_name TEXT);
	CREATE TABLE follows_follow (id INTEGER PRIMARY KEY, follower_id INTEGER, following_id INTEGER);
	CREATE TABLE posts_post (id INTEGER PRIMARY KEY, author_id INTEGER, body TEXT, media TEXT,
		media_type TEXT, visibility TEXT, category TEXT, hashtags TEXT, published_at TEXT,
		deleted_at TEXT, suspended_at TEXT, likes_count INTEGER, comments_count INTEGER);`
	if _, err := db.Exec(schema); err != nil {
		t.Fatal(err)
	}
	_, err = db.Exec(`INSERT INTO auth_user VALUES (1, 'viewer', 1), (2, 'creator', 1);
		INSERT INTO accounts_profile VALUES (1, 1, 'Viewer'), (2, 2, 'Creator');
		INSERT INTO follows_follow VALUES (1, 1, 2);
		INSERT INTO posts_post VALUES
		(1, 2, 'new', '', '', 'free', 'travel', '#sea', '2026-01-02T00:00:00Z', NULL, NULL, 1, 2),
		(2, 2, 'old', '', '', 'free', 'travel', '#sea', '2026-01-01T00:00:00Z', NULL, NULL, 0, 0),
		(3, 2, 'deleted', '', '', 'free', '', '', '2026-01-03T00:00:00Z', '2026-01-03T00:00:00Z', NULL, 0, 0)`)
	if err != nil {
		t.Fatal(err)
	}
	return db
}

func TestEmptyDatabaseReturnsEmptyFeed(t *testing.T) {
	db, err := sql.Open("sqlite", "file::memory:?cache=shared")
	if err != nil {
		t.Fatal(err)
	}
	defer db.Close()
	server := NewServer(db, []byte("secret"), time.Now)
	results, next, err := server.queryPosts(context.Background(), 1, feedOptions{kind: "latest", userID: 1, limit: 20})
	if err != nil || len(results) != 0 || next != "" {
		t.Fatalf("expected empty feed, got results=%v next=%q err=%v", results, next, err)
	}
}

func TestCursorPaginationExcludesDeletedAndMaintainsNewestFirst(t *testing.T) {
	server := NewServer(testDB(t), []byte("secret"), time.Now)
	first, next, err := server.queryPosts(context.Background(), 1, feedOptions{kind: "latest", userID: 1, limit: 1})
	if err != nil || len(first) != 1 || first[0].ID != 1 || next == "" {
		t.Fatalf("unexpected first page: %#v %q %v", first, next, err)
	}
	second, _, err := server.queryPosts(context.Background(), 1, feedOptions{kind: "latest", userID: 1, limit: 1, cursor: cursor{At: first[0].PublishedAt, ID: first[0].ID}})
	if err != nil || len(second) != 1 || second[0].ID != 2 {
		t.Fatalf("unexpected second page: %#v %v", second, err)
	}
}

func TestFeedFiltersAndPermissions(t *testing.T) {
	server := NewServer(testDB(t), []byte("secret"), time.Now)
	results, _, err := server.queryPosts(context.Background(), 1, feedOptions{kind: "hashtag", userID: 1, hashtag: "#sea", limit: 20})
	if err != nil || len(results) != 2 {
		t.Fatalf("expected hashtag results, got %#v %v", results, err)
	}
	results, _, err = server.queryPosts(context.Background(), 1, feedOptions{kind: "bookmarks", userID: 1, limit: 20})
	if err != nil || len(results) != 0 {
		t.Fatalf("expected empty bookmarks without bookmark table, got %#v %v", results, err)
	}
}

func TestFreePostsAppearInFollowingFeedWithoutFollowingCreator(t *testing.T) {
	server := NewServer(testDB(t), []byte("secret"), time.Now)
	if _, err := server.db.Exec("INSERT INTO auth_user VALUES (3, 'other-viewer', 1)"); err != nil {
		t.Fatal(err)
	}
	results, _, err := server.queryPosts(context.Background(), 3, feedOptions{kind: "following", userID: 3, limit: 20})
	if err != nil || len(results) != 2 {
		t.Fatalf("free posts were not visible to another user: %#v %v", results, err)
	}
}

func TestAuthenticationRejectsMissingAndExpiredTokens(t *testing.T) {
	server := NewServer(testDB(t), []byte("secret"), time.Now)
	missing := httptest.NewRecorder()
	server.ServeHTTP(missing, httptest.NewRequest(http.MethodGet, "/api/feed/latest", nil))
	if missing.Code != http.StatusUnauthorized {
		t.Fatalf("missing token status = %d", missing.Code)
	}
	expiredToken, err := jwt.NewWithClaims(jwt.SigningMethodHS256, jwt.MapClaims{
		"sub": "1", "exp": time.Now().Add(-time.Hour).Unix(),
	}).SignedString([]byte("secret"))
	if err != nil {
		t.Fatal(err)
	}
	expired := httptest.NewRecorder()
	request := httptest.NewRequest(http.MethodGet, "/api/feed/latest", nil)
	request.Header.Set("Authorization", "Bearer "+expiredToken)
	server.ServeHTTP(expired, request)
	if expired.Code != http.StatusUnauthorized {
		t.Fatalf("expired token status = %d", expired.Code)
	}
}

func TestExpiredSubscriptionsAndDuplicateBookmarksAreHandled(t *testing.T) {
	server := NewServer(testDB(t), []byte("secret"), time.Now)
	db := server.db
	if _, err := db.Exec(`CREATE TABLE subscriptions_subscription (
		id INTEGER PRIMARY KEY, subscriber_id INTEGER, creator_id INTEGER,
		expires_at TEXT, status TEXT
	); CREATE TABLE bookmarks_bookmark (id INTEGER PRIMARY KEY, user_id INTEGER, post_id INTEGER);
		INSERT INTO subscriptions_subscription VALUES (1, 1, 2, '2020-01-01T00:00:00Z', 'active');
		INSERT INTO bookmarks_bookmark VALUES (1, 1, 1), (2, 1, 1);`); err != nil {
		t.Fatal(err)
	}
	results, _, err := server.queryPosts(context.Background(), 1, feedOptions{kind: "subscriber", userID: 1, limit: 20})
	if err != nil || len(results) != 0 {
		t.Fatalf("expired subscription exposed content: %#v %v", results, err)
	}
	results, _, err = server.queryPosts(context.Background(), 1, feedOptions{kind: "bookmarks", userID: 1, limit: 20})
	if err != nil || len(results) != 1 || results[0].ID != 1 {
		t.Fatalf("duplicate bookmarks produced duplicate posts: %#v %v", results, err)
	}
}
