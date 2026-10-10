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
import Hub from './options/Hub'
import Industry from './options/Industry'
import Experiences from './options/Experiences'
import PeerMocks from './options/PeerMocks'
import Roadmap from './options/Roadmap'
import AiTools from './options/AiTools'

const OPTIONS = [
  { to: '/ideas/industry', n: 1, label: 'Industry selection' },
  { to: '/ideas/experiences', n: 2, label: 'Interview experiences' },
  { to: '/ideas/peer-mocks', n: 3, label: 'Peer mock interviews' },
  { to: '/ideas/roadmap', n: 4, label: 'Resources and roadmap' },
  { to: '/ideas/ai-tools', n: 5, label: 'PM AI tools' },
]

function Shell() {
  const { user, signOut } = useAuth()
  return (
    <div className="shell">
      <aside className="side">
        <NavLink to="/dashboard" className="brand"><i />ProManAI</NavLink>
        <nav className="nav" aria-label="Main">
          <div className="nav-group">Practice</div>
          <NavLink to="/dashboard">Dashboard</NavLink>
          <NavLink to="/interview/setup">New interview</NavLink>
          <NavLink to="/history">History</NavLink>
          <NavLink to="/voice-test">Voice test</NavLink>
          <NavLink to="/ai-test">AI test</NavLink>
          <div className="nav-group">Ideas to compare</div>
          <NavLink to="/ideas" end>Overview</NavLink>
          {OPTIONS.map((o) => <NavLink key={o.to} to={o.to}><span className="opt-n">{o.n}</span>{o.label}</NavLink>)}
          <div className="nav-group">Account</div>
          <NavLink to="/settings">Settings</NavLink>
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
            <Route path="/ideas" element={<Hub />} />
            <Route path="/ideas/industry" element={<Industry />} />
            <Route path="/ideas/experiences" element={<Experiences />} />
            <Route path="/ideas/peer-mocks" element={<PeerMocks />} />
            <Route path="/ideas/roadmap" element={<Roadmap />} />
            <Route path="/ideas/ai-tools" element={<AiTools />} />
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
