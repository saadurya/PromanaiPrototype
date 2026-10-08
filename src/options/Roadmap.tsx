import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { get, post } from '../api'
import { ErrorBox, PageHead, Spinner, useAction, useLoad } from '../ui'

type Res = { id: string; title: string; type: string; tier: 'must' | 'should' | 'could'; minutes: number; topics: string[]; up: number; expertUp: number; source: string; voted: number; score: number }
type Gap = { area: string; label: string; score: number | null }
type Plan = { weeks: { week: number; minutes: number; items: (Res & { area: string })[] }[]; budgetMinutes: number; plannedMinutes: number; mustTotal: number; mustCovered: number; notFitted: Res[] }
const TIER = { must: 'Must know', should: 'Should know', could: 'Could know' }
const TYPE = { video: 'Video', github: 'GitHub repo', diagram: 'Diagram', article: 'Article' } as Record<string, string>
const TOPICS: Record<string, string> = { 'product-sense': 'Product sense', execution: 'Execution', metrics: 'Metrics', strategy: 'Strategy', behavioral: 'Behavioral', 'ai-for-pm': 'AI for PMs' }

function ResRow({ r, onVote }: { r: Res; onVote?: (id: string, v: 1 | -1) => void }) {
  return (
    <div className="res">
      {onVote ? <button className={'vote' + (r.voted === 1 ? ' on' : '')} aria-pressed={r.voted === 1} aria-label={`Upvote ${r.title}`} onClick={() => onVote(r.id, 1)}>▲<span>{r.score}</span></button> : <span className={'pill tier-' + r.tier}>{TIER[r.tier]}</span>}
      <div><b>{r.title}</b><div className="small muted">{TYPE[r.type]} · {r.minutes} min · {r.source} · {r.up} peers and {r.expertUp} experts voted · links are placeholders in this prototype</div></div>
      {onVote ? <span className={'pill tier-' + r.tier}>{TIER[r.tier]}</span> : <span className="pill line">{TOPICS[r.topics[0]]}</span>}
    </div>
  )
}

export default function Roadmap() {
  const { data, setData, loading, error, reload } = useLoad(() => get<{ resources: Res[]; gaps: Gap[] }>('/resources'))
  const [tab, setTab] = useState<'plan' | 'dir'>('plan')
  const [picked, setPicked] = useState<string[]>([])
  const [hours, setHours] = useState(4)
  const [weeks, setWeeks] = useState(3)
  const [plan, setPlan] = useState<Plan | null>(null)
  const [topic, setTopic] = useState('')
  const [tier, setTier] = useState('')
  useEffect(() => { if (data && !picked.length) setPicked(data.gaps.filter((g) => g.score === null || g.score < 3.2).map((g) => g.area).slice(0, 3)) }, [data]) // eslint-disable-line
  const gen = useAction(async () => { const r = await post<Plan>('/roadmap', { areas: data!.gaps.filter((g) => picked.includes(g.area)).map((g) => ({ area: g.area, score: g.score })), hoursPerWeek: hours, weeks }); setPlan(r) })
  const vote = useAction(async (id: string, v: 1 | -1) => { const r = await post(`/resources/${id}/vote`, { vote: v }); setData({ ...data!, resources: r.resources }) })
  if (loading && !data) return <Spinner />
  if (!data) return <ErrorBox error={error} onRetry={reload} />
  const dir = data.resources.filter((r) => (!topic || r.topics.includes(topic)) && (!tier || r.tier === tier)).sort((a, b) => b.score - a.score)
  return (
    <>
      <PageHead title="Resources and learning roadmap" sub="Free resources from across the internet, ranked by peers and experienced PMs. The planner picks what to study first based on your weak spots and the time you have." sample />
      <div className="tabs" style={{ marginBottom: 18 }}><button className={'tab' + (tab === 'plan' ? ' on' : '')} onClick={() => setTab('plan')}>My roadmap</button><button className={'tab' + (tab === 'dir' ? ' on' : '')} onClick={() => setTab('dir')}>Directory</button></div>
      {tab === 'plan' ? (
        <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,4fr) minmax(0,8fr)', alignItems: 'start' }}>
          <section className="card stack">
            <h2>Your gaps</h2>
            <p className="small muted">Pulled from your interview reports. Untried areas count as gaps too.</p>
            {data.gaps.map((g) => (
              <label key={g.area} className="row" style={{ cursor: 'pointer' }}>
                <input type="checkbox" style={{ width: 18 }} checked={picked.includes(g.area)} onChange={(e) => setPicked(e.target.checked ? [...picked, g.area] : picked.filter((x) => x !== g.area))} />
                <span style={{ flex: 1 }}>{g.label}</span>{g.score === null ? <span className="pill line">Not practised</span> : <span className={'pill' + (g.score < 3 ? ' warn' : '')}>{g.score}/5</span>}
              </label>
            ))}
            <div className="grid2"><label className="field">Hours per week<input type="number" min={1} max={40} value={hours} onChange={(e) => setHours(Number(e.target.value))} /></label><label className="field">Weeks until interview<input type="number" min={1} max={12} value={weeks} onChange={(e) => setWeeks(Number(e.target.value))} /></label></div>
            <ErrorBox error={gen.error} />
            <button className="btn lime" disabled={gen.busy || !picked.length} onClick={() => gen.run()}>{gen.busy ? 'Planning…' : 'Build my roadmap'}</button>
            <Link to="/interview/setup" className="small">No reports yet? Take a practice interview first.</Link>
          </section>
          <section className="stack">
            {!plan ? <div className="empty"><h3 style={{ color: 'var(--ink)' }}>Your plan will appear here</h3>Choose your gaps and how much time you have.</div> : (<>
              <div className="banner info"><span><b>{plan.plannedMinutes} of {plan.budgetMinutes} minutes planned.</b> Covers {plan.mustCovered} of {plan.mustTotal} must-know resources for your chosen areas.</span></div>
              {plan.weeks.map((w) => (
                <div key={w.week} className="week card"><div className="row between"><h3>Week {w.week}</h3><span className="small muted">{w.minutes} min</span></div>
                  {w.items.length === 0 ? <p className="muted">Nothing fits this week. Add more hours or weeks.</p> : w.items.map((r) => <ResRow key={r.id} r={r} />)}</div>
              ))}
              {plan.notFitted.length > 0 && <div className="card"><h3>Did not fit your time</h3><p className="small muted">Add hours or weeks to include these.</p>{plan.notFitted.map((r) => <ResRow key={r.id} r={r} />)}</div>}
            </>)}
          </section>
        </div>
      ) : (
        <section className="card stack">
          <div className="row"><select aria-label="Topic" value={topic} onChange={(e) => setTopic(e.target.value)} style={{ width: 'auto' }}><option value="">All topics</option>{Object.entries(TOPICS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select><select aria-label="Tier" value={tier} onChange={(e) => setTier(e.target.value)} style={{ width: 'auto' }}><option value="">All tiers</option>{Object.entries(TIER).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></div>
          <ErrorBox error={vote.error} />
          <div>{dir.map((r) => <ResRow key={r.id} r={r} onVote={(id, v) => vote.run(id, v)} />)}</div>
          <p className="small muted">Score = peer votes + expert votes counted three times, so experienced PMs weigh more.</p>
        </section>
      )}
    </>
  )
}
