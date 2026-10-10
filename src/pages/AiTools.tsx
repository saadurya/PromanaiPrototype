import { useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { fmtDate, get, post } from '../api'
import { Empty, ErrorBox, Meter, Modal, PageHead, Spinner, Stars, TalkingPoints, aiPoints, useAction, useLoad, useToast } from '../ui'

type Source = { kind: 'official' | 'secondary'; label: string; url: string }
type Tool = {
  id: string; name: string; maker: string; category: string; site: string; summary: string
  freePlan: 'yes' | 'trial' | 'no'; freeNote: string; platforms: string[] | null; checked: string; sources: Source[]; sourceNote?: string
  rating: number | null; reviewCount: number; ratedCount: number; affiliatedCount: number; sampleCount: number; topTasks: { task: string; label: string; count: number }[]
  breakdown: { stars: number; count: number }[]; stale: boolean; myReviewId: string | null
}
type Review = {
  id: string; toolId: string; rating: number; frequency: string; tasks: string[]; text: string; role: string; industry: string
  created: string; edited?: string; affiliated: boolean; sample: boolean; mine: boolean; helpfulCount: number; helpedByMe: boolean; reportedByMe: boolean
}
type Lists = { tasks: Record<string, string>; roles: string[]; frequency: Record<string, string>; industries: string[] }

const FREE = { yes: 'Free plan', trial: 'Free trial', no: 'Paid only' }
const RATING_WORDS = ['', 'Not useful', 'Limited', 'Useful', 'Very useful', "Can't work without it"]
// same rule as the server: words that look like words, so keyboard mashing does not pass the minimum
const realWords = (text: string) => text.split(/\s+/).map((w) => w.replace(/[^a-z']/gi, '')).filter((w) => w.length >= 2 && w.length <= 20 && /[aeiouy]/i.test(w)).length
const MIN_WORDS = 10
// lower-case the first letter only, so "Writing PRDs" becomes "writing PRDs", not "writing prds"
const lcFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1)

function FreePill({ t }: { t: Tool }) {
  return <span className={'pill' + (t.freePlan === 'no' ? ' line' : ' lime')}>{FREE[t.freePlan]}</span>
}
function SourceLine({ t }: { t: Tool }) {
  const officialOnly = t.sources.every((s) => s.kind === 'official')
  return <span className="small muted">Facts checked {fmtDate(t.checked)} · {officialOnly ? 'official source' : 'independent source'}{t.stale && ' · may be out of date'}</span>
}

export default function AiTools() {
  const { data, loading, error, reload } = useLoad(() => get<{ tools: Tool[] } & Lists>('/ai-tools'))
  const [params] = useSearchParams()
  const [prep, setPrep] = useState(params.get('prep') === '1')
  const [q, setQ] = useState('')
  const [task, setTask] = useState('')
  const [cat, setCat] = useState('')
  const [sort, setSort] = useState<'rating' | 'reviews' | 'name'>('rating')
  const list = useMemo(() => (data?.tools ?? [])
    .filter((t) => (!q || `${t.name} ${t.maker} ${t.summary}`.toLowerCase().includes(q.toLowerCase())) && (!cat || t.category === cat) && (!task || t.topTasks.some((x) => x.task === task)))
    .sort((a, b) => (sort === 'name' ? a.name.localeCompare(b.name) : sort === 'reviews' ? b.reviewCount - a.reviewCount : (b.rating ?? 0) - (a.rating ?? 0))), [data, q, task, cat, sort])
  if (loading && !data) return <Spinner />
  if (!data) return <ErrorBox error={error} onRetry={reload} />
  const categories = [...new Set(data.tools.map((t) => t.category))]
  return (
    <>
      <PageHead title="AI tools for PMs" sub="Checked facts about the AI tools product managers use, with sources, plus ratings and experiences from PMs who use them." sample />
      <div className="stack lg">
        <div className="banner info"><span><b>How this works:</b> facts like pricing come from each tool's official page, with the date we checked them. Ratings come only from PMs' reviews. Reviews marked <i>Sample</i> were written for this demo.</span></div>
        <section className="card row between">
          <div style={{ flex: 1, minWidth: 260 }}><h2>Asked “How do you use AI in your work?”</h2><p className="muted">Turn the tools you really use into a specific answer, then practise saying it in a mock interview.</p></div>
          <button className="btn lime" onClick={() => setPrep(true)}>Prepare your answer</button>
        </section>
        <div className="row">
          <input aria-label="Search tools" placeholder="Search tools" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 220 }} />
          <select aria-label="PM task" value={task} onChange={(e) => setTask(e.target.value)} style={{ width: 'auto' }}><option value="">All PM tasks</option>{Object.entries(data.tasks).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
          <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 'auto' }}><option value="">All categories</option>{categories.map((c) => <option key={c}>{c}</option>)}</select>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ width: 'auto' }}><option value="rating">Highest rated</option><option value="reviews">Most reviewed</option><option value="name">A to Z</option></select>
        </div>
        {list.length === 0 ? <Empty title="No tools match">Clear a filter or try another search.</Empty> : (
          <div className="grid2">{list.map((t) => (
            <Link key={t.id} to={`/ai-tools/${t.id}`} className="card tool-card">
              <div className="row between"><div><h2>{t.name}</h2><span className="small muted">by {t.maker}</span></div><div className="row"><span className="pill">{t.category}</span><FreePill t={t} /></div></div>
              <p className="muted">{t.summary}</p>
              <div className="row small">{t.rating !== null ? <><Stars value={t.rating} /><b>{t.rating}</b><span className="muted">· {t.reviewCount} review{t.reviewCount === 1 ? '' : 's'}</span></> : <span className="muted">No reviews yet</span>}</div>
              {t.topTasks.length > 0 && <div><span className="small muted">PMs use it for</span><div className="row" style={{ marginTop: 4 }}>{t.topTasks.slice(0, 3).map((x) => <span key={x.task} className="pill line">{x.label}</span>)}</div></div>}
              <SourceLine t={t} />
            </Link>
          ))}</div>
        )}
      </div>
      {prep && <UsagePrep tools={data.tools} tasks={data.tasks} onClose={() => setPrep(false)} />}
    </>
  )
}

