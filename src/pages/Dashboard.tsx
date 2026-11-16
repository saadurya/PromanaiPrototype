import { Link, useLocation } from 'react-router-dom'
import { CATEGORY_LABELS, engine, fmtDate, get, post, type Session, type Storage } from '../api'
import { useAuth } from '../auth'
import { Empty, ErrorBox, Meter, PageHead, Spinner, useAction, useLoad, useToast } from '../ui'

type Gap = { area: string; label: string; score: number | null }

const PILLARS = [
  { to: '/interview/setup', title: 'Practice interviews', body: 'A 20-minute mock interview with follow-ups, then a scored feedback report.', cta: 'Start practising' },
  { to: '/experiences', title: 'Interview experiences', body: 'See what real interviews asked, how candidates answered, and how experts ranked them. Book a peer mock when you want a live run.', cta: 'Browse experiences' },
  { to: '/roadmap', title: 'Roadmap & resources', body: 'A dated learning plan built around your gaps, backed by a voted resource directory and the PM AI tools worth knowing.', cta: 'Open your roadmap' },
]

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
    <>
      <PageHead title={`Hi ${user?.name.split(' ')[0]}, ready to practise?`} sub="One 20-minute spoken interview, a scored report, and a record of how you are improving." sample right={<Link className="btn lime lg" to="/interview/setup">Start new interview</Link>} />
      <div className="stack lg">
        {!user?.verified && (
          <div className="banner info"><span>{needVerify ? 'Verify your email first: starting an interview is locked until you do.' : 'Your email is not verified yet. You can browse, but you cannot start an interview.'}</span><div className="row"><button className="btn sm" onClick={() => verify.run()} disabled={verify.busy}>Resend verification email</button>{devLink && <Link className="btn sm ghost" to={devLink}>Open the emailed link (prototype)</Link>}</div></div>
        )}
        <ErrorBox error={verify.error} />
        {act.data?.active && (
          <div className="banner info"><span><b>Interview in progress:</b> {CATEGORY_LABELS[act.data.active.category]}, {act.data.active.difficulty}.</span><Link className="btn sm" to="/interview/live">Resume</Link></div>
        )}
        <div className="grid3">
          {PILLARS.map((p) => (
            <Link key={p.to} to={p.to} className="opt-card">
              <h3>{p.title}</h3>
              <p className="muted">{p.body}</p>
              <span className="small" style={{ color: 'var(--violet)', fontWeight: 600 }}>{p.cta} →</span>
            </Link>
          ))}
        </div>
        <div className="grid2">
          <section className="card stack">
            <div className="row between"><h2>Recent interviews</h2><Link to="/history">See all</Link></div>
            {list.loading ? <Spinner /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : recent.length === 0 ? (
              <Empty title="No interviews yet">Your first report will show up here.<Link className="btn" to="/interview/setup">Start your first interview</Link></Empty>
            ) : recent.map((i) => (
              <Link key={i.id} to={`/history/${i.id}`} className="row between" style={{ textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span><b>{CATEGORY_LABELS[i.category]}</b> <span className="muted small">· {i.difficulty} · {fmtDate(i.created_at)}</span></span>
                <span className="pill">{i.feedback_status === 'ready' ? 'Report ready' : i.status === 'in_progress' ? 'In progress' : 'No score'}</span>
              </Link>
            ))}
            {list.data?.storage.full && <div className="err" role="alert"><span>Storage is full, so you cannot start a new interview.</span><Link className="btn sm ghost" to="/history">Free up space</Link></div>}
          </section>
          <section className="card stack">
            <div className="row between"><h2>Learning progress</h2><span className="sample-chip">Sample</span></div>
            <p className="muted small">Average competency scores from your practice interviews. Gaps feed your roadmap.</p>
            {gapsLoad.loading ? <Spinner /> : gaps.length === 0 ? <p className="muted">Finish a practice interview to see your progress here.</p> : gaps.map((g) => (
              <div key={g.area}>
                <div className="row between small"><b>{g.label}</b><span className="muted">{g.score === null ? 'Not scored yet' : `${g.score}/5`}</span></div>
                <Meter lime pct={g.score === null ? 0 : (g.score / 5) * 100} />
              </div>
            ))}
            <Link className="btn ghost sm" style={{ justifySelf: 'start' }} to="/roadmap">Turn gaps into a study plan</Link>
          </section>
        </div>
        {list.data && (
          <p className="small muted row" style={{ gap: 8 }}>
            <span>Storage</span>
            <span style={{ flex: 1, maxWidth: 220 }}><Meter pct={(list.data.storage.used / list.data.storage.limit) * 100} /></span>
            <span>{Math.round((list.data.storage.used / 1024) * 10) / 10} KB of {list.data.storage.limit / 1024 / 1024} MB</span>
          </p>
        )}
      </div>
    </>
  )
}
