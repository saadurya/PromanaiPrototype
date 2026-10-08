import { Link } from 'react-router-dom'
import { useAuth } from '../auth'

export default function Landing() {
  const { user } = useAuth()
  return (
    <div className="land">
      <header className="land-nav">
        <span className="brand"><i />ProManAI</span>
        <div className="row">
          {user ? <Link className="btn" to="/dashboard">Go to dashboard</Link> : <><Link className="btn ghost" to="/login">Log in</Link><Link className="btn" to="/signup">Sign up</Link></>}
        </div>
      </header>
      <section className="hero">
        <div>
          <h1>Practice the PM interview out loud, then see exactly where you lost points.</h1>
          <p className="lead">A 20-minute spoken mock interview with an AI interviewer that asks real follow-ups, followed by a scored report you can act on.</p>
          <div className="row">
            <Link className="btn lime lg" to={user ? '/interview/setup' : '/signup'}>{user ? 'Start an interview' : 'Start free'}</Link>
            <Link className="btn ghost lg" to="/login">I already have an account</Link>
          </div>
          <p className="muted small" style={{ marginTop: 14 }}>Built for aspiring APMs and practising PMs. Works best on desktop Chrome or Edge.</p>
        </div>
        <div className="hero-card" aria-hidden="true">
          <div className="row between"><span style={{ color: '#b8a8f0' }}>Time left</span><span className="pill lime">Metrics · Medium</span></div>
          <div className="clock">14:32</div>
          <div className="bubble" style={{ background: 'rgba(255,255,255,.1)' }}><div className="q">Checkout conversion dropped 8% week over week. How do you figure out what happened?</div></div>
          <div className="bubble me">I would first define conversion and its denominator, then segment by channel and release.</div>
        </div>
      </section>
    </div>
  )
}
