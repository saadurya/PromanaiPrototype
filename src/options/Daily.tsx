import { Link } from 'react-router-dom'
import { CATEGORY_LABELS, engine, fmtDate, get, post, type Session, type Storage } from '../api'
import { Empty, ErrorBox, Meter, PageHead, Spinner, useAction, useLoad } from '../ui'

type Topic = { id: string; category: string; label: string; xp: number; done: boolean }
type Daily = {
  date: string
  topics: Topic[]
  doneCount: number
  bonus: { id: string; title: string; text: string; unlocked: boolean }
  streakDays: number
  xp: number
  xpToday: number
}
type Gap = { area: string; label: string; score: number | null }
type Exp = { id: string; company: string; role: string; industry: string; round: string; outcome: string; summary: string; avgExpert: number | null; helpfulCount: number }
type Peer = { id: string; name: string; level: string; focus: string[]; overlap: string[] }
type Peers = { mine: string[]; peers: Peer[]; bookings: { id: string; status: string }[] }
const ROUND_TO_CATEGORY: Record<string, string> = { 'Product sense': 'product-sense', Execution: 'execution', Metrics: 'metrics', Strategy: 'strategy', Behavioral: 'behavioral' }
const INDUSTRY_TO_ID: Record<string, string> = { FinTech: 'fintech', 'E-commerce': 'ecommerce', EdTech: 'edtech', HealthTech: 'healthtech', SaaS: 'saas', 'Consumer Tech': 'consumer', 'Social Media': 'social', Entertainment: 'entertainment', Travel: 'travel', Communication: 'communication' }
const practiceLink = (e: { round: string; industry: string }) => {
  const q = new URLSearchParams()
  if (ROUND_TO_CATEGORY[e.round]) q.set('category', ROUND_TO_CATEGORY[e.round])
  if (INDUSTRY_TO_ID[e.industry]) q.set('industry', INDUSTRY_TO_ID[e.industry])
  return `/interview/setup?${q.toString()}`
}

