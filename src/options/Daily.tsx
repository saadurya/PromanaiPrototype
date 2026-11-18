import { Link } from 'react-router-dom'
import { CATEGORY_LABELS, engine, get, type Session } from '../api'
import { ErrorBox, PageHead, Spinner, useLoad } from '../ui'
import Roadmap from './Roadmap'

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
type Exp = { id: string; company: string; role: string; industry: string; round: string; outcome: string; summary: string; avgExpert: number | null; helpfulCount: number }
type Peer = { id: string; name: string; level: string; focus: string[]; overlap: string[] }
type Peers = { mine: string[]; peers: Peer[]; bookings: { id: string; status: string }[] }
const ROUND_TO_CATEGORY: Record<string, string> = { 'Product sense': 'product-sense', Execution: 'execution', Metrics: 'metrics', Strategy: 'strategy', Behavioral: 'behavioral' }
const INDUSTRY_TO_ID: Record<string, string> = { FinTech: 'fintech', 'E-commerce': 'ecommerce', EdTech: 'edtech', HealthTech: 'healthtech', SaaS: 'saas', 'Consumer Tech': 'consumer', 'Social Media': 'social', Entertainment: 'entertainment', Travel: 'travel', Communication: 'communication' }
const practiceLink = (e: { round: string; industry: string }) => {
  const q = new URLSearchParams()
  if (ROUND_TO_CATEGORY[e.round]) q.set('category', ROUND_TO_CATEGORY[e.round])
  if (INDUSTRY_TO_ID[e.industry]) q.set('industry', INDUSTRY_TO_ID[e.industry])
  q.set('from', 'daily')
  return `/interview/setup?${q.toString()}`
}

// Every daily step is optional: Next continues to the next page, Skip moves on without doing this one.
function StepNav({ next, prev, endLabel }: { next?: string; prev?: string; endLabel?: string }) {
  return (
    <div className="row between" style={{ flexWrap: 'wrap' }}>
      <span className="row">
        <span className="small muted">Every step is optional - skip whatever you don't need today.</span>
        <Link className="btn ghost sm" to="/dashboard">Exit to Dashboard</Link>
      </span>
      <span className="row">
        {prev && <Link className="btn ghost" to={prev}>Previous</Link>}
        {next ? (
          <>
            <Link className="btn ghost" to={next}>Skip</Link>
            <Link className="btn lime" to={next}>Next</Link>
          </>
        ) : (
          <Link className="btn lime" to="/dashboard">{endLabel ?? 'Done · Go to Dashboard'}</Link>
        )}
      </span>
    </div>
  )
}

function ActiveBanner() {
  const act = useLoad(() => engine<{ active: Session | null }>({ action: 'status' }))
  if (!act.data?.active) return null
  return <div className="banner info"><span><b>Interview in progress:</b> {CATEGORY_LABELS[act.data.active.category]}, {act.data.active.difficulty}.</span><Link className="btn sm" to="/interview/live">Resume</Link></div>
}

// Page 1: interview experiences
export function DailyExperiences() {
  const exps = useLoad(() => get<{ experiences: Exp[] }>('/experiences'))
  return (
    <>
      <PageHead title="Daily practice" sub="Interview experiences: read how a round went - what was asked, how the candidate answered, how a senior PM ranked the answers, and the outcome. Then practise the same round and industry yourself." />
      <div className="stack lg">
        <ActiveBanner />
        {exps.loading ? <Spinner /> : exps.error ? <ErrorBox error={exps.error} onRetry={exps.reload} /> : (
          <div className="grid2">
            {(exps.data?.experiences ?? []).slice(0, 4).map((e) => (
              <div key={e.id} className="card stack">
                <div className="row between"><h3>{e.company}</h3><span className={'pill ' + (e.outcome === 'Offer' ? 'ok' : 'line')}>{e.outcome}</span></div>
                <p className="small muted">{e.role} · {e.industry} · {e.round}</p>
                <p className="small">{e.summary}</p>
                <div className="row">
                  <Link className="btn sm" to="/experiences?from=daily">Read the round</Link>
                  <Link className="btn sm ghost" to={practiceLink(e)}>Practise this round</Link>
                </div>
              </div>
            ))}
          </div>
        )}
        <div className="row">
          <Link className="btn" to="/experiences?from=daily">Browse all experiences</Link>
          <Link className="btn ghost" to="/experiences?from=daily">Share yours</Link>
        </div>
        <StepNav next="/daily/plan" />
      </div>
    </>
  )
}