export function AiToolDetail() {
  const { id } = useParams()
  const toast = useToast()
  const { data, setData, loading, error, reload } = useLoad(() => get<{ tool: Tool; reviews: Review[] } & Lists>(`/ai-tools/${id}`), [id])
  const [open, setOpen] = useState(false)
  const [sort, setSort] = useState<'helpful' | 'newest'>('helpful')
  const [task, setTask] = useState('')
  const replace = (r: Review) => data && setData({ ...data, reviews: data.reviews.map((x) => (x.id === r.id ? r : x)) })
  const helpful = useAction(async (rid: string) => replace((await post<{ review: Review }>(`/ai-reviews/${rid}/helpful`)).review))
  const report = useAction(async (rid: string) => { replace((await post<{ review: Review }>(`/ai-reviews/${rid}/report`)).review); toast('Thanks. The review has been flagged for moderation (demo).') })
  if (loading && !data) return <Spinner />
  if (!data) return <ErrorBox error={error} onRetry={reload} />
  const { tool: t, reviews } = data
  const mine = reviews.find((r) => r.mine)
  const shown = reviews.filter((r) => !task || r.tasks.includes(task))
    .sort((a, b) => (sort === 'newest' ? b.created.localeCompare(a.created) : Number(b.mine) - Number(a.mine) || b.helpfulCount - a.helpfulCount))
  const maxCount = Math.max(1, ...t.breakdown.map((b) => b.count))
  return (
    <>
      <p style={{ marginBottom: 12 }}><Link to="/ai-tools">← All AI tools</Link></p>
      <PageHead title={t.name} sub={t.summary} sample right={<button className="btn lime lg" onClick={() => setOpen(true)}>{mine ? 'Edit your review' : 'Share your experience'}</button>} />
      <div className="stack lg">
        <div className="grid2" style={{ alignItems: 'start' }}>
          <section className="card stack">
            <h2>Facts</h2>
            <table className="t"><tbody>
              <tr><th style={{ width: 120 }}>Made by</th><td>{t.maker}</td></tr>
              <tr><th>Category</th><td>{t.category}</td></tr>
              <tr><th>Free plan</th><td><FreePill t={t} /><div className="small" style={{ marginTop: 6 }}>{t.freeNote}</div></td></tr>
              <tr><th>Platforms</th><td>{t.platforms ? t.platforms.join(', ') : <span className="muted">Not checked yet</span>}</td></tr>
              <tr><th>Website</th><td><a href={t.site} target="_blank" rel="noreferrer">{t.site.replace(/^https?:\/\//, '')}</a></td></tr>
            </tbody></table>
            <div className="stack" style={{ gap: 6 }}>
              <b className="small">Sources · checked {fmtDate(t.checked)}</b>
              {t.sources.map((s) => <div key={s.url} className="row small"><span className={'pill' + (s.kind === 'official' ? ' ok' : ' line')}>{s.kind === 'official' ? 'Official' : 'Independent'}</span><a href={s.url} target="_blank" rel="noreferrer">{s.label}</a></div>)}
              {t.sourceNote && <p className="small" style={{ color: 'var(--danger)' }}>{t.sourceNote}</p>}
              {t.stale && <p className="small" style={{ color: 'var(--danger)' }}>These facts were checked more than 60 days ago and may be out of date.</p>}
              <p className="small muted">Prices and plans change often. Always confirm on the official site before you decide.</p>
            </div>
          </section>
          <section className="card stack">
            <h2>What PMs say</h2>
            {t.reviewCount === 0 ? <p className="muted">No reviews yet.</p> : (<>
              <div className="row" style={{ gap: 14 }}><span className="rating-big">{t.rating}</span><div><Stars value={t.rating ?? 0} /><div className="small muted">from {t.ratedCount} review{t.ratedCount === 1 ? '' : 's'}{t.sampleCount > 0 && `, ${t.sampleCount} of them sample`}</div></div></div>
              <div className="stack" style={{ gap: 6 }} aria-label="Rating breakdown">
                {t.breakdown.map((b) => <div key={b.stars} className="bar-row small"><span>{b.stars} ★</span><Meter pct={(b.count / maxCount) * 100} /><span className="muted">{b.count}</span></div>)}
              </div>
              {t.affiliatedCount > 0 && <p className="small muted">{t.affiliatedCount} review{t.affiliatedCount === 1 ? ' is' : 's are'} from people who work with {t.maker}. {t.affiliatedCount === 1 ? 'It is' : 'They are'} shown below but not counted in the rating.</p>}
              <div><b className="small">Most common uses</b><div className="row" style={{ marginTop: 6 }}>{t.topTasks.map((x) => <span key={x.task} className="pill line">{x.label} · {x.count}</span>)}</div></div>
            </>)}
          </section>
        </div>
        <section className="stack">
          <div className="row between">
            <h2>Experiences from PMs</h2>
            <div className="row">
              <select aria-label="Filter by task" value={task} onChange={(e) => setTask(e.target.value)} style={{ width: 'auto' }}><option value="">All uses</option>{t.topTasks.map((x) => <option key={x.task} value={x.task}>{x.label}</option>)}</select>
              <select aria-label="Sort reviews" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)} style={{ width: 'auto' }}><option value="helpful">Most helpful</option><option value="newest">Newest</option></select>
            </div>
          </div>
          <ErrorBox error={helpful.error ?? report.error} />
          {shown.length === 0 ? <Empty title="No experiences yet">Be the first PM to share how you use {t.name}.<button className="btn" onClick={() => setOpen(true)}>Share your experience</button></Empty> : shown.map((r) => (
            <article key={r.id} className={'review' + (r.mine ? '' : ' unver')}>
              <div className="row between">
                <span className="row"><Stars value={r.rating} /><b>{RATING_WORDS[r.rating]}</b></span>
                <span className="row">{r.mine && <span className="pill lime">Your review</span>}{r.sample && <span className="pill line">Sample</span>}{r.affiliated && <span className="pill warn">Works with the maker</span>}</span>
              </div>
              <div className="small muted">{r.role} · {r.industry} · uses it {data.frequency[r.frequency].toLowerCase()} · {fmtDate(r.created)}{r.edited && ' · edited'}</div>
              <div className="row">{r.tasks.map((k) => <span key={k} className="pill">{data.tasks[k]}</span>)}</div>
              <p>{r.text}</p>
              <div className="row small">
                {!r.mine && <button className={'btn sm' + (r.helpedByMe ? '' : ' ghost')} aria-pressed={r.helpedByMe} disabled={helpful.busy} onClick={() => helpful.run(r.id)}>Helpful · {r.helpfulCount}</button>}
                {r.mine ? <button className="btn sm ghost" onClick={() => setOpen(true)}>Edit</button> : r.reportedByMe ? <span className="muted">Reported</span> : <button className="btn sm ghost" disabled={report.busy} onClick={() => report.run(r.id)}>Report</button>}
              </div>
            </article>
          ))}
        </section>
      </div>
      {open && <ReviewModal tool={t} lists={data} existing={mine} onClose={() => setOpen(false)} onDone={() => { setOpen(false); toast(mine ? 'Review updated' : 'Thanks for sharing your experience'); reload() }} />}
    </>
  )
}

