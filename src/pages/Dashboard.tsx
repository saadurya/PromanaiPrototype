import { Link, useLocation } from 'react-router-dom'
import { CATEGORY_LABELS, engine, fmtDate, get, post, type Session, type Storage } from '../api'
import { useAuth } from '../auth'
import { Empty, ErrorBox, Meter, PageHead, Spinner, useAction, useLoad, useToast } from '../ui'

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
  const recent = list.data?.interviews.slice(0, 3) ?? []
  return (
    <>
      <PageHead title={`Hi ${user?.name.split(' ')[0]}, ready to practise?`} sub="One 20-minute spoken interview, a scored report, and a record of how you are improving." right={<Link className="btn lime lg" to="/interview/setup">Start new interview</Link>} />
      <div className="stack lg">
        {!user?.verified && (
          <div className="banner info"><span>{needVerify ? 'Verify your email first: starting an interview is locked until you do.' : 'Your email is not verified yet. You can browse, but you cannot start an interview.'}</span><div className="row"><button className="btn sm" onClick={() => verify.run()} disabled={verify.busy}>Resend verification email</button>{devLink && <Link className="btn sm ghost" to={devLink}>Open the emailed link (prototype)</Link>}</div></div>
        )}
        <ErrorBox error={verify.error} />
        {act.data?.active && (
          <div className="banner info"><span><b>Interview in progress:</b> {CATEGORY_LABELS[act.data.active.category]}, {act.data.active.difficulty}.</span><Link className="btn sm" to="/interview/live">Resume</Link></div>
        )}
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
            {list.data && <div><div className="row between small muted"><span>Storage</span><span>{Math.round((list.data.storage.used / 1024) * 10) / 10} KB of {list.data.storage.limit / 1024 / 1024} MB</span></div><Meter pct={(list.data.storage.used / list.data.storage.limit) * 100} /></div>}
          </section>
          <section className="card stack">
            <h2>Warm up first</h2>
            <p className="muted">Check that your voice and the AI work before you start the clock.</p>
            <div className="row"><Link className="btn ghost" to="/voice-test">Voice test</Link><Link className="btn ghost" to="/ai-test">AI test</Link></div>
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
            <h3>Ideas we are weighing</h3>
            <p className="muted">Five add-ons are mocked up as separate pages so you can compare them.</p>
            <Link className="btn" style={{ justifySelf: 'start' }} to="/ideas">Compare the ideas</Link>
          </section>
        </div>
      </div>
    </>
  )
}
