import { Link, useLocation } from 'react-router-dom'
import { engine, fmtDate, get, interviewTitle, post, type Session } from '../api'
import { useAuth } from '../auth'
import { Empty, ErrorBox, Meter, PageHead, Spinner, useAction, useCandidateView, useLoad, useToast } from '../ui'
import { recognitionSupported } from '../voice'

type Point = { id: string; date: string; score: number }
type Progress = { scored: number; areas: { area: string; label: string; points: Point[] }[]; focus: { name: string; score: number; previous: number | null; area: string; label: string }[] }

// One area's scores over time on a fixed 1-5 scale, so every row is comparable. The dashed guide marks 3 (a solid answer).
function Trend({ points, label }: { points: Point[]; label: string }) {
  const W = 160, H = 44, PAD = 7
  const x = (k: number) => (points.length === 1 ? W / 2 : PAD + (k * (W - 2 * PAD)) / (points.length - 1))
  const y = (v: number) => PAD + ((5 - v) * (H - 2 * PAD)) / 4
  return (
    <svg className="trend" viewBox={`0 0 ${W} ${H}`} width={W} height={H} role="img" aria-label={`${label} scores over time: ${points.map((p) => p.score).join(', then ')} out of 5`}>
      <line x1={0} x2={W} y1={y(3)} y2={y(3)} className="trend-guide" />
      {points.length > 1 && <polyline points={points.map((p, k) => `${x(k)},${y(p.score)}`).join(' ')} className="trend-line" />}
      {points.map((p, k) => (
        <g key={p.id}>
          <circle cx={x(k)} cy={y(p.score)} r={k === points.length - 1 ? 5 : 4} className="trend-dot" />
          <circle cx={x(k)} cy={y(p.score)} r={11} className="trend-hit"><title>{`${fmtDate(p.date)}: ${p.score}/5`}</title></circle>
        </g>
      ))}
    </svg>
  )
}

function Change({ from, to }: { from: number; to: number }) {
  const d = Math.round((to - from) * 10) / 10
  if (d === 0) return <span className="pill line">No change since first</span>
  return <span className={'pill ' + (d > 0 ? 'ok' : 'warn')}>{d > 0 ? `▲ +${d}` : `▼ ${d}`} since first</span>
}

function ProgressCard() {
  const p = useLoad(() => get<Progress>('/progress'))
  const plan = useLoad(() => get<{ plan: { steps: number; doneSteps: number; currentWeek: number; weeks: unknown[] } | null }>('/plan'))
  const sp = plan.data?.plan
  if (p.loading) return <section className="card"><Spinner /></section>
  if (!p.data) return <ErrorBox error={p.error} onRetry={p.reload} />
  const d = p.data
  const tried = d.areas.filter((a) => a.points.length)
  const untried = d.areas.filter((a) => !a.points.length)
  return (
    <section className="card stack">
      <div className="row between">
        <div><h2>Your progress</h2>{d.scored > 0 && <p className="small muted">From {d.scored} scored interview{d.scored > 1 ? 's' : ''}. Scores are out of 5; the dashed line marks 3, a solid answer. Hover a dot for its date.</p>}</div>
        {sp ? <Link className="btn ghost sm" to="/study-plan">Study plan: week {sp.currentWeek} of {sp.weeks.length} · {sp.doneSteps} of {sp.steps} done</Link> : <Link className="btn ghost sm" to="/study-plan">{d.scored ? 'Build a study plan' : 'Plan your preparation'}</Link>}
      </div>
      {d.scored === 0 ? <Empty title="No scores yet">Finish an interview and your score in each area will show up here, so you can see how you improve.</Empty> : (
        <div className="grid2" style={{ alignItems: 'start' }}>
          <div>
            <h3>By focus area</h3>
            {tried.map((a) => {
              const first = a.points[0].score, last = a.points[a.points.length - 1].score
              return (
                <div key={a.area} className="prog-row">
                  <div><b>{a.label}</b><div className="small muted">{a.points.length} interview{a.points.length > 1 ? 's' : ''}</div></div>
                  <Trend points={a.points} label={a.label} />
                  <div className="prog-score"><b>{last}</b><span className="small muted">/5</span></div>
                  {a.points.length > 1 ? <Change from={first} to={last} /> : <Link className="small" to={`/interview/setup?category=${a.area}`}>Practise again to see a trend</Link>}
                </div>
              )
            })}
            {untried.length > 0 && <p className="small muted" style={{ marginTop: 12 }}>Not practised yet: {untried.map((a, k) => <span key={a.area}>{k > 0 && ', '}<Link to={`/interview/setup?category=${a.area}`}>{a.label}</Link></span>)}</p>}
          </div>
          <div className="stack">
            <div><h3>Focus next</h3><p className="small muted">Your lowest-scoring skills in your latest interviews.</p></div>
            {d.focus.map((c) => (
              <div key={c.name} className="stack" style={{ gap: 6 }}>
                <div className="row between"><span><b>{c.name}</b> <span className="small muted">· {c.label}</span></span><span><b>{c.score}</b>/5{c.previous !== null && <span className="small muted"> (was {c.previous})</span>}</span></div>
                <Meter pct={(c.score / 5) * 100} />
                <Link className="small" to={`/interview/setup?category=${c.area}`}>Practise {c.label}</Link>
              </div>
            ))}
          </div>
        </div>
      )}
    </section>
  )
}

