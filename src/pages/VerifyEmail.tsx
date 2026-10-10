import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { post } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, Spinner, useToast } from '../ui'

// Target of the link in the verification email. Works whether or not the user is signed in on this device.
export default function VerifyEmail() {
  const [params] = useSearchParams()
  const { user, setUser, ready } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [error, setError] = useState<unknown>(null)
  const sent = useRef(false)
  useEffect(() => {
    if (!ready || sent.current) return // wait for the session check so a signed-in user's state updates too
    sent.current = true
    post('/auth/verify', { token: params.get('token') || '' })
      .then((r) => { if (user && r.user.id === user.id) setUser(r.user); toast('Email verified. You can start an interview now.'); nav(user ? '/dashboard' : '/login', { replace: true }) })
      .catch(setError)
  }, [ready]) // eslint-disable-line react-hooks/exhaustive-deps
  return (
    <div className="auth-wrap">
      <div className="card auth">
        <h2>Verifying your email</h2>
        {error ? <><ErrorBox error={error} /><Link className="btn" to={user ? '/dashboard' : '/login'}>{user ? 'Back to dashboard' : 'Log in'}</Link></> : <Spinner />}
      </div>
    </div>
  )
}