function ReviewModal({ tool, lists, existing, onClose, onDone }: { tool: Tool; lists: Lists; existing?: Review; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({
    frequency: existing?.frequency ?? '', rating: existing?.rating ?? 0, tasks: existing?.tasks ?? ([] as string[]), text: existing?.text ?? '',
    role: existing?.role ?? '', industry: existing?.industry ?? '', affiliated: existing?.affiliated ?? false,
  })
  const save = useAction(async () => { await post(`/ai-tools/${tool.id}/reviews`, f); onDone() })
  const len = f.text.trim().length
  const words = realWords(f.text)
  // say exactly what is missing, instead of a silently disabled button
  const missing = [
    !f.frequency && 'how often you use it', !f.rating && 'a star rating', !f.tasks.length && 'what you use it for',
    words < MIN_WORDS && `${MIN_WORDS - words} more word${MIN_WORDS - words === 1 ? '' : 's'} about your experience`, !f.role && 'your role', !f.industry && 'your industry',
  ].filter(Boolean) as string[]
  const valid = missing.length === 0 && len <= 1500
  const toggleTask = (k: string) => setF({ ...f, tasks: f.tasks.includes(k) ? f.tasks.filter((x) => x !== k) : [...f.tasks, k] })
  return (
    <Modal title={existing ? `Edit your review of ${tool.name}` : `Share your experience with ${tool.name}`} onClose={onClose} wide>
      <div className="field">1. How often do you use it?
        <div className="row" role="radiogroup" aria-label="How often">{Object.entries(lists.frequency).map(([k, v]) => <button key={k} type="button" role="radio" aria-checked={f.frequency === k} className={'chip' + (f.frequency === k ? ' on' : '')} onClick={() => setF({ ...f, frequency: k })}>{v}</button>)}</div>
      </div>
      <div className="field">2. Overall, how useful is it for your PM work?
        <div className="row"><Stars value={f.rating} onChange={(n) => setF({ ...f, rating: n })} /><span className="small muted">{RATING_WORDS[f.rating] || '1 = Not useful, 5 = Can’t work without it'}</span></div>
      </div>
      <div className="field">3. What do you use it for? <span className="small muted" style={{ fontWeight: 400 }}>Pick all that apply</span>
        <div className="row">{Object.entries(lists.tasks).map(([k, v]) => <button key={k} type="button" aria-pressed={f.tasks.includes(k)} className={'chip' + (f.tasks.includes(k) ? ' on' : '')} onClick={() => toggleTask(k)}>{v}</button>)}</div>
      </div>
      <label className="field">4. Your experience
        <textarea value={f.text} onChange={(e) => setF({ ...f, text: e.target.value })} style={{ minHeight: 110 }} maxLength={1500}
          placeholder={'What do you use it for, and how did it go?\nWhat works well, and what doesn’t?\nOne tip for other PMs.'} />
        <span className={'small' + (len > 0 && words < MIN_WORDS ? '' : ' muted')} style={len > 0 && words < MIN_WORDS ? { color: 'var(--danger)' } : undefined}>{words < MIN_WORDS ? `${words} of at least ${MIN_WORDS} words` : `${words} words · ${len} of 1,500 characters`}</span>
      </label>
      <div className="grid2">
        <label className="field">5. Your role<select value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })}><option value="">Choose…</option>{lists.roles.map((r) => <option key={r}>{r}</option>)}</select></label>
        <label className="field">Your industry<select value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })}><option value="">Choose…</option>{lists.industries.map((i) => <option key={i}>{i}</option>)}</select></label>
      </div>
      <label className="row small" style={{ cursor: 'pointer' }}><input type="checkbox" style={{ width: 18 }} checked={f.affiliated} onChange={(e) => setF({ ...f, affiliated: e.target.checked })} />I work for, or am paid by, the maker of {tool.name}<span className="muted"> (your review is shown, but not counted in the rating)</span></label>
      <p className="small muted">Your role and industry are shown with your review, your name is not. Do not share confidential company information. You can edit your review later.</p>
      <ErrorBox error={save.error} />
      <div className="row"><button className="btn" disabled={!valid || save.busy} onClick={() => save.run()}>{save.busy ? 'Saving…' : existing ? 'Save changes' : 'Share review'}</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
      {!valid && <p className="small" role="status" style={{ color: 'var(--danger)', marginTop: -6 }}>To share, add {missing.join(', ')}.</p>}
    </Modal>
  )
}

