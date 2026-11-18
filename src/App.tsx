import { useEffect, useState } from 'react'
import { NavLink, Navigate, Outlet, Route, Routes, useLocation } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { Spinner, ToastProvider } from './ui'
import Landing from './pages/Landing'
import Setup from './pages/Setup'
import Live from './pages/Live'
import Report from './pages/Report'
import History from './pages/History'
import Settings from './pages/Settings'
import Experiences from './options/Experiences'
import { DailyExperiences, DailyPeer, DailyPlan, DailyTopics } from './options/Daily'
import Home from './pages/Home'
import Dashboard from './pages/Dashboard'
import PeerMocks from './options/PeerMocks'
import Roadmap from './options/Roadmap'

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
        <NavLink to="/home" className="brand"><i />ProManAI</NavLink>
        <nav className="topnav" aria-label="Sections">
          <NavLink to="/daily">Daily practice</NavLink>
          <NavLink to="/interview/setup">New interview</NavLink>
        </nav>
      </header>
      {menuOpen && <button className="backdrop" aria-label="Close menu" onClick={() => setMenuOpen(false)} />}
      <aside className={'side' + (menuOpen ? ' open' : '')} aria-hidden={!menuOpen}>
        <div className="side-head">
          <NavLink to="/home" className="brand"><i />ProManAI</NavLink>
          <button className="side-close" aria-label="Close menu" onClick={() => setMenuOpen(false)}>✕</button>
        </div>
        <nav className="nav" aria-label="Main">
          <NavLink to="/home">Home</NavLink>
          <NavLink to="/interview/setup">New interview</NavLink>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/daily">Daily practice</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="side-foot"><b>{user?.name}</b>{user?.email}<br /><a href="/" onClick={(e) => { e.preventDefault(); signOut() }} style={{ color: '#d6f03b' }}>Sign out</a>
          <span style={{ display: 'block', marginTop: 10, fontSize: '0.75rem' }}>Demo build: the interviewer, scoring and peer sessions are simulated on this device.</span></div>
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
  if (verified && !user.verified) return <Navigate to="/home" replace state={{ needVerify: true }} />
  return <Shell />
}
export default function App() {
  return (
    <AuthProvider>
      <ToastProvider>
        <Routes>
          <Route path="/" element={<Landing />} />
          <Route path="/login" element={<Navigate to="/" replace />} />
          <Route path="/signup" element={<Navigate to="/" replace />} />
          <Route element={<Private />}>
            <Route path="/home" element={<Home />} />
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/daily" element={<DailyExperiences />} />
            <Route path="/daily/plan" element={<DailyPlan />} />
            <Route path="/daily/topics" element={<DailyTopics />} />
            <Route path="/daily/peer" element={<DailyPeer />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:id" element={<Report />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/experiences" element={<Experiences />} />
            <Route path="/peer-mocks" element={<PeerMocks />} />
            <Route path="/roadmap" element={<Roadmap />} />
            <Route path="/ai-tools" element={<Navigate to="/roadmap" replace />} />
            {/* Pre-rework "ideas to compare" routes */}
            <Route path="/ideas" element={<Navigate to="/home" replace />} />
            <Route path="/ideas/industry" element={<Navigate to="/interview/setup" replace />} />
            <Route path="/ideas/experiences" element={<Navigate to="/experiences" replace />} />
            <Route path="/ideas/peer-mocks" element={<Navigate to="/peer-mocks" replace />} />
            <Route path="/ideas/roadmap" element={<Navigate to="/roadmap" replace />} />
            <Route path="/ideas/ai-tools" element={<Navigate to="/ai-tools" replace />} />
          </Route>
          <Route element={<Private verified />}>
            <Route path="/interview/setup" element={<Setup />} />
            <Route path="/interview/live" element={<Live />} />
          </Route>
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </ToastProvider>
    </AuthProvider>
  )
}
