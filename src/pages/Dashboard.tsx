import { Link, useLocation } from 'react-router-dom'
import { CATEGORY_LABELS, engine, fmtDate, get, post, type Session, type Storage } from '../api'
import { useAuth } from '../auth'
import { Empty, ErrorBox, Meter, Spinner, useAction, useLoad, useToast } from '../ui'

type Gap = { area: string; label: string; score: number | null }

export default function Dashboard() {
  const { user, setUser, devVerifyUrl: devLink, setDevVerifyUrl: setDevLink } = useAuth()
  const toast = useToast()
  const needVerify = (useLocation().state as { needVerify?: boolean } | null)?.needVerify
  const list = useLoad(() => get<{ interviews: Session[]; storage: Storage }>('/interviews'))
  const act = useLoad(() => engine<{ active: Session | null }>({ action: 'status' }))
  const gapsLoad = useLoad(() => get<{ gaps: Gap[] }>('/resources'))
  const verify = useAction(async () => {
    const r = await post('/auth/resend-verification')
    if (r.user) { setUser(r.user); return }
    toast(`Verification email sent to ${user?.email}`)
    if (r.dev_verify_url) setDevLink(r.dev_verify_url)
  })
  const recent = list.data?.interviews.slice(0, 3) ?? []
  const gaps = gapsLoad.data?.gaps ?? []
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
        <p className="open-sub">One 20-minute spoken interview, then a scored report on exactly where to improve.</p>
        <Link className="btn lime lg" to="/interview/setup">Start an interview</Link>
        <span className="sample-chip">Prototype with sample data</span>
      </div>
      <div className="grid2">
        <section className="card stack">
          <div className="row between"><h2>Recent interviews</h2><Link to="/history">See all</Link></div>
          {list.loading ? <Spinner /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : recent.length === 0 ? (
            <Empty title="No interviews yet">Your first report will show up here.</Empty>
          ) : recent.map((i) => (
            <Link key={i.id} to={`/history/${i.id}`} className="row between" style={{ textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span><b>{CATEGORY_LABELS[i.category]}</b> <span className="muted small">· {i.difficulty} · {fmtDate(i.created_at)}</span></span>
              <span className="pill">{i.feedback_status === 'ready' ? 'Report ready' : i.status === 'in_progress' ? 'In progress' : 'No score'}</span>
            </Link>
          ))}
        </section>
        <section className="card stack">
          <div className="row between"><h2>Learning progress</h2><span className="sample-chip">Sample</span></div>
          {gapsLoad.loading ? <Spinner /> : gaps.length === 0 ? <p className="muted">Finish a practice interview to see your progress here.</p> : gaps.map((g) => (
            <div key={g.area}>
              <div className="row between small"><b>{g.label}</b><span className="muted">{g.score === null ? 'Not scored yet' : `${g.score}/5`}</span></div>
              <Meter lime pct={g.score === null ? 0 : (g.score / 5) * 100} />
            </div>
          ))}
          <Link className="btn ghost sm" style={{ justifySelf: 'start' }} to="/roadmap">Turn gaps into a study plan</Link>
        </section>
      </div>
    </div>
  )
}
