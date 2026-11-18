import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ErrorBox, useAction } from '../ui'

export default function Landing() {
  const { user, signIn } = useAuth()
  const nav = useNavigate()
  const enter = useAction(async () => { await signIn('enter', {}); nav('/home', { replace: true }) })
  return (
    <div className="land">
      <header className="land-nav">
        <span className="brand"><i />ProManAI</span>
        <div className="row">
          {user && <Link className="btn" to="/home">Go to home</Link>}
        </div>
      </header>
      <section className="hero">
        <div>
          <h1>Practice the PM interview out loud, then see exactly where you lost points.</h1>
          <p className="lead">A 20-minute spoken mock interview with follow-up questions, followed by a scored report you can act on.</p>
          {user ? (
            <div className="row">
              <Link className="btn lime lg" to="/home">Start an interview</Link>
            </div>
          ) : (
            <div className="stack" style={{ maxWidth: 380, alignItems: 'flex-start' }}>
              <ErrorBox error={enter.error} />
              <button className="btn lime lg" disabled={enter.busy} onClick={() => enter.run()}>{enter.busy ? 'Please wait…' : 'Login'}</button>
              <p className="muted small">One tap for now. Email or phone sign-in comes later.</p>
            </div>
          )}
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
