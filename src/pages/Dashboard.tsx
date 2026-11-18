import { Link } from 'react-router-dom'
import { CATEGORY_LABELS, fmtDate, get, type Session, type Storage } from '../api'
import { Empty, ErrorBox, Meter, PageHead, Spinner, useLoad } from '../ui'

type Gap = { area: string; label: string; score: number | null }
type Topic = { id: string; category: string; label: string; xp: number; done: boolean }
type DailySummary = { doneCount: number; topics: Topic[]; streakDays: number; xp: number; xpToday: number }
type Booking = { id: string; peerName: string; slot: string; focus: string; status: string; feedbackGiven: unknown }
type Peers = { bookings: Booking[] }
const slotLabel = (s: string) => { const [d, h] = s.split('@'); return `${new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${Number(h) % 12 || 12} ${Number(h) < 12 ? 'AM' : 'PM'}` }

export default function Dashboard() {
  const list = useLoad(() => get<{ interviews: Session[]; storage: Storage }>('/interviews'))
  const gapsLoad = useLoad(() => get<{ gaps: Gap[] }>('/resources'))
  const dailyLoad = useLoad(() => get<DailySummary>('/daily'))
  const peersLoad = useLoad(() => get<Peers>('/peers'))
  const recent = list.data?.interviews.slice(0, 5) ?? []
  const gaps = gapsLoad.data?.gaps ?? []
  const daily = dailyLoad.data
  const bookings = (peersLoad.data?.bookings ?? []).filter((b) => b.status !== 'cancelled')
  const latestBooking = bookings[bookings.length - 1]
  return (
    <>
      <PageHead title="Dashboard" sub="Your daily practice status, interview reports and progress in one place." />
      <div className="grid2">
        <section className="card stack">
          <div className="row between"><h2>Daily practice status</h2><Link to="/daily">Open daily practice</Link></div>
          {dailyLoad.loading ? <Spinner /> : !daily ? <ErrorBox error={dailyLoad.error} onRetry={dailyLoad.reload} /> : (
            <>
              <div className="row" style={{ flexWrap: 'wrap' }}>
                <span className="pill lime">{daily.streakDays}-day streak</span>
                <span className="pill">{daily.xp} XP</span>
                <span className="pill">+{daily.xpToday} XP today</span>
                <span className="pill line">{daily.doneCount}/{daily.topics.length} topics today</span>
              </div>
              <div className="stack" style={{ gap: 4 }}>
                {daily.topics.map((t) => (
                  <div key={t.id} className="row between small" style={{ padding: '4px 0', borderBottom: '1px solid var(--line)' }}>
                    <span>{t.done ? '✓ ' : '· '}{t.label}</span>
                    {t.done ? <span className="pill ok sm">Done</span> : <Link className="btn sm ghost" to={`/interview/setup?category=${t.category}&from=daily`}>Practise</Link>}
                  </div>
                ))}
              </div>
              <div className="small muted">
                {peersLoad.loading ? 'Checking peer mocks…' : !latestBooking ? (
                  <>Peer mock: none booked yet. <Link to="/daily/peer">Find a peer</Link></>
                ) : latestBooking.status === 'done' && latestBooking.feedbackGiven ? (
                  <>Peer mock with {latestBooking.peerName}: <b>feedback sent - practice flow complete.</b> <Link to="/peer-mocks">See sessions</Link></>
                ) : (
                  <>Peer mock with {latestBooking.peerName} on {slotLabel(latestBooking.slot)}: <b>booked, not finished yet.</b> <Link to="/peer-mocks">See sessions</Link></>
                )}
              </div>
              <p className="small muted" style={{ margin: 0 }}>Streaks, XP and topic progress are saved in this browser only.</p>
            </>
          )}
        </section>
        <section className="card stack">
          <div className="row between"><h2>Interview status and reports</h2><Link to="/history">See all</Link></div>
          {list.loading ? <Spinner /> : list.error ? <ErrorBox error={list.error} onRetry={list.reload} /> : recent.length === 0 ? (
            <Empty title="No interviews yet">Your first report will show up here.<Link className="btn" to="/interview/setup">Start your first interview</Link></Empty>
          ) : recent.map((i) => (
            <Link key={i.id} to={i.status === 'in_progress' ? '/interview/live' : `/history/${i.id}`} className="row between" style={{ textDecoration: 'none', color: 'inherit', padding: '8px 0', borderBottom: '1px solid var(--line)' }}>
              <span><b>{CATEGORY_LABELS[i.category]}</b> <span className="muted small">· {i.difficulty} · {fmtDate(i.created_at)}</span></span>
              {i.status === 'in_progress' ? <span className="pill lime">In progress · Resume</span> : <span className="pill">{i.feedback_status === 'ready' ? 'Report ready' : 'No score'}</span>}
            </Link>
          ))}
        </section>
        <section className="card stack">
          <div className="row between"><h2>Learning progress</h2></div>
          {gapsLoad.loading ? <Spinner /> : gaps.length === 0 ? <p className="muted">Finish a practice interview to see your progress here.</p> : gaps.map((g) => (
            <div key={g.area}>
              <div className="row between small"><b>{g.label}</b><span className="muted">{g.score === null ? 'Not scored yet' : `${g.score}/5`}</span></div>
              <Meter lime pct={g.score === null ? 0 : (g.score / 5) * 100} />
            </div>
          ))}
          <Link className="btn ghost sm" style={{ justifySelf: 'start' }} to="/roadmap">Turn gaps into a study plan</Link>
        </section>
      </div>
    </>
  )
}