// Page 2: the learning plan (roadmap, directory and AI tools live inside it)
export function DailyPlan() {
  return (
    <>
      <Roadmap />
      <div style={{ marginTop: 18 }}><StepNav prev="/daily" next="/daily/topics" /></div>
    </>
  )
}

// Page 3: today's five AI interview topics
export function DailyTopics() {
  const { data, loading, error, reload } = useLoad(() => get<Daily>('/daily'))
  if (loading && !data) return <Spinner />
  if (!data) return <ErrorBox error={error} onRetry={reload} />
  return (
    <>
      <PageHead title="Daily practice" sub="Today's five AI interview topics, across the interview categories. Finishing a topic's practice interview marks it done and earns its XP - your streak, XP and progress show on the Dashboard." />
      <div className="stack lg">
        <ActiveBanner />
        <div className="grid2">
          {data.topics.map((t) => (
            <div key={t.id} className="card stack">
              <div className="row between"><h3>{t.label}</h3>{t.done ? <span className="pill ok">Done · +{t.xp} XP</span> : <span className="pill">+{t.xp} XP</span>}</div>
              <div className="row">
                <Link className="btn sm lime" to={`/interview/setup?category=${t.category}&from=daily`}>Practise this topic</Link>
              </div>
              {t.done && <span className="small muted">Finished in today's practice interview - you can practise again, XP is counted once.</span>}
            </div>
          ))}
        </div>
        <div className="card row" style={{ flexWrap: 'wrap' }}><span><b>Ready to try it out with peer-to-peer interviews?</b> That's the last step - finishing a peer mock completes the whole practice flow.</span></div>
        <StepNav prev="/daily/plan" next="/daily/peer" />
      </div>
    </>
  )
}

// Page 4: practise with a peer, right after the AI interview practice
export function DailyPeer() {
  const peers = useLoad(() => get<Peers>('/peers'))
  return (
    <>
      <PageHead title="Daily practice" sub="Practise with a peer: mark when you are free, book a live mock with someone free at the same time, take turns as interviewer and candidate, and swap feedback - the same loop as the AI interview, this time with a peer." />
      <div className="stack lg">
        {peers.loading ? <Spinner /> : peers.error ? <ErrorBox error={peers.error} onRetry={peers.reload} /> : peers.data && (
          <div className="card stack">
            {(() => {
              const matches = peers.data.peers.filter((p) => p.overlap.length)
              const upcoming = peers.data.bookings.filter((b) => b.status !== 'cancelled')
              if (peers.data.bookings.some((b) => b.status === 'done')) return <p className="small"><b>Peer mock finished - that's the whole practice flow complete.</b> <Link to="/peer-mocks">See your bookings</Link></p>
              if (upcoming.length) return <p className="small"><b>{upcoming.length} mock{upcoming.length > 1 ? 's' : ''} booked.</b> Finish it with your peer and the whole practice flow is done. <Link to="/peer-mocks">See your bookings</Link></p>
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
          <Link className="btn" to="/peer-mocks?from=daily">Mark your availability</Link>
        </div>
        <StepNav prev="/daily/topics" endLabel={peers.data?.bookings.some((b) => b.status === 'done') ? 'Done · Go to Dashboard' : 'Back to Dashboard'} />
      </div>
    </>
  )
}
