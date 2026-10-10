import { useState, type FormEvent } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { useAuth } from '../auth'
import { ErrorBox, useAction, useToast } from '../ui'

export default function Auth({ mode }: { mode: 'login' | 'signup' }) {
  const { signIn } = useAuth()
  const nav = useNavigate()
  const from = (useLocation().state as { from?: string } | null)?.from || '/dashboard'
  const toast = useToast()
  const [f, setF] = useState({ name: '', email: '', password: '' })
  const submit = useAction(async () => { await signIn(mode, f); nav(from, { replace: true }) })
  const google = useAction(async () => { await signIn('login', { email: 'demo@promanai.dev', password: 'google' }); nav('/dashboard', { replace: true }) })
  const on = (e: FormEvent) => { e.preventDefault(); submit.run() }
  return (
    <div className="auth-wrap">
      <form className="card auth" onSubmit={on}>
        <Link to="/" className="brand" style={{ color: 'var(--ink)', padding: 0 }}><i />ProManAI</Link>
        <h2>{mode === 'login' ? 'Welcome back' : 'Create your account'}</h2>
        {mode === 'signup' && <label className="field">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} autoComplete="name" required /></label>}
        <label className="field">Email<input type="email" value={f.email} onChange={(e) => setF({ ...f, email: e.target.value })} autoComplete="email" required /></label>
        <label className="field">Password<input type="password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} autoComplete={mode === 'login' ? 'current-password' : 'new-password'} minLength={mode === 'signup' ? 8 : 1} required /></label>
        <ErrorBox error={submit.error ?? google.error} />
        <button className="btn" disabled={submit.busy}>{submit.busy ? 'Please wait…' : mode === 'login' ? 'Log in' : 'Sign up'}</button>
        <button type="button" className="btn ghost" onClick={() => google.run()}>Continue with Google (prototype)</button>
        {mode === 'login' ? (
          <div className="row between small"><button type="button" className="btn sm ghost" onClick={() => toast('Reset link sent (prototype, no email goes out)')}>Forgot password</button><span>New here? <Link to="/signup">Sign up</Link></span></div>
        ) : (
          <p className="small muted">New accounts start unverified: you can look around, but starting an interview needs email verification. <Link to="/login">Log in instead</Link></p>
        )}
        {mode === 'signup' && <p className="small muted">ProManAI is a practice tool: AI feedback can be wrong and is not a hiring assessment. <Link to="/disclaimer">Read the disclaimer</Link></p>}
        <p className="small muted">Prototype: any email and password signs you in.</p>
      </form>
    </div>
  )
}
