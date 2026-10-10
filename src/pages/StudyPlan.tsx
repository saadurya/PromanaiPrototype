import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { CATEGORY_LABELS, fmtDate, get, post } from '../api'
import { ErrorBox, Meter, Modal, PageHead, Spinner, useAction, useLoad } from '../ui'

type Res = { id: string; title: string; type: string; tier: 'must' | 'should' | 'could'; minutes: number; topics: string[]; up: number; expertUp: number; source: string; voted: number; score: number }
type Gap = { area: string; label: string; score: number | null; previous: number | null }
type Mock = { areas: string[]; baseline: boolean; done?: boolean; interviewId?: string | null }
type Week = { week: number; minutes: number; items: (Res & { area?: string })[]; mock: Mock | null }
type Plan = {
  weeks: Week[]; budgetMinutes: number; plannedMinutes: number; mustTotal: number; mustCovered: number; notFitted: Res[]; hoursPerWeek: number
  areas: { area: string; label: string; score: number | null; confidence: number | null }[]
  basis: 'self' | 'reports'; level: string | null; interview_date: string | null; done: string[]
  changes: { area: string; label: string; from: number | null; to: number | null }[]; steps: number; doneSteps: number; currentWeek: number
}
const TIER = { must: 'Must know', should: 'Should know', could: 'Could know' }
const TYPE = { video: 'Video', github: 'GitHub repo', diagram: 'Diagram', article: 'Article' } as Record<string, string>
const TOPICS: Record<string, string> = { 'product-sense': 'Product sense', execution: 'Execution', metrics: 'Metrics', strategy: 'Strategy', behavioral: 'Behavioral', 'ai-product': 'AI product sense' }
const CONFIDENCE = [[1, 'Not confident'], [2, 'Somewhat'], [3, 'Confident']] as const
const LEVELS = [['APM', 'Associate PM'], ['PM', 'Product Manager']] as const

const dateIn = (days: number) => new Date(Date.now() + days * 864e5).toISOString().slice(0, 10)
const weeksUntil = (date: string) => { const t = Date.parse(date); return Number.isFinite(t) ? Math.max(1, Math.min(12, Math.ceil((t - Date.now()) / (7 * 864e5)))) : 3 }
const labels = (areas: string[]) => areas.map((a) => CATEGORY_LABELS[a]).join(' + ')
const setupLink = (areas: string[], level?: string | null) => `/interview/setup?categories=${areas.join(',')}${level ? `&level=${level}` : ''}`

function ResRow({ r, onVote }: { r: Res; onVote: (id: string, v: 1 | -1) => void }) {
  return (
    <div className="res">
      <button className={'vote' + (r.voted === 1 ? ' on' : '')} aria-pressed={r.voted === 1} aria-label={`Upvote ${r.title}`} onClick={() => onVote(r.id, 1)}>▲<span>{r.score}</span></button>
      <div><b>{r.title}</b><div className="small muted">{TYPE[r.type]} · {r.minutes} min · {r.source} · {r.up} peers and {r.expertUp} experts voted · links are placeholders in this prototype</div></div>
      <span className={'pill tier-' + r.tier}>{TIER[r.tier]}</span>
    </div>
  )
}

// The time questions, shared by the starter and the reports-based builder
function TimeFields({ date, setDate, hours, setHours }: { date: string; setDate: (d: string) => void; hours: number; setHours: (h: number) => void }) {
  return (
    <div className="grid2">
      <label className="field">When is your interview?<input type="date" min={dateIn(1)} value={date} onChange={(e) => setDate(e.target.value)} /><span className="small muted">{weeksUntil(date)} week{weeksUntil(date) > 1 ? 's' : ''} to prepare</span></label>
      <label className="field">Hours per week<input type="number" min={1} max={40} value={hours} onChange={(e) => setHours(Number(e.target.value))} /></label>
    </div>
  )
}

