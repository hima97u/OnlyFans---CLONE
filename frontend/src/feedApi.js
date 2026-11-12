const FEED_API_URL = import.meta.env.VITE_FEED_API_URL || 'http://127.0.0.1:8081'
const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

export async function fetchFeed(kind, params = {}) {
  const query = new URLSearchParams()
  Object.entries(params).forEach(([key, value]) => {
    if (value !== undefined && value !== null && value !== '') query.set(key, value)
  })
  const token = localStorage.getItem('access_token')
  const response = await fetch(`${FEED_API_URL}/api/feed/${kind}${query.toString() ? `?${query}` : ''}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  })
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()
  let data = {}
  if (raw && contentType.includes('application/json')) {
    try {
      data = JSON.parse(raw)
    } catch {
      throw new Error(`Feed service returned invalid JSON (HTTP ${response.status}).`)
    }
  }
  if (!contentType.includes('application/json')) {
    throw new Error(`Feed service returned HTML or another non-JSON response (HTTP ${response.status}). Check that Go is running on ${FEED_API_URL}.`)
  }
  if (!response.ok) throw new Error(data.detail || 'Unable to load feed.')
  return data
}

export async function postRequest(path, options = {}) {
  const headers = new Headers(options.headers || {})
  const token = localStorage.getItem('access_token')
  if (token) headers.set('Authorization', `Bearer ${token}`)
  if (!(options.body instanceof FormData) && options.body !== undefined) {
    headers.set('Content-Type', 'application/json')
  }
  const response = await fetch(`${API_URL}${path}`, { ...options, headers })
  const contentType = response.headers.get('content-type') || ''
  const raw = await response.text()
  let data = {}
  if (raw && contentType.includes('application/json')) data = JSON.parse(raw)
  if (!contentType.includes('application/json')) {
    throw new Error(`Django returned a non-JSON response (HTTP ${response.status}).`)
  }
  if (!response.ok) {
    const detail = data.detail || data.non_field_errors?.[0]
    throw new Error(detail || 'Request failed.')
  }
  return data
}
