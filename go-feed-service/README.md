# Go Feed Service

This service is a read-only feed query layer over Django's SQLite database. It
does not proxy requests to Django and it never writes users, profiles, follows,
posts, subscriptions, or bookmarks.

Posts are owned by Django in `posts_post`. If migrations have not been run,
feed endpoints correctly return an empty page. The service reads:

`posts_post(id, author_id, body, media, media_type, visibility, category,
hashtags, published_at, deleted_at, suspended_at, likes_count, comments_count)`.
`visibility` is `free`, `followers`, `subscriber`, or `premium`.

Optional tables are discovered at runtime: `subscriptions_subscription` must
provide `subscriber_id`, `creator_id`, `expires_at`, and `status`;
`bookmarks_bookmark` must provide `user_id` and `post_id`.

## Run

From `go-feed-service`:

```powershell
$env:DJANGO_DB_PATH = "..\backend\db.sqlite3"
$env:DJANGO_SECRET_KEY = "<the Django SECRET_KEY>"
go run .
```

The service listens on `FEED_SERVICE_PORT` (default `8081`).

All feed endpoints require an `Authorization: Bearer <Django SimpleJWT access token>` header:

`/api/feed/following`, `/explore`, `/creator?creator_id=1`,
`/subscriber`, `/trending`, `/for-you`, `/category?category=fitness`,
`/hashtag?hashtag=travel`, `/bookmarks`, `/search?q=sea`, `/latest`,
`/recommended-creators`, `/free`, `/premium`, and `/media?media_type=video`.

Common query parameters are `limit` (1-100), `cursor`, and `sort` (`newest`,
`oldest`, or `most_liked`). Responses are
`{"results": [], "next_cursor": "..."}`. Results are newest-first with a
stable `(published_at, id)` cursor; trending ranks engagement first, and
recommended-creators returns active profiles the viewer does not already follow.
Deleted, suspended, unpublished, inactive, and unauthorized content is excluded
server-side.
