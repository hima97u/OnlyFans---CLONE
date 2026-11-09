import { useCallback, useEffect, useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

async function authenticatedFetch(path, options = {}, onSessionExpired) {
  const headers = new Headers(options.headers || {})
  const accessToken = localStorage.getItem('access_token')
  if (accessToken) headers.set('Authorization', `Bearer ${accessToken}`)

  let response = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (response.status !== 401) return response

  const refreshToken = localStorage.getItem('refresh_token')
  if (!refreshToken) {
    onSessionExpired()
    throw new Error('Your session has expired. Please log in again.')
  }

  const refreshResponse = await fetch(`${API_URL}/auth/token/refresh/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refresh: refreshToken }),
  })
  if (!refreshResponse.ok) {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    onSessionExpired()
    throw new Error('Your session has expired. Please log in again.')
  }

  const refreshed = await refreshResponse.json()
  localStorage.setItem('access_token', refreshed.access)
  headers.set('Authorization', `Bearer ${refreshed.access}`)
  response = await fetch(`${API_URL}${path}`, { ...options, headers })
  if (response.status === 401) {
    onSessionExpired()
    throw new Error('Your session has expired. Please log in again.')
  }
  return response
}

function formatUser(user) {
  const username = user.username || user.email?.split('@')[0] || 'User'
  const fullName = user.full_name || user.display_name || user.name || username
  return {
    ...user,
    username,
    full_name: fullName,
    tag: user.tag || `@${username}`,
    initials: getInitials(fullName, username),
  }
}

function getInitials(fullName, username = '') {
  return fullName
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((namePart) => namePart[0])
    .join('')
    .toUpperCase() || username.slice(0, 2).toUpperCase()
}

function BrandMark({ small = false }) {
  return (
    <span className={small ? 'brand-mark brand-mark--small' : 'brand-mark'} aria-hidden="true">
      <span />
    </span>
  )
}

const translations = {
  English: { home: 'Home', discover: 'Discover', notifications: 'Notifications', messages: 'Messages', collections: 'Collections', subscriptions: 'Subscriptions', addCard: 'Add card', profile: 'My profile', more: 'More', newPost: 'NEW POST', settings: 'Settings', dark: 'Dark mode', language: 'English', logout: 'Log out' },
  Hindi: { home: 'होम', discover: 'डिस्कवर', notifications: 'सूचनाएं', messages: 'संदेश', collections: 'कलेक्शन', subscriptions: 'सब्सक्रिप्शन', addCard: 'कार्ड जोड़ें', profile: 'मेरी प्रोफ़ाइल', more: 'और', newPost: 'नई पोस्ट', settings: 'सेटिंग्स', dark: 'डार्क मोड', language: 'हिंदी', logout: 'लॉग आउट' },
}

function ProfileDrawer({ user, darkMode, language, onProfile, onDarkMode, onLanguage, onLogout, onClose }) {
  const text = translations[language]
  return (
    <div className="drawer-backdrop" onClick={onClose}>
      <aside className={darkMode ? 'profile-drawer profile-drawer--dark' : 'profile-drawer'} onClick={(event) => event.stopPropagation()}>
        <button className="drawer-close" type="button" onClick={onClose}>×</button>
        <div className="drawer-profile">
          <div className="profile-badge profile-badge--large">{user.initials}</div>
          <strong>{user.full_name}</strong>
          <span>{user.tag}</span>
          <small>{user.followers_count || 0} Fans · {user.following_count || 0} Following</small>
        </div>
        <div className="drawer-section">
          <button type="button" onClick={onProfile}>◎ <span>{text.profile}</span></button>
          <button type="button">◈ <span>{text.discover}</span></button>
          <button type="button">☆ <span>{text.collections}</span></button>
          <button type="button">⚙ <span>{translations[language].settings}</span></button>
        </div>
        <div className="drawer-section">
          <button type="button">▤ <span>Your cards <em>(to subscribe)</em></span></button>
          <button type="button">♜ <span>Become a creator <em>(to earn)</em></span></button>
        </div>
        <div className="drawer-section">
          <button type="button">? <span>Help and support</span></button>
          <div className="drawer-setting-row">
            <span className="drawer-setting-icon" aria-hidden="true">☾</span>
            <span>{text.dark}</span>
            <label className="theme-switch" aria-label={`${text.dark}: ${darkMode ? 'On' : 'Off'}`}>
              <input type="checkbox" checked={darkMode} onChange={onDarkMode} />
              <span className="theme-switch-track" />
            </label>
          </div>
          <button type="button" onClick={onLanguage}>◎ <span>{text.language}</span><b>⌄</b></button>
        </div>
        <div className="drawer-section drawer-logout">
          <button type="button" onClick={onLogout}>⇥ <span>{text.logout}</span></button>
        </div>
      </aside>
    </div>
  )
}

function SettingsPage({ user, darkMode, onBack, onSave, onPasswordChange, onDelete }) {
  const [section, setSection] = useState('profile')
  const [form, setForm] = useState({
    username: user.username,
    display_name: user.display_name || '',
    bio: user.bio || '',
  })
  const [avatar, setAvatar] = useState(null)
  const [isSaving, setIsSaving] = useState(false)
  const [error, setError] = useState('')
  const [passwords, setPasswords] = useState({ current_password: '', new_password: '' })
  const [deletePassword, setDeletePassword] = useState('')
  const [message, setMessage] = useState('')

  async function handleSave(event) {
    event.preventDefault()
    setIsSaving(true)
    setError('')
    try {
      await onSave(form, avatar)
      setMessage('Profile updated successfully.')
    } catch (saveError) {
      setError(saveError.message)
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <section className={darkMode ? 'settings-page settings-page--dark' : 'settings-page'}>
      <aside className="settings-sidebar">
        <button className="settings-back" type="button" onClick={onBack}>← SETTINGS</button>
        <strong>{user.tag}</strong>
        <button className={section === 'profile' ? 'settings-nav settings-nav--active' : 'settings-nav'} type="button" onClick={() => setSection('profile')}>Profile &gt;</button>
        <button className={section === 'account' ? 'settings-nav settings-nav--active' : 'settings-nav'} type="button" onClick={() => setSection('account')}>Account &gt;</button>
      </aside>
      <div className="settings-content">
        <header className="settings-header">
          <strong>{section === 'profile' ? 'EDIT PROFILE' : 'ACCOUNT'}</strong>
          {section === 'profile' && <button type="submit" form="profile-form" disabled={isSaving}>{isSaving ? 'SAVING...' : 'SAVE'}</button>}
        </header>
        {section === 'profile'
          ? <form id="profile-form" className="settings-form" onSubmit={handleSave}>
            <div className="settings-cover"><div className="profile-cover-shape" /></div>
            <div className="settings-avatar">
              {user.avatar_url ? <img src={user.avatar_url} alt="" /> : <span>{user.initials}</span>}
              <label className="avatar-edit-button" htmlFor="settings-avatar" aria-label="Change profile photo">✦</label>
              <input id="settings-avatar" type="file" accept="image/*" onChange={(event) => setAvatar(event.target.files[0])} />
            </div>
            <label htmlFor="settings-username">Username</label>
            <input id="settings-username" value={form.username} onChange={(event) => setForm({ ...form, username: event.target.value })} maxLength="150" required />
            <label htmlFor="settings-display-name">Display name</label>
            <input id="settings-display-name" value={form.display_name} onChange={(event) => setForm({ ...form, display_name: event.target.value })} maxLength="100" />
            <label htmlFor="settings-bio">Bio</label>
            <textarea id="settings-bio" value={form.bio} onChange={(event) => setForm({ ...form, bio: event.target.value })} maxLength="500" />
          </form>
          : <div className="settings-account">
            <h3>Account info</h3>
            <div className="account-row"><span>Email</span><strong>{user.email}</strong></div>
            <h3>Security</h3>
            <form onSubmit={async (event) => {
              event.preventDefault()
              setError('')
              setMessage('')
              try {
                await onPasswordChange(passwords)
                setPasswords({ current_password: '', new_password: '' })
                setMessage('Password updated successfully.')
              } catch (passwordError) {
                setError(passwordError.message)
              }
            }}>
              <label htmlFor="current-password">Current password</label>
              <input id="current-password" type="password" value={passwords.current_password} onChange={(event) => setPasswords({ ...passwords, current_password: event.target.value })} required />
              <label htmlFor="new-password">New password</label>
              <input id="new-password" type="password" value={passwords.new_password} onChange={(event) => setPasswords({ ...passwords, new_password: event.target.value })} minLength="8" required />
              <button className="settings-action-button" type="submit">CHANGE PASSWORD</button>
            </form>
            <div className="delete-account">
              <h3>Delete account</h3>
              <p>This permanently deletes your account and profile.</p>
              <form onSubmit={async (event) => {
                event.preventDefault()
                setError('')
                try {
                  await onDelete(deletePassword)
                } catch (deleteError) {
                  setError(deleteError.message)
                }
              }}>
                <label htmlFor="delete-password">Confirm password</label>
                <input id="delete-password" type="password" value={deletePassword} onChange={(event) => setDeletePassword(event.target.value)} required />
                <button className="delete-account-button" type="submit">DELETE ACCOUNT</button>
              </form>
            </div>
          </div>}
        {error && <p className="form-error settings-message">{error}</p>}
        {message && <p className="success-message settings-message">{message}</p>}
      </div>
    </section>
  )
}

function FollowButton({ following, busy, onClick }) {
  return (
    <button
      className={following ? 'follow-button follow-button--following' : 'follow-button'}
      type="button"
      onClick={onClick}
      disabled={busy}
    >
      {busy ? '...' : following ? 'Following' : 'Follow'}
    </button>
  )
}

function PeopleSearch({ onToggleFollow, onLogout }) {
  const [query, setQuery] = useState('')
  const [people, setPeople] = useState([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState('')
  const [busyUserId, setBusyUserId] = useState(null)

  useEffect(() => {
    const trimmedQuery = query.trim()
    if (!trimmedQuery) return undefined
    let cancelled = false
    const timer = setTimeout(async () => {
      setIsLoading(true)
      setError('')
      try {
        const response = await authenticatedFetch(
          `/follows/search/?q=${encodeURIComponent(trimmedQuery)}`,
          {},
          onLogout,
        )
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || 'Unable to search people.')
        if (!cancelled) setPeople(data)
      } catch (searchError) {
        if (!cancelled) setError(searchError.message)
      } finally {
        if (!cancelled) setIsLoading(false)
      }
    }, 250)
    return () => {
      cancelled = true
      clearTimeout(timer)
    }
  }, [query, onLogout])

  function handleSearchChange(event) {
    const nextQuery = event.target.value
    setQuery(nextQuery)
    if (!nextQuery.trim()) {
      setPeople([])
      setError('')
    }
  }

  async function togglePerson(person) {
    setBusyUserId(person.id)
    setError('')
    try {
      await onToggleFollow(person.id, person.is_following)
      setPeople((current) => current.map((item) => item.id === person.id
        ? {
          ...item,
          is_following: !item.is_following,
          followers_count: item.followers_count + (item.is_following ? -1 : 1),
        }
        : item))
    } catch (followError) {
      setError(followError.message)
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <div className="people-search">
      <label className="search-box">
        <input
          type="search"
          value={query}
          onChange={handleSearchChange}
          placeholder="Search people"
          aria-label="Search people"
        />
        <span aria-hidden="true">⌕</span>
      </label>
      {isLoading && <p className="search-hint">Finding creators...</p>}
      {error && <p className="form-error search-hint" role="alert">{error}</p>}
      {!isLoading && query.trim() && !people.length && !error && (
        <p className="search-hint">No people found.</p>
      )}
      {people.map((person) => (
        <div className="people-result" key={person.id}>
          <div className="people-result-avatar">
            {person.avatar_url
              ? <img src={person.avatar_url} alt="" />
              : getInitials(person.full_name || person.display_name || person.username, person.username)}
          </div>
          <div className="people-result-copy">
            <strong>{person.full_name || person.display_name || person.username}</strong>
            <span>@{person.username} · {person.followers_count} followers</span>
          </div>
          <FollowButton
            following={person.is_following}
            busy={busyUserId === person.id}
            onClick={() => togglePerson(person)}
          />
        </div>
      ))}
    </div>
  )
}

function ProfilePage({ user, onEdit, onBack, onToggleFollow, onLogout }) {
  const [followers, setFollowers] = useState([])
  const [following, setFollowing] = useState([])
  const [isLoadingConnections, setIsLoadingConnections] = useState(true)
  const [connectionError, setConnectionError] = useState('')
  const [busyUserId, setBusyUserId] = useState(null)

  async function loadConnections() {
    setIsLoadingConnections(true)
    setConnectionError('')
    try {
      const [followersResponse, followingResponse] = await Promise.all([
        authenticatedFetch(`/follows/followers/${user.id}/`, {}, onLogout),
        authenticatedFetch(`/follows/following/${user.id}/`, {}, onLogout),
      ])
      if (!followersResponse.ok || !followingResponse.ok) {
        throw new Error('Unable to load follow connections.')
      }
      setFollowers(await followersResponse.json())
      setFollowing(await followingResponse.json())
    } catch (error) {
      setConnectionError(error.message)
    } finally {
      setIsLoadingConnections(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadInitialConnections() {
      try {
        const [followersResponse, followingResponse] = await Promise.all([
          authenticatedFetch(`/follows/followers/${user.id}/`, {}, onLogout),
          authenticatedFetch(`/follows/following/${user.id}/`, {}, onLogout),
        ])
        if (!followersResponse.ok || !followingResponse.ok) {
          throw new Error('Unable to load follow connections.')
        }
        const [nextFollowers, nextFollowing] = await Promise.all([
          followersResponse.json(),
          followingResponse.json(),
        ])
        if (!cancelled) {
          setFollowers(nextFollowers)
          setFollowing(nextFollowing)
        }
      } catch (error) {
        if (!cancelled) setConnectionError(error.message)
      } finally {
        if (!cancelled) setIsLoadingConnections(false)
      }
    }
    loadInitialConnections()
    return () => {
      cancelled = true
    }
  }, [user.id, onLogout])

  async function toggleFollow(target) {
    setBusyUserId(target.id)
    setConnectionError('')
    try {
      await onToggleFollow(target.id, following.some((item) => item.id === target.id))
      await loadConnections()
    } catch (error) {
      setConnectionError(error.message)
    } finally {
      setBusyUserId(null)
    }
  }

  return (
    <section className="profile-page">
      <header className="profile-page-header">
        <button type="button" onClick={onBack} aria-label="Back">←</button>
        <strong>{user.full_name}</strong>
        <span>⋮</span>
      </header>
      <div className="profile-cover">
        <div className="profile-cover-shape" />
      </div>
      <div className="profile-summary">
        <div className="profile-avatar-wrap">
          {user.avatar_url
            ? <img className="profile-page-avatar" src={user.avatar_url} alt="" />
            : <div className="profile-page-avatar profile-page-avatar--initials">{user.initials}</div>}
          <i />
        </div>
        <div className="profile-actions">
          <button className="edit-profile-button" type="button" onClick={onEdit}><span aria-hidden="true">✦</span> EDIT PROFILE</button>
          <button className="icon-button" type="button" aria-label="Share profile">↗</button>
        </div>
        <h1>{user.full_name}</h1>
        <p>{user.tag}</p>
        {user.bio && <div className="profile-bio">{user.bio}</div>}
        <div className="profile-stats">
          <span><strong>{user.followers_count || 0}</strong> Followers</span>
          <span><strong>{user.following_count || 0}</strong> Following</span>
        </div>
      </div>
      <div className="profile-tabs">
        <button className="profile-tab profile-tab--active" type="button">NO POSTS</button>
        <button className="profile-tab" type="button">NO MEDIA</button>
      </div>
      <div className="profile-empty-state">
        <div className="empty-art">▱ ◇ ▱</div>
        <strong>No posts yet</strong>
        <div className="connection-panel">
          <div className="connection-heading">
            <strong>People in your circle</strong>
            <span>{isLoadingConnections ? 'Loading...' : `${followers.length + following.length} connections`}</span>
          </div>
          {connectionError && <p className="form-error" role="alert">{connectionError}</p>}
          {!isLoadingConnections && [...following, ...followers.filter((item) => !following.some((person) => person.id === item.id))].map((person) => (
            <div className="connection-row" key={person.id}>
              <div className="connection-avatar">{person.username.slice(0, 2).toUpperCase()}</div>
              <div>
                <strong>{person.display_name || person.username}</strong>
                <span>@{person.username}</span>
              </div>
              <FollowButton
                following={following.some((item) => item.id === person.id)}
                busy={busyUserId === person.id}
                onClick={() => toggleFollow(person)}
              />
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}

function NotificationPanel({ notifications, unreadCount, isLoading, error, onMarkRead, onMarkAllRead, onClose }) {
  function notificationText(notification) {
    const actor = notification.actor_display_name || notification.actor_username || 'Someone'
    return `${actor} started following you`
  }

  return (
    <div className="notification-backdrop" onClick={onClose}>
      <section
        className="notification-panel"
        role="dialog"
        aria-modal="true"
        aria-labelledby="notification-title"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="notification-panel-header">
          <div>
            <span className="notification-eyebrow">YOUR ACTIVITY</span>
            <h2 id="notification-title">Notifications</h2>
          </div>
          <button type="button" className="notification-close" onClick={onClose} aria-label="Close notifications">×</button>
        </header>
        <div className="notification-toolbar">
          <span>{unreadCount ? `${unreadCount} new` : 'All caught up'}</span>
          {unreadCount > 0 && <button type="button" onClick={onMarkAllRead}>Mark all as read</button>}
        </div>
        {error && <p className="form-error notification-message" role="alert">{error}</p>}
        <div className="notification-list">
          {isLoading && <p className="notification-empty">Loading your notifications...</p>}
          {!isLoading && !notifications.length && <p className="notification-empty">No notifications yet.</p>}
          {!isLoading && notifications.map((notification) => (
            <button
              className={notification.is_read ? 'notification-item' : 'notification-item notification-item--unread'}
              type="button"
              key={notification.id}
              onClick={() => onMarkRead(notification)}
            >
              <span className="notification-avatar">
                {(notification.actor_username || '?').slice(0, 2).toUpperCase()}
              </span>
              <span className="notification-copy">
                <strong>{notificationText(notification)}</strong>
                <small>{new Date(notification.created_at).toLocaleString()}</small>
              </span>
              {!notification.is_read && <i aria-label="Unread notification" />}
            </button>
          ))}
        </div>
      </section>
    </div>
  )
}

function HomePage({ user, onLogout, onUserUpdate, onRefreshUser, onPasswordChange, onDelete }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profilePage, setProfilePage] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [notifications, setNotifications] = useState([])
  const [unreadNotifications, setUnreadNotifications] = useState(0)
  const [notificationLoading, setNotificationLoading] = useState(false)
  const [notificationError, setNotificationError] = useState('')
  const [darkMode, setDarkMode] = useState(localStorage.getItem('dark_mode') === 'true')
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'English')
  const text = translations[language]

  useEffect(() => {
    onRefreshUser()
  }, [onRefreshUser])

  async function loadNotifications() {
    setNotificationLoading(true)
    setNotificationError('')
    try {
      const response = await authenticatedFetch('/notifications/', {}, onLogout)
      const data = await response.json()
      if (!response.ok) throw new Error(data.detail || 'Unable to load notifications.')
      setNotifications(data.results)
      setUnreadNotifications(data.unread_count)
    } catch (error) {
      setNotificationError(error.message)
    } finally {
      setNotificationLoading(false)
    }
  }

  useEffect(() => {
    let cancelled = false
    async function loadNotificationCount() {
      try {
        const response = await authenticatedFetch('/notifications/', {}, onLogout)
        const data = await response.json()
        if (!response.ok) throw new Error(data.detail || 'Unable to load notifications.')
        if (!cancelled) setUnreadNotifications(data.unread_count)
      } catch (error) {
        if (!cancelled) setNotificationError(error.message)
      }
    }
    loadNotificationCount()
    return () => {
      cancelled = true
    }
  }, [onLogout])

  async function markNotificationRead(notification) {
    if (notification.is_read) return
    try {
      const response = await authenticatedFetch(`/notifications/${notification.id}/read/`, {
        method: 'POST',
      }, onLogout)
      if (!response.ok) throw new Error('Unable to update notification.')
      setNotifications((current) => current.map((item) => item.id === notification.id
        ? { ...item, is_read: true }
        : item))
      setUnreadNotifications((count) => Math.max(0, count - 1))
    } catch (error) {
      setNotificationError(error.message)
    }
  }

  async function markAllNotificationsRead() {
    try {
      const response = await authenticatedFetch('/notifications/read-all/', {
        method: 'POST',
      }, onLogout)
      if (!response.ok) throw new Error('Unable to update notifications.')
      setNotifications((current) => current.map((item) => ({ ...item, is_read: true })))
      setUnreadNotifications(0)
    } catch (error) {
      setNotificationError(error.message)
    }
  }

  async function toggleFollow(userId, isFollowing) {
    const response = await authenticatedFetch(`/follows/${userId}/`, {
      method: isFollowing ? 'DELETE' : 'POST',
    }, onLogout)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.detail || 'Unable to update follow status.')
    }
    await onRefreshUser()
    return data
  }
  const menuItems = [
    ['⌂', text.home, true],
    ['◈', text.discover],
    ['♧', text.notifications],
    ['▤', text.messages],
    ['☆', text.collections],
    ['♧', text.subscriptions],
    ['▤', text.addCard],
    ['◎', text.profile],
    ['•••', text.more],
  ]

  if (settingsOpen) {
    return <SettingsPage
      user={user}
      darkMode={darkMode}
      onBack={() => setSettingsOpen(false)}
      onSave={onUserUpdate}
      onPasswordChange={onPasswordChange}
      onDelete={onDelete}
    />
  }

  return (
    <div className={darkMode ? 'home-page home-page--dark' : 'home-page'}>
      <aside className="home-sidebar">
        <button className="profile-badge profile-badge--button" type="button" onClick={() => setDrawerOpen(true)}>{user.initials}</button>
        <nav>
          {menuItems.map(([icon, label, active]) => (
            <div
              className={active || (label === text.profile && profilePage) ? 'menu-item menu-item--active' : 'menu-item'}
              key={label}
              onClick={() => {
                if (label === text.profile) setProfilePage(true)
                if (label === text.notifications) {
                  setNotificationOpen(true)
                  loadNotifications()
                }
              }}
            >
              <span>{icon}</span>
              {label}
              {label === text.notifications && unreadNotifications > 0 && (
                <b className="notification-badge">{unreadNotifications > 9 ? '9+' : unreadNotifications}</b>
              )}
            </div>
          ))}
        </nav>
        <button className="new-post-button" type="button"><b>＋</b> {text.newPost}</button>
      </aside>

      {profilePage
        ? <ProfilePage
          user={user}
          onEdit={() => setSettingsOpen(true)}
          onBack={() => setProfilePage(false)}
          onToggleFollow={toggleFollow}
          onLogout={onLogout}
        />
        : <section className="home-feed">
        <header className="feed-header">
          <strong>HOME</strong>
          <span>⋮</span>
        </header>
        <div className="compose-box">
          <span>Compose new post...</span>
          <div className="compose-tools"><span>▧</span><span>⚑</span><span>♧</span><span>Aa</span></div>
        </div>
        <div className="feed-filter"><span>All</span><b>✎</b></div>
        <article className="home-post">
          <header>
            <BrandMark small />
            <div><strong>OnlyFans ✓</strong><span>@onlyfans</span></div>
            <time>4 hours ago ...</time>
          </header>
          <p>
            From stone walls to sea views, <a href="#petitemmatv">@petitemmatv</a> explores
            Costa Brava, uncovering why this Spanish gem has captured so much attention.
            🌅 🇪🇸<br />
            <a href="#links">onlyfans.com/petitemmatv</a> / <a href="#links">onlyfans.com/oftv</a>
          </p>
          <div className="post-placeholder">
            <span>▶</span>
            <span className="placeholder-label">Featured post preview</span>
          </div>
          <div className="post-actions" aria-label="Post actions">
            <button type="button" aria-label="Like post"><span aria-hidden="true">♡</span><small>Like</small></button>
            <button type="button" aria-label="Comment on post"><span aria-hidden="true">◌</span><small>Comment</small></button>
            <button type="button" aria-label="Share post"><span aria-hidden="true">↗</span><small>Share</small></button>
            <button className="post-bookmark" type="button" aria-label="Save post"><span aria-hidden="true">◇</span></button>
          </div>
        </article>
        </section>}

      <aside className="home-discover">
        <PeopleSearch onToggleFollow={toggleFollow} onLogout={onLogout} />
        <div className="suggestion-heading"><strong>SUGGESTIONS</strong><span>♢  ⟳  &lt;  &gt;</span></div>
        <div className="discover-card discovery-banner"><strong>DISCOVERY</strong><span>▶</span></div>
        <div className="discover-card creator-card creator-card--one"><strong>Yoga with Eva</strong><span>@evamartinezyoga</span></div>
        <div className="discover-card creator-card creator-card--two"><strong>Olivia Jaymes Private ...</strong><span>@oliviajaymesprivateclinic</span></div>
        <div className="carousel-dots">●●●●●●●●●●●</div>
        <button className="discover-button" type="button">DISCOVER MORE</button>
        <footer>Privacy · Cookie Notice · Terms of Service</footer>
      </aside>
      <button className="help-button" type="button" aria-label="Help">?</button>
      {drawerOpen && <ProfileDrawer
        user={user}
        darkMode={darkMode}
        language={language}
        onClose={() => setDrawerOpen(false)}
        onProfile={() => {
          setDrawerOpen(false)
          setProfilePage(true)
        }}
        onDarkMode={() => {
          const next = !darkMode
          setDarkMode(next)
          localStorage.setItem('dark_mode', String(next))
        }}
        onLanguage={() => {
          const next = language === 'English' ? 'Hindi' : 'English'
          setLanguage(next)
          localStorage.setItem('language', next)
        }}
        onLogout={onLogout}
      />}
      {notificationOpen && <NotificationPanel
        notifications={notifications}
        unreadCount={unreadNotifications}
        isLoading={notificationLoading}
        error={notificationError}
        onMarkRead={markNotificationRead}
        onMarkAllRead={markAllNotificationsRead}
        onClose={() => setNotificationOpen(false)}
      />}
    </div>
  )
}

function TermsModal({ onAccept }) {
  return (
    <div className="modal-backdrop">
      <section className="terms-modal" role="dialog" aria-modal="true" aria-labelledby="terms-title">
        <div className="modal-brand"><BrandMark /><strong id="terms-title">OnlyFans</strong></div>
        <p>Please acknowledge and accept our updated <a href="#terms">Terms of Service</a> and <a href="#privacy">Privacy Policy</a>.</p>
        <button type="button" onClick={onAccept}>ACCEPT</button>
      </section>
    </div>
  )
}

function App() {
  const [email, setEmail] = useState('')
  const [username, setUsername] = useState('')
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [isRegistering, setIsRegistering] = useState(false)
  const [error, setError] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(
    Boolean(localStorage.getItem('access_token')),
  )
  const [showTerms, setShowTerms] = useState(
    Boolean(localStorage.getItem('access_token')) &&
      !localStorage.getItem('terms_accepted'),
  )
  const [showHome, setShowHome] = useState(
    Boolean(localStorage.getItem('access_token')) &&
      Boolean(localStorage.getItem('terms_accepted')),
  )
  const storedUserValue = JSON.parse(localStorage.getItem('user') || 'null')
  const storedUser = storedUserValue ? formatUser(storedUserValue) : null
  const currentUser = storedUser || formatUser({})
  const [user, setUser] = useState(storedUser)
  const canSubmit = Boolean(
    email &&
    password &&
    (!isRegistering || (username && confirmPassword && password === confirmPassword)),
  )

  const logout = useCallback(() => {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('terms_accepted')
    localStorage.removeItem('user')
    setUser(null)
    setIsLoggedIn(false)
    setShowHome(false)
    setShowTerms(false)
  }, [])

  async function updateUser(profileForm, avatar) {
    const formData = new FormData()
    Object.entries(profileForm).forEach(([key, value]) => formData.append(key, value))
    if (avatar) formData.append('avatar', avatar)
    const response = await authenticatedFetch('/auth/profile/', {
      method: 'PATCH',
      headers: { Authorization: `Bearer ${localStorage.getItem('access_token')}` },
      body: formData,
    }, logout)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(Object.values(data).flat()[0] || 'Unable to save profile.')
    }
    const updatedUser = formatUser(data)
    localStorage.setItem('user', JSON.stringify(updatedUser))
    setUser(updatedUser)
  }

  const refreshUser = useCallback(async () => {
    const response = await authenticatedFetch('/auth/me/', {}, logout)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(data.detail || 'Unable to refresh your profile.')
    }
    const refreshedUser = formatUser(data)
    localStorage.setItem('user', JSON.stringify(refreshedUser))
    setUser(refreshedUser)
    return refreshedUser
  }, [logout])

  async function changePassword(passwords) {
    const response = await authenticatedFetch('/auth/password/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(passwords),
    }, logout)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(Object.values(data).flat()[0] || 'Unable to change password.')
    }
  }

  async function deleteAccount(password) {
    const response = await authenticatedFetch('/auth/delete/', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${localStorage.getItem('access_token')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({ password }),
    }, logout)
    const data = await response.json()
    if (!response.ok) {
      throw new Error(Object.values(data).flat()[0] || 'Unable to delete account.')
    }
    logout()
  }

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/${isRegistering ? 'register' : 'login'}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email,
          username: isRegistering ? username : undefined,
          password,
          confirm_password: isRegistering ? confirmPassword : undefined,
        }),
      })
      const data = await response.json()

      if (!response.ok) {
        const message = data.email?.[0]
          || data.username?.[0]
          || data.password?.[0]
          || data.confirm_password?.[0]
          || data.non_field_errors?.[0]
        throw new Error(message || 'Unable to authenticate. Please try again.')
      }

      localStorage.setItem('access_token', data.access)
      localStorage.setItem('refresh_token', data.refresh)
      const authenticatedUser = formatUser(data.user)
      localStorage.setItem('user', JSON.stringify(authenticatedUser))
      setUser(authenticatedUser)
      setIsLoggedIn(true)
      setShowTerms(true)
    } catch (requestError) {
      setError(
        requestError instanceof TypeError
          ? 'The server is unavailable. Please start the backend and try again.'
          : requestError.message,
      )
    } finally {
      setIsLoading(false)
    }
  }

  if (showHome) return <HomePage user={user || currentUser} onLogout={logout} onUserUpdate={updateUser} onRefreshUser={refreshUser} onPasswordChange={changePassword} onDelete={deleteAccount} />

  if (showTerms) {
    return (
      <>
        <HomePage user={user || currentUser} onLogout={logout} onUserUpdate={updateUser} onRefreshUser={refreshUser} onPasswordChange={changePassword} onDelete={deleteAccount} />
        <TermsModal onAccept={() => {
          localStorage.setItem('terms_accepted', 'true')
          setShowTerms(false)
          setShowHome(true)
        }} />
      </>
    )
  }

  return (
    <main>
      <section className="auth-hero">
        <div className="hero-copy">
          <div className="brand brand--hero"><BrandMark /><strong>OnlyFans</strong></div>
          <h1>Sign up to support your<br />favorite creators</h1>
        </div>
        <div className="hero-shape hero-shape--one" />
        <div className="hero-shape hero-shape--two" />
      </section>

      <section className="login-panel">
        <form className="login-form" onSubmit={handleSubmit}>
          <label htmlFor="email">{isRegistering ? 'Create account' : 'Log in'}</label>
          <input
            id="email"
            type="email"
            placeholder="Email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            autoComplete="email"
            required
          />
          {isRegistering && <input
            id="username"
            type="text"
            placeholder="Username"
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoComplete="username"
            minLength="3"
            maxLength="30"
            pattern="[A-Za-z0-9_]{3,30}"
            title="Use 3-30 letters, numbers, or underscores."
            required
          />}
          <input
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            required
          />
          {isRegistering && <input
            id="confirm-password"
            type="password"
            placeholder="Confirm password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            autoComplete="new-password"
            minLength="8"
            required
          />}
          <button type="submit" disabled={isLoading || !canSubmit}>
            {isLoading ? 'PLEASE WAIT...' : isRegistering ? 'CREATE ACCOUNT' : isLoggedIn ? 'LOGGED IN' : 'LOG IN'}
          </button>
          {error && <p className="form-error" role="alert">{error}</p>}
          {isLoggedIn && <p className="success-message">You are logged in.</p>}
          <p className="terms">
            By logging in and using OnlyFans, you agree to our
            <a href="#terms"> Terms of Service</a> and
            <a href="#privacy"> Privacy Policy</a>, and confirm that you are at least
            18 years old.
          </p>
          <button
            className="mode-toggle"
            type="button"
            onClick={() => {
              setIsRegistering((current) => !current)
              setError('')
              setConfirmPassword('')
            }}
          >
            {isRegistering ? 'Already have an account? Log in' : 'Create an account'}
          </button>
        </form>
      </section>

      <section className="featured">
        <h2>Latest featured posts</h2>
        <article className="post-card">
          <header>
            <BrandMark small />
            <div>
              <strong>OnlyFans <span className="verified">✓</span></strong>
              <span>@onlyfans</span>
            </div>
            <time>4 hours ago</time>
          </header>
          <p>
            From stone walls to sea views, <a href="#creator">@petitemmatv</a> explores
            Costa Brava, uncovering why this Spanish gem has captured so many hearts.
          </p>
        </article>
      </section>
    </main>
  )
}

export default App
