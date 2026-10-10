import { Link, NavLink, Navigate, Outlet, Route, Routes, useLocation, useParams } from 'react-router-dom'
import { AuthProvider, useAuth } from './auth'
import { Spinner, ToastProvider, useCandidateView } from './ui'
import Landing from './pages/Landing'
import Auth from './pages/Auth'
import Dashboard from './pages/Dashboard'
import Setup from './pages/Setup'
import Live from './pages/Live'
import Report from './pages/Report'
import History from './pages/History'
import Settings from './pages/Settings'
import StudyPlan from './pages/StudyPlan'
import Disclaimer from './pages/Disclaimer'
import { VoiceTest, AiTest } from './pages/Sandbox'
import Hub from './options/Hub'
import Experiences from './options/Experiences'
import PeerMocks from './options/PeerMocks'
import AiTools, { AiToolDetail } from './pages/AiTools'

const OPTIONS = [
  { to: '/ideas/experiences', n: 1, label: 'Interview experiences' },
  { to: '/ideas/peer-mocks', n: 2, label: 'Peer mock interviews' },
]

function Shell() {
  const { user, signOut } = useAuth()
  const [candidate] = useCandidateView()
  // Distraction-free interview: no menu while the clock runs, only a way out that keeps the interview open
  if (useLocation().pathname === '/interview/live') return (
    <div className="focus-shell">
      <header className="focus-bar">
        <span className="brand" style={{ padding: 0 }}><i />ProManAI</span>
        <span className="small">Focus mode: the menu is hidden during your interview.</span>
        <Link className="btn sm ghost" to="/dashboard" title="Your interview stays open. Resume it from the dashboard.">Leave for now</Link>
      </header>
      <main className="main focus-main"><Outlet /></main>
    </div>
  )
  return (
    <div className="shell">
      <aside className="side">
        <NavLink to="/dashboard" className="brand"><i />ProManAI</NavLink>
        <nav className="nav" aria-label="Main">
          <div className="nav-group">Practice</div>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/interview/setup">New interview</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/study-plan">Study plan</NavLink>
          <NavLink to="/ai-tools">AI tools</NavLink>
          <NavLink to="/voice-test">Voice test</NavLink>
          {!candidate && <NavLink to="/ai-test">AI test</NavLink>}
          {!candidate && (<>
            <div className="nav-group">Ideas to compare</div>
            <NavLink to="/ideas" end>Overview</NavLink>
            {OPTIONS.map((o) => <NavLink key={o.to} to={o.to}><span className="opt-n">{o.n}</span>{o.label}</NavLink>)}
          </>)}
          <div className="nav-group">Account</div>
          <NavLink to="/settings">Settings</NavLink>
        </nav>
        <div className="side-foot"><b>{user?.name}</b>{user?.email}<br /><a href="/" onClick={(e) => { e.preventDefault(); signOut() }} style={{ color: '#d6f03b' }}>Sign out</a> · <Link to="/disclaimer" style={{ color: '#d6f03b' }}>Disclaimer</Link></div>
      </aside>
      <main className="main"><Outlet /></main>
    </div>
  )
}

// old /ideas/ai-tools links keep working
function ToolRedirect() {
  const { id } = useParams()
  return <Navigate to={`/ai-tools/${id}`} replace />
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
          <Route path="/disclaimer" element={<Disclaimer />} />
          <Route element={<Guest />}>
            <Route path="/login" element={<Auth mode="login" />} />
            <Route path="/signup" element={<Auth mode="signup" />} />
          </Route>
          <Route element={<Private />}>
            <Route path="/dashboard" element={<Dashboard />} />
            <Route path="/history" element={<History />} />
            <Route path="/history/:id" element={<Report />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/study-plan" element={<StudyPlan />} />
            <Route path="/voice-test" element={<VoiceTest />} />
            <Route path="/ideas" element={<Hub />} />
            <Route path="/ideas/industry" element={<Navigate to="/interview/setup" replace />} />
            <Route path="/ideas/experiences" element={<Experiences />} />
            <Route path="/ideas/peer-mocks" element={<PeerMocks />} />
            <Route path="/ideas/roadmap" element={<Navigate to="/study-plan" replace />} />
            <Route path="/ai-tools" element={<AiTools />} />
            <Route path="/ai-tools/:id" element={<AiToolDetail />} />
            <Route path="/ideas/ai-tools" element={<Navigate to="/ai-tools" replace />} />
            <Route path="/ideas/ai-tools/:id" element={<ToolRedirect />} />
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
