import { useState } from 'react'
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
  return {
    ...user,
    username,
    tag: user.tag || `@${username}`,
    initials: username.slice(0, 2).toUpperCase(),
  }
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
          <strong>{user.username}</strong>
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

function ProfilePage({ user, onEdit, onBack }) {
  return (
    <section className="profile-page">
      <header className="profile-page-header">
        <button type="button" onClick={onBack} aria-label="Back">←</button>
        <strong>{user.display_name || user.username}</strong>
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
        <h1>{user.display_name || user.username}</h1>
        <p>{user.tag} <span>·</span> <b>Available⌄</b></p>
        {user.bio && <div className="profile-bio">{user.bio}</div>}
      </div>
      <div className="profile-tabs">
        <button className="profile-tab profile-tab--active" type="button">NO POSTS</button>
        <button className="profile-tab" type="button">NO MEDIA</button>
      </div>
      <div className="profile-empty-state">
        <div className="empty-art">▱ ◇ ▱</div>
        <strong>No posts yet</strong>
      </div>
    </section>
  )
}

function HomePage({ user, onLogout, onUserUpdate, onPasswordChange, onDelete }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [profilePage, setProfilePage] = useState(false)
  const [darkMode, setDarkMode] = useState(localStorage.getItem('dark_mode') === 'true')
  const [language, setLanguage] = useState(localStorage.getItem('language') || 'English')
  const text = translations[language]
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
              onClick={() => label === text.profile && setProfilePage(true)}
            >
              <span>{icon}</span>
              {label}
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
        <div className="search-box">Search posts <span>⌕</span></div>
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

  function logout() {
    localStorage.removeItem('access_token')
    localStorage.removeItem('refresh_token')
    localStorage.removeItem('terms_accepted')
    localStorage.removeItem('user')
    setUser(null)
    setIsLoggedIn(false)
    setShowHome(false)
    setShowTerms(false)
  }

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

  if (showHome) return <HomePage user={user || currentUser} onLogout={logout} onUserUpdate={updateUser} onPasswordChange={changePassword} onDelete={deleteAccount} />

  if (showTerms) {
    return (
      <>
        <HomePage user={user || currentUser} onLogout={logout} onUserUpdate={updateUser} onPasswordChange={changePassword} onDelete={deleteAccount} />
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
