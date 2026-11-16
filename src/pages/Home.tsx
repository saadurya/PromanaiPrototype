import { Link, useLocation } from 'react-router-dom'
import { CATEGORY_LABELS, engine, get, post, type Session, type Storage } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, useAction, useLoad, useToast } from '../ui'

export default function Home() {
  const { user, setUser, devVerifyUrl: devLink, setDevVerifyUrl: setDevLink } = useAuth()
  const toast = useToast()
  const needVerify = (useLocation().state as { needVerify?: boolean } | null)?.needVerify
  const list = useLoad(() => get<{ interviews: Session[]; storage: Storage }>('/interviews'))
  const act = useLoad(() => engine<{ active: Session | null }>({ action: 'status' }))
  const verify = useAction(async () => {
    const r = await post('/auth/resend-verification')
    if (r.user) { setUser(r.user); return }
    toast(`Verification email sent to ${user?.email}`)
    if (r.dev_verify_url) setDevLink(r.dev_verify_url)
  })
  return (
    <div className="stack lg">
      {!user?.verified && (
        <div className="banner info"><span>{needVerify ? 'Verify your email first: starting an interview is locked until you do.' : 'Your email is not verified yet. You can browse, but you cannot start an interview.'}</span><div className="row"><button className="btn sm" onClick={() => verify.run()} disabled={verify.busy}>Resend verification email</button>{devLink && <Link className="btn sm ghost" to={devLink}>Open the emailed link (prototype)</Link>}</div></div>
      )}
      <ErrorBox error={verify.error} />
      {act.data?.active && (
        <div className="banner info"><span><b>Interview in progress:</b> {CATEGORY_LABELS[act.data.active.category]}, {act.data.active.difficulty}.</span><Link className="btn sm" to="/interview/live">Resume</Link></div>
      )}
      {list.data?.storage.full && <div className="err" role="alert"><span>Storage is full, so you cannot start a new interview.</span><Link className="btn sm ghost" to="/history">Free up space</Link></div>}
      <div className="open">
        <p className="open-hi">Hi {user?.name.split(' ')[0]}</p>
        <h1>Practice your PM interview with AI.</h1>
        <p className="open-sub">A prototype interview flow with sample questions, follow-ups and a scored feedback report.</p>
        <Link className="btn lime lg" to="/interview/setup">Start an interview</Link>
        <span className="sample-chip">Prototype with sample data</span>
      </div>
    </div>
  )
}