export default function Dashboard() {
  const { user, setUser } = useAuth()
  const toast = useToast()
  const needVerify = (useLocation().state as { needVerify?: boolean } | null)?.needVerify
  const list = useLoad(() => get<{ interviews: Session[]; storage: { used: number; limit: number } }>('/interviews'))
  const act = useLoad(() => engine<{ active: Session | null }>({ action: 'status' }))
  const verify = useAction(async () => { const r = await post('/auth/verify'); setUser(r.user); toast('Email verified') })
  const recent = list.data?.interviews.slice(0, 3) ?? []
  const [candidate] = useCandidateView()
  return (
    <>
      <PageHead title={`Hi ${user?.name.split(' ')[0]}, ready to practise?`} sub="One 20-minute spoken interview, a scored report, and a record of how you are improving." right={<Link className="btn lime lg" to="/interview/setup">Start new interview</Link>} />
      <div className="stack lg">
        {!recognitionSupported && <div className="banner warn" role="note"><span><b>Voice answers need desktop Chrome or Edge.</b> In this browser you would type your answers instead.</span></div>}
        {!user?.verified && (
          <div className="banner info"><span>{needVerify ? 'Verify your email first: starting an interview is locked until you do.' : 'Your email is not verified yet. You can browse, but you cannot start an interview.'}</span><button className="btn sm" onClick={() => verify.run()} disabled={verify.busy}>Verify email (prototype)</button></div>
        )}
        <ErrorBox error={verify.error} />
        {act.data?.active && (
          <div className="banner info"><span><b>Interview in progress:</b> {interviewTitle(act.data.active)}, {act.data.active.difficulty}.</span><Link className="btn sm" to="/interview/live">Resume</Link></div>
        )}
        <ProgressCard />
        <div className="grid2">
          <section className="card stack">
            <div className="row between"><h2>Recent interviews</h2><Link to="/history">See all</Link></div>
            {list.loading ? <Spinner /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : recent.length === 0 ? (
              <Empty title="No interviews yet">Your first report will show up here.<Link className="btn" to="/interview/setup">Start your first interview</Link></Empty>
            ) : recent.map((i) => (
              <Link key={i.id} to={i.status === 'in_progress' ? '/interview/live' : `/history/${i.id}`} className="row between" style={{ textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span><b>{interviewTitle(i)}</b> <span className="muted small">· {i.difficulty} · {fmtDate(i.created_at)}</span></span>
                <span className="pill">{i.feedback_status === 'ready' ? 'Report ready' : i.status === 'in_progress' ? 'In progress' : 'No score'}</span>
              </Link>
            ))}
            {list.data && <div><div className="row between small muted"><span>Storage</span><span>{Math.round((list.data.storage.used / 1024) * 10) / 10} KB of {list.data.storage.limit / 1024 / 1024} MB</span></div><Meter pct={(list.data.storage.used / list.data.storage.limit) * 100} /></div>}
          </section>
          <section className="card stack">
            <h2>Warm up first</h2>
            <p className="muted">Check that your voice and the AI work before you start the clock.</p>
            <div className="row"><Link className="btn ghost" to="/voice-test">Voice test</Link>{!candidate && <Link className="btn ghost" to="/ai-test">AI test</Link>}</div>
            <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
            <h3>Asked how you use AI?</h3>
            <p className="muted">Interviewers now often ask how you use AI in your work. Prepare a specific answer, then practise saying it.</p>
            <Link className="btn ghost" style={{ justifySelf: 'start' }} to="/ai-tools?prep=1">Prepare your answer</Link>
            {!candidate && (<>
              <hr style={{ border: 0, borderTop: '1px solid var(--line)', width: '100%' }} />
              <h3>Ideas we are weighing</h3>
              <p className="muted">Two add-ons are mocked up as separate pages so you can compare them.</p>
              <Link className="btn" style={{ justifySelf: 'start' }} to="/ideas">Compare the ideas</Link>
            </>)}
          </section>
        </div>
      </div>
    </>
  )
}
