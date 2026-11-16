import { Link, useLocation } from 'react-router-dom'
import { CATEGORY_LABELS, engine, get, post, type Session, type Storage } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, useAction, useLoad, useToast } from '../ui'

const CHOICES = [
  { to: '/interview/setup', n: '01', title: 'Practice an interview', body: 'A 20-minute mock interview with follow-ups, then a scored feedback report.', cta: 'Set up your interview' },
  { to: '/experiences', n: '02', title: 'Interview experiences', body: 'See what real interviews asked, how candidates answered, and how experts ranked them. Book a peer mock when you want a live run.', cta: 'Browse experiences' },
  { to: '/roadmap', n: '03', title: 'Roadmap & resources', body: 'A dated learning plan built around your gaps, backed by a voted resource directory and the PM AI tools worth knowing.', cta: 'Open your roadmap' },
]

export default function Dashboard() {
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
      <section className="open-hero">
        <p className="open-hero-kicker">Hi {user?.name.split(' ')[0]}</p>
        <h1>Practice the PM interview, then see exactly where to improve.</h1>
        <p className="open-hero-sub">One 20-minute spoken interview, a scored report, and a learning plan built from your gaps. Prototype runs on sample data.</p>
        <Link className="btn lime lg" to="/interview/setup">Start practising →</Link>
      </section>
      <div className="grid3">
        {CHOICES.map((c) => (
          <Link key={c.to} to={c.to} className="opt-card">
            <span className="small" style={{ fontWeight: 700, color: 'var(--violet)' }}>{c.n}</span>
            <h3>{c.title}</h3>
            <p className="muted">{c.body}</p>
            <span className="small" style={{ color: 'var(--violet)', fontWeight: 600 }}>{c.cta} →</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