// New user: no scores yet. Ask, recommend a baseline interview, and only offer a plan labelled as a starter.
function Starter({ onSaved }: { onSaved: (p: Plan) => void }) {
  const [level, setLevel] = useState('')
  const [date, setDate] = useState(dateIn(21))
  const [hours, setHours] = useState(4)
  const [conf, setConf] = useState<Record<string, number>>({})
  const answered = Object.keys(CATEGORY_LABELS).every((a) => conf[a])
  const leastConfident = Object.keys(CATEGORY_LABELS).filter((a) => conf[a]).sort((x, y) => conf[x] - conf[y]).slice(0, 2)
  const build = useAction(async () => {
    const weak = Object.keys(CATEGORY_LABELS).filter((a) => conf[a] < 3)
    const areas = (weak.length ? weak : Object.keys(CATEGORY_LABELS)).map((a) => ({ area: a, confidence: conf[a] }))
    const r = await post<{ plan: Plan }>('/plan', { areas, hoursPerWeek: hours, interviewDate: date, level: level || undefined })
    onSaved(r.plan)
  })
  return (
    <div className="stack lg" style={{ maxWidth: 820 }}>
      <section className="card stack">
        <h2>You have not done an interview yet</h2>
        <p className="muted">A study plan works best when it targets your real gaps. Answer three quick questions, then take a 20-minute baseline interview. After it, your plan is built from real scores instead of guesses.</p>
      </section>
      <section className="card stack">
        <h3>1. Which role are you preparing for?</h3>
        <div className="row" role="radiogroup" aria-label="Role">{LEVELS.map(([v, t]) => <button key={v} role="radio" aria-checked={level === v} className={'tab' + (level === v ? ' on' : '')} onClick={() => setLevel(v)}>{t}</button>)}</div>
        <h3>2. How much time do you have?</h3>
        <TimeFields date={date} setDate={setDate} hours={hours} setHours={setHours} />
        <h3>3. How confident are you in each area?</h3>
        <div className="stack" style={{ gap: 8 }}>
          {Object.entries(CATEGORY_LABELS).map(([a, t]) => (
            <div key={a} className="row between">
              <span>{t}</span>
              <div className="row" role="radiogroup" aria-label={`Confidence in ${t}`}>{CONFIDENCE.map(([v, l]) => <button key={v} role="radio" aria-checked={conf[a] === v} className={'tab' + (conf[a] === v ? ' on' : '')} onClick={() => setConf({ ...conf, [a]: v })}>{l}</button>)}</div>
            </div>
          ))}
        </div>
      </section>
      <section className="card stack">
        <h3>Recommended: start with a baseline</h3>
        <p className="muted">{leastConfident.length ? `A 20-minute interview on ${labels(leastConfident)}, the areas you feel least confident in.` : 'A 20-minute interview gives you real scores to plan from.'}</p>
        <ErrorBox error={build.error} />
        <div className="row">
          <Link className="btn lime lg" to={leastConfident.length ? setupLink(leastConfident, level) : '/interview/setup'}>Take a 20-minute baseline</Link>
          <button className="btn ghost" disabled={!answered || build.busy} onClick={() => build.run()}>{build.busy ? 'Planning…' : 'Build a starter plan instead'}</button>
        </div>
        {!answered && <p className="small muted">Answer the confidence question for every area to build a starter plan.</p>}
      </section>
    </div>
  )
}

// Returning user without a saved plan: known weaknesses first, then areas getting worse, then areas never practised
function Builder({ gaps, linked, onSaved }: { gaps: Gap[]; linked: string[]; onSaved: (p: Plan) => void }) {
  const ranked = [
    ...gaps.filter((g) => g.score !== null && g.score < 3.2).sort((x, y) => x.score! - y.score!),
    ...gaps.filter((g) => g.score !== null && g.score >= 3.2 && g.previous !== null && g.score < g.previous),
    ...gaps.filter((g) => g.score === null),
  ]
  const [picked, setPicked] = useState<string[]>(() => (linked.length ? linked : ranked.slice(0, 3).map((g) => g.area)))
  const [date, setDate] = useState(dateIn(21))
  const [hours, setHours] = useState(4)
  const build = useAction(async () => {
    const r = await post<{ plan: Plan }>('/plan', { areas: gaps.filter((g) => picked.includes(g.area)).map((g) => ({ area: g.area, score: g.score })), hoursPerWeek: hours, interviewDate: date })
    onSaved(r.plan)
  })
  return (
    <section className="card stack" style={{ maxWidth: 820 }}>
      <h2>Build your study plan</h2>
      <p className="muted">Your latest score in each area, from your interview reports. We suggest your weakest areas first, then areas that are slipping. Areas you have not practised get less time until you have a score for them.</p>
      {gaps.map((g) => (
        <label key={g.area} className="row" style={{ cursor: 'pointer' }}>
          <input type="checkbox" style={{ width: 18 }} checked={picked.includes(g.area)} onChange={(e) => setPicked(e.target.checked ? [...picked, g.area] : picked.filter((x) => x !== g.area))} />
          <span style={{ flex: 1 }}>{g.label}{g.score !== null && g.previous !== null && g.score < g.previous && <span className="small muted"> · slipping, was {g.previous}</span>}</span>
          {g.score === null ? <span className="pill line">Not practised</span> : <span className={'pill' + (g.score < 3 ? ' warn' : '')}>{g.score}/5</span>}
        </label>
      ))}
      <TimeFields date={date} setDate={setDate} hours={hours} setHours={setHours} />
      <ErrorBox error={build.error} />
      <button className="btn lime" style={{ justifySelf: 'start' }} disabled={build.busy || !picked.length} onClick={() => build.run()}>{build.busy ? 'Planning…' : 'Build my plan'}</button>
    </section>
  )
}