export default function Daily() {
  const { data, setData, loading, error, reload } = useLoad(() => get<Daily>('/daily'))
  const list = useLoad(() => get<{ interviews: Session[]; storage: Storage }>('/interviews'))
  const gapsLoad = useLoad(() => get<{ gaps: Gap[] }>('/resources'))
  const exps = useLoad(() => get<{ experiences: Exp[] }>('/experiences'))
  const peers = useLoad(() => get<Peers>('/peers'))
  const act = useLoad(() => engine<{ active: Session | null }>({ action: 'status' }))
  const complete = useAction(async (id: string) => { const r = await post<Daily>(`/daily/topics/${id}/complete`); setData(r) })
  const recent = list.data?.interviews.slice(0, 3) ?? []
  const gaps = gapsLoad.data?.gaps ?? []
  if (loading && !data) return <Spinner />
  if (!data) return <ErrorBox error={error} onRetry={reload} />
  return (
    <>
      <PageHead title="Daily practice" sub="Your daily loop: practise with the interviewer, learn from interview experiences, build your plan from the feedback, then try a peer mock." />
      <div className="stack lg">
        {act.data?.active && (
          <div className="banner info"><span><b>Interview in progress:</b> {CATEGORY_LABELS[act.data.active.category]}, {act.data.active.difficulty}.</span><Link className="btn sm" to="/interview/live">Resume</Link></div>
        )}
        <section className="card row" style={{ justifyContent: 'space-around', textAlign: 'center', flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{data.streakDays}</div><div className="small muted">day streak</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{data.xp}</div><div className="small muted">total XP</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{data.xpToday}</div><div className="small muted">XP today</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{data.doneCount}/{data.topics.length}</div><div className="small muted">today's topics</div></div>
        </section>

        <section className="stack">
          <h2>1 · Practise with the interviewer</h2>
          <p className="muted">Five topics a day across the interview categories. Finish all five to keep your streak going and unlock today's bonus topic.</p>
          <ErrorBox error={complete.error} />
          <div className="grid2">
            {data.topics.map((t) => (
              <div key={t.id} className="card stack">
                <div className="row between"><h3>{t.label}</h3>{t.done ? <span className="pill ok">Done · +{t.xp} XP</span> : <span className="pill">+{t.xp} XP</span>}</div>
                <div className="row">
                  <Link className="btn sm lime" to={`/interview/setup?category=${t.category}`}>Practise this topic</Link>
                  {!t.done && <button className="btn sm ghost" disabled={complete.busy} onClick={() => complete.run(t.id)}>Mark done</button>}
                </div>
              </div>
            ))}
          </div>
          <div className="card stack">
            <div className="row between"><h3>Your recent interviews and feedback</h3><Link to="/history">See all</Link></div>
            {list.loading ? <Spinner /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : recent.length === 0 ? (
              <Empty title="No interviews yet">Your first scored report will show up here.<Link className="btn" to="/interview/setup">Start your first interview</Link></Empty>
            ) : recent.map((i) => (
              <Link key={i.id} to={`/history/${i.id}`} className="row between" style={{ textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
                <span><b>{CATEGORY_LABELS[i.category]}</b> <span className="muted small">· {i.difficulty} · {fmtDate(i.created_at)}</span></span>
                <span className="pill">{i.feedback_status === 'ready' ? 'Report ready' : i.status === 'in_progress' ? 'In progress' : 'No score'}</span>
              </Link>
            ))}
            <p className="small muted">Each report ends with the gaps to work on next - those feed step 3 below.</p>
          </div>
        </section>

        <section className="stack">
          <h2>2 · Learn from interview experiences</h2>
          <p className="muted">Read how a round went: what was asked, how the candidate answered, how a senior PM ranked the answers, and the outcome. Then practise the same round and industry yourself.</p>
          {exps.loading ? <Spinner /> : exps.error ? <ErrorBox error={exps.error} onRetry={exps.reload} /> : (
            <div className="grid2">
              {(exps.data?.experiences ?? []).slice(0, 2).map((e) => (
                <div key={e.id} className="card stack">
                  <div className="row between"><h3>{e.company}</h3><span className={'pill ' + (e.outcome === 'Offer' ? 'ok' : 'line')}>{e.outcome}</span></div>
                  <p className="small muted">{e.role} · {e.industry} · {e.round}</p>
                  <p className="small">{e.summary}</p>
                  <div className="row">
                    <Link className="btn sm" to="/experiences">Read the round</Link>
                    <Link className="btn sm ghost" to={practiceLink(e)}>Practise this round</Link>
                  </div>
                </div>
              ))}
            </div>
          )}
          <div className="row">
            <Link className="btn" to="/experiences">Browse all experiences</Link>
            <Link className="btn ghost" to="/experiences">Share yours</Link>
          </div>
        </section>

        <section className="stack">
          <h2>3 · Build your learning plan</h2>
          <p className="muted">Your interview gaps turn into a dated roadmap. The planner picks resources for your weak spots - videos, articles, templates and drills - and the PM AI tools that fit your plan topics, so the learning connects back to what the feedback flagged.</p>
          <div className="card stack">
            {gapsLoad.loading ? <Spinner /> : gaps.length === 0 ? <p className="muted">Finish a practice interview to see your progress here.</p> : gaps.map((g) => (
              <div key={g.area}>
                <div className="row between small"><b>{g.label}</b><span className="muted">{g.score === null ? 'Not scored yet' : `${g.score}/5`}</span></div>
                <Meter lime pct={g.score === null ? 0 : (g.score / 5) * 100} />
              </div>
            ))}
            <div className="row">
              <Link className="btn" to="/roadmap">Open roadmap &amp; resources</Link>
              <Link className="btn ghost" to="/ai-tools">Explore PM AI tools</Link>
            </div>
          </div>
        </section>

        <section className="stack">
          <h2>4 · Practise with a peer</h2>
          <p className="muted">Once the learning lands, mark when you are free. Peers free at the same time show up, you book a live mock, take turns as interviewer and candidate, and swap feedback - the same loop, this time with a peer.</p>
          {peers.loading ? <Spinner /> : peers.error ? <ErrorBox error={peers.error} onRetry={peers.reload} /> : peers.data && (
            <div className="card stack">
              {(() => {
                const matches = peers.data.peers.filter((p) => p.overlap.length)
                const upcoming = peers.data.bookings.filter((b) => b.status !== 'cancelled')
                if (upcoming.length) return <p className="small"><b>{upcoming.length} mock{upcoming.length > 1 ? 's' : ''} booked.</b> <Link to="/peer-mocks">See your bookings</Link></p>
                if (!peers.data.mine.length) return <p className="small muted">No slots marked yet. Mark a few and peers free at the same time will appear here.</p>
                if (!matches.length) return <p className="small muted">{peers.data.mine.length} slot{peers.data.mine.length > 1 ? 's' : ''} marked. No peer overlaps yet - add more times to find a match.</p>
                return (
                  <>
                    <p className="small"><b>{matches.length} peer{matches.length > 1 ? 's' : ''} free when you are.</b></p>
                    {matches.slice(0, 2).map((p) => <div key={p.id} className="row between small"><span><b>{p.name}</b> <span className="muted">· {p.level} · {p.focus.join(', ')}</span></span><span className="pill lime">{p.overlap.length} shared slot{p.overlap.length > 1 ? 's' : ''}</span></div>)}
                  </>
                )
              })()}
            </div>
          )}
          <div className="row">
            <Link className="btn" to="/peer-mocks">Mark your availability</Link>
          </div>
        </section>

        <section className="card stack">
          <div className="row between"><h2>{data.bonus.title}</h2>{data.bonus.unlocked ? <span className="pill lime">Unlocked</span> : <span className="pill line">Locked</span>}</div>
          <p className="small muted">{data.bonus.unlocked ? data.bonus.text : "Finish today's five topics to unlock the bonus topic."}</p>
          {data.bonus.unlocked && <Link className="btn" style={{ justifySelf: 'start' }} to="/ai-tools">Open the bonus topic</Link>}
        </section>
        <p className="small muted">Streaks, XP and topic progress are saved in this browser only.</p>
      </div>
    </>
  )
}
