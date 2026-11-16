import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { Spinner, ToastProvider } from './ui'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Setup from './pages/Setup'
import Live from './pages/Live'
import Report from './pages/Report'
import History from './pages/History'
import Settings from './pages/Settings'
import VerifyEmail from './pages/VerifyEmail'
import { VoiceTest, AiTest } from './pages/Sandbox'
import Experiences from './options/Experiences'
import PeerMocks from './options/PeerMocks'
import Roadmap from './options/Roadmap'
import AiTools from './options/AiTools'

function Shell() {
  const { user, signOut } = useAuth()
  const [menuOpen, setMenuOpen] = useState(false)
  const loc = useLocation()
  useEffect(() => { setMenuOpen(false) }, [loc.pathname])
  useEffect(() => {
    if (!menuOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setMenuOpen(false) }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [menuOpen])
  return (
    <div className="shell">
      <header className="topbar">
        <button className="menu-btn" aria-label={menuOpen ? 'Close menu' : 'Open menu'} aria-expanded={menuOpen} onClick={() => setMenuOpen((v) => !v)}>
          <svg viewBox="0 0 24 24" fill="none" strokeWidth="2.4" strokeLinecap="round"><path d="M4 7h16M4 12h16M4 17h16" /></svg>
        </button>
        <NavLink to="/dashboard" className="brand"><i />ProManAI</NavLink>
        <nav className="topnav" aria-label="Sections">
          <NavLink to="/experiences">Interview experiences</NavLink>
          <NavLink to="/roadmap">Roadmap &amp; resources</NavLink>
        </nav>
      </header>
      {menuOpen && <button className="backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      <aside className={'side' + (menuOpen ? ' open' : '')} aria-hidden={!menuOpen}>
        <div className="side-head">
          <NavLink to="/dashboard" className="brand"><i />ProManAI</NavLink>
          <button className="side-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>✕</button>
        </div>
        <nav className="nav" aria-label="Main">
          <div className="nav-group">Practice</div>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/interview/setup">New interview</NavLink>
          <NavLink to="/history">History</NavLink>
          <div className="nav-group">Experiences</div>
          <NavLink to="/experiences">Interview experiences</NavLink>
          <NavLink to="/peer-mocks">Peer mock interviews</NavLink>
          <div className="nav-group">Learn</div>
          <NavLink to="/roadmap">Roadmap &amp; resources</NavLink>
          <NavLink to="/ai-tools">PM AI tools</NavLink>
          <div className="nav-group">Account</div>
          <NavLink to="/settings">Settings</NavLink>
          <div className="nav-group">Prototype checks</div>
          <NavLink to="/voice-test">Voice test</NavLink>
          <NavLink to="/ai-test">AI test</NavLink>
        </nav>
        <div className="side-foot"><b>{user?.name}</b>{user?.email}<br /><a href="/" onClick={(e) => { e.preventDefault(); signOut() }} style={{ color: '#d6f03b' }}>Sign out</a></div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  )
}

function Private({ verified }: { verified?: boolean }) {
  const { user, ready } = useAuth()
  const loc = useLocation()
  if (!ready) return <div style={{ padding: 40 }}><Spinner /></div>
  if (!user) return <Navigate to="/login" replace state={{ from: loc.pathname }} />
  if (verified && !user.verified) return <Navigate to="/dashboard" replace state={{ needVerify: true }} />
  return <Shell />
}
function Guest() {
  const { user, ready } = useAuth()
  if (!ready) return null
  return user ? <Navigate to="/dashboard" replace /> : <Outlet />
}

export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/verify-email" element={<VerifyEmail />} />
          <Route element={<Guest />}>
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/signup" element={<Auth mode="signup" />} />
          </Route>
          <Route element={<Private />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:id" element={<Report />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/voice-test" element={<VoiceTest />} />
            <Route path="/experiences" element={<Experiences />} />
            <Route path="/peer-mocks" element={<PeerMocks />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/ai-tools" element={<AiTools />} />
            {/* Pre-rework "ideas to compare" routes */}
            <Route path="/ideas" element={<Navigate to="/dashboard" replace />} />
            <Route path="/ideas/industry" element={<Navigate to="/interview/setup" replace />} />
            <Route path="/ideas/experiences" element={<Navigate to="/experiences" replace />} />
            <Route path="/ideas/peer-mocks" element={<Navigate to="/peer-mocks" replace />} />
            <Route path="/ideas/roadmap" element={<Navigate to="/roadmap" replace />} />
            <Route path="/ideas/ai-tools" element={<Navigate to="/ai-tools" replace />} />
          </Route>
          <Route element={<Private verified />}>
            <Route path="/interview/setup" element={<Setup />} />
            <Route path="/interview/live" element={<Live />} />
            <Route path="/ai-test" element={<AiTest />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