function MockStep({ mock, level }: { mock: Mock; level: string | null }) {
  return (
    <div className="res">
      <span className="pill lime">{mock.baseline ? 'Baseline' : 'Practise'}</span>
      <div><b>{mock.baseline ? 'Baseline mock interview' : 'Mock interview'}: {labels(mock.areas)}</b><div className="small muted">20 min · {mock.baseline ? 'gives you real scores, so the plan can target your real gaps' : "checks what this week's study changed in your scores"}</div></div>
      {mock.done ? <span className="row"><span className="pill ok">✓ Done</span>{mock.interviewId && <Link className="small" to={`/history/${mock.interviewId}`}>Report</Link>}</span> : <Link className="btn sm" to={setupLink(mock.areas, level)}>Start</Link>}
    </div>
  )
}

// Saved plan: progress, ticking, and an explained update when scores change
function SavedPlan({ plan, setPlan }: { plan: Plan; setPlan: (p: Plan | null) => void }) {
  const [confirmReset, setConfirmReset] = useState(false)
  const toggle = useAction(async (id: string) => setPlan((await post<{ plan: Plan }>(`/plan/items/${id}`)).plan))
  const update = useAction(async () => setPlan((await post<{ plan: Plan }>('/plan/update')).plan))
  const reset = useAction(async () => { await post('/plan/reset'); setPlan(null) })
  const selfAreas = plan.areas.filter((a) => a.score === null && a.confidence !== null)
  return (
    <div className="stack lg" style={{ maxWidth: 900 }}>
      <section className="card stack">
        <div className="row between">
          <div>
            <h2>{plan.basis === 'self' ? 'Your starter plan' : 'Your study plan'}</h2>
            <p className="small muted">{plan.basis === 'self' ? 'Based on your self-assessment. It becomes personal after your first interview.' : selfAreas.length ? `Built from your interview reports, and your self-assessment for ${selfAreas.map((a) => a.label).join(', ')}.` : 'Built from your interview reports.'}</p>
          </div>
          <button className="btn ghost sm" onClick={() => setConfirmReset(true)}>Start a new plan</button>
        </div>
        <div className="row small"><b>Week {plan.currentWeek} of {plan.weeks.length}</b><span className="muted">· {plan.doneSteps} of {plan.steps} steps done · {plan.hoursPerWeek} h a week{plan.interview_date && ` · interview on ${fmtDate(plan.interview_date)}`}</span></div>
        <Meter pct={plan.steps ? (plan.doneSteps / plan.steps) * 100 : 0} lime />
        <div className="row">{plan.areas.map((a) => <span key={a.area} className="pill line">{a.label}: {a.score !== null ? `${a.score}/5` : 'self-assessed'}</span>)}</div>
      </section>
      {plan.changes.length > 0 && (
        <div className="banner info" role="status">
          <span><b>Your scores changed since this plan was made:</b> {plan.changes.map((c) => `${c.label} ${c.from === null ? 'had no score' : `was ${c.from}`}, now ${c.to ?? 'no score'}`).join('; ')}. Updating moves time towards your current weakest areas. Items you ticked stay ticked.</span>
          <button className="btn sm" disabled={update.busy} onClick={() => update.run()}>{update.busy ? 'Updating…' : 'Update my plan'}</button>
        </div>
      )}
      <ErrorBox error={toggle.error ?? update.error} />
      <div className="banner info"><span><b>{plan.plannedMinutes} of {plan.budgetMinutes} minutes of study planned.</b> Covers {plan.mustCovered} of {plan.mustTotal} must-know resources for your areas.</span></div>
      {plan.weeks.map((w) => (
        <div key={w.week} className="week card">
          <div className="row between"><h3>Week {w.week} {w.week === plan.currentWeek && <span className="pill lime">This week</span>}</h3><span className="small muted">{w.minutes} min of study</span></div>
          {w.mock?.baseline && <MockStep mock={w.mock} level={plan.level} />}
          {w.items.length === 0 && !w.mock && <p className="muted">Nothing fits this week. Add more hours, or pick a later interview date.</p>}
          {w.items.map((r) => {
            const done = plan.done.includes(r.id)
            return (
              <label key={r.id} className="res" style={{ cursor: 'pointer', opacity: done ? 0.6 : 1 }}>
                <input type="checkbox" style={{ width: 18 }} checked={done} disabled={toggle.busy} onChange={() => toggle.run(r.id)} aria-label={`Mark ${r.title} as done`} />
                <div><b style={{ textDecoration: done ? 'line-through' : 'none' }}>{r.title}</b><div className="small muted">{TYPE[r.type]} · {r.minutes} min · {TIER[r.tier]} · {r.source} · links are placeholders in this prototype</div></div>
                <span className="pill line">{TOPICS[r.area ?? r.topics[0]]}</span>
              </label>
            )
          })}
          {w.mock && !w.mock.baseline && <MockStep mock={w.mock} level={plan.level} />}
        </div>
      ))}
      {plan.notFitted.length > 0 && <div className="card"><h3>Did not fit your time</h3><p className="small muted">Add hours, or pick a later interview date, to include these.</p>{plan.notFitted.map((r) => <div key={r.id} className="res"><span className={'pill tier-' + r.tier}>{TIER[r.tier]}</span><div><b>{r.title}</b><div className="small muted">{TYPE[r.type]} · {r.minutes} min</div></div><span /></div>)}</div>}
      {confirmReset && (
        <Modal title="Start a new plan?" onClose={() => setConfirmReset(false)}>
          <p>This plan and the items you ticked will be removed. Your interviews and scores are not affected.</p>
          <ErrorBox error={reset.error} />
          <div className="row"><button className="btn danger" disabled={reset.busy} onClick={() => reset.run()}>Remove this plan</button><button className="btn ghost" onClick={() => setConfirmReset(false)}>Keep it</button></div>
        </Modal>
      )}
    </div>
  )
}

