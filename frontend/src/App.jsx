import { useState } from 'react'
import './App.css'

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:8000/api'

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
      <aside className="profile-drawer" onClick={(event) => event.stopPropagation()}>
        <button className="drawer-close" type="button" onClick={onClose}>×</button>
        <div className="drawer-profile">
          <div className="profile-badge profile-badge--large">{user.initials}</div>
          <strong>{user.username}</strong>
          <span>{user.tag}</span>
          <small>0 Fans · 0 Following</small>
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
          <button type="button" onClick={onDarkMode}>☾ <span>{text.dark}</span><b>{darkMode ? 'On' : 'Off'}</b></button>
          <button type="button" onClick={onLanguage}>◎ <span>{text.language}</span><b>⌄</b></button>
        </div>
        <div className="drawer-section drawer-logout">
          <button type="button" onClick={onLogout}>⇥ <span>{text.logout}</span></button>
        </div>
      </aside>
    </div>
  )
}

function ProfileModal({ user, onClose }) {
  return (
    <div className="modal-backdrop" onClick={onClose}>
      <section className="profile-modal" onClick={(event) => event.stopPropagation()}>
        <button type="button" onClick={onClose}>×</button>
        <div className="profile-badge profile-badge--large">{user.initials}</div>
        <h2>{user.username}</h2>
        <p>{user.tag}</p>
        <div><strong>0</strong><span>Fans</span><strong>0</strong><span>Following</span></div>
      </section>
    </div>
  )
}

function HomePage({ user, onLogout }) {
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
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

  return (
    <div className={darkMode ? 'home-page home-page--dark' : 'home-page'}>
      <aside className="home-sidebar">
        <button className="profile-badge profile-badge--button" type="button" onClick={() => setDrawerOpen(true)}>{user.initials}</button>
        <nav>
          {menuItems.map(([icon, label, active]) => (
            <div className={active ? 'menu-item menu-item--active' : 'menu-item'} key={label}>
              <span>{icon}</span>
              {label}
            </div>
          ))}
        </nav>
        <button className="new-post-button" type="button"><b>＋</b> {text.newPost}</button>
      </aside>

      <section className="home-feed">
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
        </article>
      </section>

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
          setProfileOpen(true)
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
      {profileOpen && <ProfileModal user={user} onClose={() => setProfileOpen(false)} />}
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
  const [password, setPassword] = useState('')
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

  async function handleSubmit(event) {
    event.preventDefault()
    setError('')
    setIsLoading(true)

    try {
      const response = await fetch(`${API_URL}/auth/${isRegistering ? 'register' : 'login'}/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password }),
      })
      const data = await response.json()

      if (!response.ok) {
        const message = data.email?.[0] || data.password?.[0] || data.non_field_errors?.[0]
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

  if (showHome) return <HomePage user={user || currentUser} onLogout={logout} />

  if (showTerms) {
    return (
      <>
        <HomePage user={user || currentUser} onLogout={logout} />
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
          <input
            id="password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete={isRegistering ? 'new-password' : 'current-password'}
            required
          />
          <button type="submit" disabled={isLoading || !email || !password}>
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
