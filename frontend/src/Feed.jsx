import { useEffect, useState } from 'react'
import { fetchFeed, postRequest } from './feedApi'

const EMPTY_PARAMS = {}
const MEDIA_BASE_URL = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api').replace(/\/api\/?$/, '')

function mediaUrl(value) {
  if (!value) return value
  if (value.startsWith('http://') || value.startsWith('https://')) return value
  return `${MEDIA_BASE_URL}/media/${value.replace(/^\/+/, '')}`
}

export function Feed({ kind = 'following', params = EMPTY_PARAMS, title = 'FEED', onSessionExpired, refreshKey = 0 }) {
  const [results, setResults] = useState([])
  const [cursor, setCursor] = useState('')
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState('')
  const [sort, setSort] = useState('newest')

  useEffect(() => {
    let cancelled = false
    fetchFeed(kind, { ...params, sort })
      .then((data) => {
        if (!cancelled) {
          setResults(data.results || [])
          setCursor(data.next_cursor || '')
        }
      })
      .catch((feedError) => {
        if (!cancelled) {
          setError(feedError.message)
          if (feedError.message.toLowerCase().includes('token') && onSessionExpired) onSessionExpired()
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })
    return () => { cancelled = true }
  }, [kind, params, onSessionExpired, refreshKey, sort])

  async function loadMore() {
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      const data = await fetchFeed(kind, { ...params, cursor, sort })
      setResults((current) => [...current, ...(data.results || [])])
      setCursor(data.next_cursor || '')
    } catch (feedError) {
      setError(feedError.message)
    } finally {
      setLoadingMore(false)
    }
  }

  async function togglePostLike(post) {
    try {
      const data = await postRequest(`/posts/${post.id}/like/`, { method: post.liked_by_me ? 'DELETE' : 'POST' })
      setResults((current) => current.map((item) => item.id === post.id
        ? { ...item, liked_by_me: data.liked, likes_count: data.likes_count }
        : item))
    } catch (likeError) {
      setError(likeError.message)
      if (likeError.message.includes('401') && onSessionExpired) onSessionExpired()
    }
  }

  return (
    <section className="feed-panel" aria-live="polite">
      <header className="feed-header">
        <strong>{title}</strong>
        <select className="feed-sort" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort feed">
          <option value="newest">Newest</option>
          <option value="oldest">Oldest</option>
          <option value="most_liked">Most liked</option>
        </select>
      </header>
      {loading && <p className="feed-state">Loading feed...</p>}
      {error && <p className="form-error" role="alert">{error}</p>}
      {!loading && !error && results.length === 0 && <p className="feed-state">No posts available.</p>}
      {results.map((post) => (
        <article className="home-post" key={post.id}>
          <header>
            <div><strong>{post.display_name} ✓</strong><span>@{post.username}</span></div>
            <time>{new Date(post.published_at).toLocaleString()}</time>
          </header>
          <p>{post.locked ? 'This post is available to followers or subscribers.' : post.body}</p>
          {post.media_url && !post.locked && (
            post.media_type === 'video'
              ? <video className="feed-media" controls src={mediaUrl(post.media_url)} />
              : <img className="feed-media" src={mediaUrl(post.media_url)} alt="" />
          )}
          <PostInteractions
            post={post}
            onLike={() => togglePostLike(post)}
            onComment={() => setResults((current) => current.map((item) => item.id === post.id
              ? { ...item, comments_count: item.comments_count + 1 }
              : item))}
            onSessionExpired={onSessionExpired}
          />
        </article>
      ))}
      {cursor && <button className="discover-button" type="button" disabled={loadingMore} onClick={loadMore}>{loadingMore ? 'LOADING...' : 'LOAD MORE'}</button>}
    </section>
  )
}

function PostInteractions({ post, onLike, onComment, onSessionExpired }) {
  const [open, setOpen] = useState(false)
  const [comments, setComments] = useState([])
  const [comment, setComment] = useState('')
  const [replyTo, setReplyTo] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  async function loadComments() {
    setLoading(true)
    setError('')
    try {
      setComments(await postRequest(`/posts/${post.id}/comments/`))
    } catch (commentError) {
      setError(commentError.message)
      if (commentError.message.includes('401') && onSessionExpired) onSessionExpired()
    } finally {
      setLoading(false)
    }
  }

  async function submitComment(event) {
    event.preventDefault()
    if (!comment.trim()) return
    try {
      const created = await postRequest(`/posts/${post.id}/comments/`, {
        method: 'POST',
        body: JSON.stringify({ body: comment, parent_id: replyTo || '' }),
      })
      setComments((current) => [...current, created])
      setComment('')
      setReplyTo(null)
      onComment()
    } catch (commentError) {
      setError(commentError.message)
    }
  }

  async function toggleCommentLike(item) {
    try {
      const data = await postRequest(`/posts/comments/${item.id}/like/`, { method: item.liked_by_me ? 'DELETE' : 'POST' })
      setComments((current) => current.map((commentItem) => commentItem.id === item.id
        ? { ...commentItem, liked_by_me: data.liked, likes_count: data.likes_count }
        : commentItem))
    } catch (commentError) {
      setError(commentError.message)
    }
  }

  function toggleComments() {
    const next = !open
    setOpen(next)
    if (next && comments.length === 0) loadComments()
  }

  return (
    <>
      <div className="post-actions">
        <button type="button" className={post.liked_by_me ? 'heart-button heart-button--active' : 'heart-button'} onClick={onLike} aria-label={post.liked_by_me ? 'Unlike post' : 'Like post'}>
          <span aria-hidden="true">♥</span><small>{post.likes_count} Likes</small>
        </button>
        <button type="button" onClick={toggleComments} aria-label="View comments"><span aria-hidden="true">◌</span><small>{post.comments_count} Comments</small></button>
      </div>
      {open && (
        <div className="comments-panel">
          {loading && <p className="feed-state">Loading comments...</p>}
          {error && <p className="form-error" role="alert">{error}</p>}
          {comments.map((item) => (
            <div className={item.parent_id ? 'comment comment--reply' : 'comment'} key={item.id}>
              <strong>{item.display_name}</strong><p>{item.body}</p>
              <button type="button" onClick={() => toggleCommentLike(item)} className={item.liked_by_me ? 'comment-like comment-like--active' : 'comment-like'}>♥ {item.likes_count}</button>
              <button type="button" onClick={() => setReplyTo(item.id)}>Reply</button>
            </div>
          ))}
          <form className="comment-form" onSubmit={submitComment}>
            {replyTo && <small>Replying to a comment <button type="button" onClick={() => setReplyTo(null)}>Cancel</button></small>}
            <input value={comment} onChange={(event) => setComment(event.target.value)} placeholder="Write a comment..." maxLength={2000} />
            <button type="submit">Send</button>
          </form>
        </div>
      )}
    </>
  )
}