// Interview prep for "How do you use AI in your work?": real tools and tasks become a specific, honest answer
function UsagePrep({ tools, tasks, onClose }: { tools: Tool[]; tasks: Record<string, string>; onClose: () => void }) {
  const toast = useToast()
  const [picked, setPicked] = useState<{ id: string; task: string; result: string }[]>([])
  const toggle = (id: string) => setPicked((p) => (p.some((x) => x.id === id) ? p.filter((x) => x.id !== id) : p.length >= 3 ? p : [...p, { id, task: '', result: '' }]))
  const upd = (id: string, patch: Partial<{ task: string; result: string }>) => setPicked((p) => p.map((x) => (x.id === id ? { ...x, ...patch } : x)))
  const name = (id: string) => tools.find((t) => t.id === id)?.name ?? id
  const ready = picked.length > 0 && picked.every((x) => x.task)
  const example = picked.find((x) => x.result.trim())
  const points = ready ? [
    `Start with your habit: "I use ${picked.map((x) => `${name(x.id)} for ${lcFirst(tasks[x.task])}`).join(', and ')}."`,
    example ? `Give one specific example with a result: "With ${name(example.id)}, ${example.result.trim().replace(/\.$/, '')}."` : 'Give one specific example with a result, ideally a number: time saved, a decision it changed, or a mistake it caught.',
    'Show judgement: explain how you check the output before you trust it, for example verifying numbers and sources, and never pasting in confidential data.',
    'Name a limit: one task you do not hand to AI, and why.',
  ] : []
  const copy = () => navigator.clipboard?.writeText(points.map((p, k) => `${k + 1}. ${p}`).join('\n')).then(() => toast('Talking points copied')).catch(() => toast('Could not copy. Select the text instead.'))
  return (
    <Modal title="Prepare: “How do you use AI in your work?”" onClose={onClose} wide>
      <p className="muted small">Interviewers ask this to see judgement, not tool lists. Pick the tools you really use; a specific, honest answer beats an impressive one.</p>
      <div className="field">1. Which tools do you really use? <span className="small muted" style={{ fontWeight: 400 }}>Up to 3</span>
        <div className="row">{tools.map((t) => <button key={t.id} type="button" aria-pressed={picked.some((x) => x.id === t.id)} className={'chip' + (picked.some((x) => x.id === t.id) ? ' on' : '')} onClick={() => toggle(t.id)}>{t.name}</button>)}</div>
      </div>
      {picked.length > 0 && <div className="field">2. What do you use each one for?
        {picked.map((x) => (
          <div key={x.id} className="grid2" style={{ alignItems: 'end' }}>
            <label className="field small">{name(x.id)}<select value={x.task} onChange={(e) => upd(x.id, { task: e.target.value })}><option value="">Choose a task…</option>{Object.entries(tasks).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select></label>
            <label className="field small">One result (optional)<input value={x.result} maxLength={140} onChange={(e) => upd(x.id, { result: e.target.value })} placeholder="e.g. my first PRD draft went from 3 hours to 1" /></label>
          </div>
        ))}
      </div>}
      <section className="stack" style={{ gap: 8 }}>
        <b>Your talking points</b>
        {ready ? <TalkingPoints points={points} /> : <p className="small muted">Pick a tool and what you use it for to see your talking points.</p>}
        {ready && <p className="small muted">They come with you to the practice interview, hidden until you open them.</p>}
      </section>
      <div className="row">
        <Link className="btn lime" to="/interview/setup?categories=behavioral&question=ai-usage" onClick={() => aiPoints.set(points)}>{ready ? 'Practise with these points' : 'Practise without preparing'}</Link>
        <button className="btn ghost" disabled={!ready} onClick={copy}>Copy talking points</button>
        <button className="btn ghost" onClick={onClose}>Close</button>
      </div>
    </Modal>
  )
}