export default function StudyPlan() {
  const [params] = useSearchParams()
  const linked = (params.get('areas') ?? '').split(',').filter((a) => CATEGORY_LABELS[a])
  const res = useLoad(() => get<{ resources: Res[]; gaps: Gap[] }>('/resources'))
  const saved = useLoad(() => get<{ plan: Plan | null }>('/plan'))
  const [plan, setPlan] = useState<Plan | null>(null)
  useEffect(() => { if (saved.data) setPlan(saved.data.plan) }, [saved.data])
  const [tab, setTab] = useState<'plan' | 'dir'>('plan')
  const [topic, setTopic] = useState('')
  const [tier, setTier] = useState('')
  const vote = useAction(async (id: string, v: 1 | -1) => { const r = await post(`/resources/${id}/vote`, { vote: v }); res.setData({ ...res.data!, resources: r.resources }) })
  if ((res.loading && !res.data) || (saved.loading && !saved.data)) return <Spinner />
  if (!res.data || !saved.data) return <ErrorBox error={res.error ?? saved.error} onRetry={() => { res.reload(); saved.reload() }} />
  const { gaps, resources } = res.data
  const hasScores = gaps.some((g) => g.score !== null)
  const dir = resources.filter((r) => (!topic || r.topics.includes(topic)) && (!tier || r.tier === tier)).sort((a, b) => b.score - a.score)
  return (
    <>
      <PageHead title="Study plan" sub="A week-by-week plan built from your interview reports: study your weakest areas first, then test yourself with a mock interview each week." sample />
      <div className="tabs" style={{ marginBottom: 18 }}><button className={'tab' + (tab === 'plan' ? ' on' : '')} onClick={() => setTab('plan')}>My plan</button><button className={'tab' + (tab === 'dir' ? ' on' : '')} onClick={() => setTab('dir')}>All resources</button></div>
      {tab === 'plan' ? (
        plan ? <SavedPlan plan={plan} setPlan={setPlan} />
          : hasScores ? <Builder gaps={gaps} linked={linked} onSaved={setPlan} />
            : <Starter onSaved={setPlan} />
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
