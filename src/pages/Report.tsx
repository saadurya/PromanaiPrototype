import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CATEGORY_LABELS, fmtDate, interviewTitle, sessionCategories, get, post, type Feedback, type FeedbackPoint, type Msg, type Session } from '../api'
import { Empty, ErrorBox, PageHead, Spinner, Stars, useAction, useToast } from '../ui'

type Data = { session: Session; messages: Msg[]; feedback: Feedback | null }
const asPoint = (p: FeedbackPoint | string): FeedbackPoint => (typeof p === 'string' ? { text: p } : p)
const said = (p: FeedbackPoint) => (p.quote ? ` (you said: "${p.quote}${p.cut ? '…' : ''}")` : '')

// jump to an answer in the transcript and highlight it briefly
function goTo(seq: number) {
  const el = document.getElementById(`msg-${seq}`)
  if (!el) return
  el.scrollIntoView({ behavior: 'smooth', block: 'center' })
  el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800)
}
function Quote({ text, cut, seq, label }: { text: string; cut?: boolean; seq: number; label?: string }) {
  return (
    <blockquote className="quote">
      {label && <span className="quote-label">{label}</span>}
      “{text}{cut ? '…' : ''}”
      <button type="button" className="link-btn" onClick={() => goTo(seq)}>See in transcript</button>
    </blockquote>
  )
}
// points that share the same quote show it once
function Points({ title, items, seq, good }: { title: string; items: (FeedbackPoint | string)[]; seq: number; good: boolean }) {
  const groups: { points: FeedbackPoint[]; quote?: string; cut?: boolean }[] = []
  items.map(asPoint).forEach((p) => { const g = groups[groups.length - 1]; if (g && p.quote && g.quote === p.quote) g.points.push(p); else groups.push({ points: [p], quote: p.quote, cut: p.cut }) })
  return (
    <div className="stack" style={{ gap: 8 }}>
      <b className="small">{title}</b>
      {groups.map((g, k) => (
        <div key={k} className="point">
          {g.points.map((p) => <p key={p.text} className="small"><span className={good ? 'mark ok' : 'mark miss'} aria-hidden="true">{good ? '✓' : '✗'}</span> {p.text}{p.note && <span className="muted"> {p.note}</span>}</p>)}
          {g.quote && <Quote text={g.quote} cut={g.cut} seq={seq} />}
        </div>
      ))}
    </div>
  )
}

const who = (m: Msg) => (m.role === 'interviewer' ? (m.kind === 'clarify' ? 'Interviewer (clarification)' : 'Interviewer') : m.kind === 'clarify' ? 'You (clarifying question)' : 'You')

function reportText(d: Data) {
  const { session: s, feedback: f, messages } = d
  const lines = [`ProManAI interview report`, `${interviewTitle(s)} · ${s.level} · ${s.difficulty} · ${fmtDate(s.created_at)}`, '']
  if (f) {
    lines.push(`Overall score: ${f.overall_score}/5`, f.explanation, '')
    if (f.answers?.length) {
      lines.push('Answer by answer')
      f.answers.forEach((a, k) => {
        lines.push(`Q${k + 1}: ${a.question}`)
        if (a.skipped) { lines.push('  Skipped'); return }
        lines.push(`  ${a.verdict}`, ...(a.good ?? []).map(asPoint).map((p) => `  + ${p.text}${said(p)}`), ...(a.missing ?? []).map(asPoint).map((p) => `  - ${p.text}${p.note ? ' ' + p.note : ''}${said(p)}`), `  Try next time: ${a.tip}`)
      })
      lines.push('')
    }
    lines.push('Competencies')
    f.competency_scores.forEach((c) => lines.push(`- ${c.name}: ${c.score}/5. ${c.explanation}${c.evidence ? ` Evidence (question ${c.evidence.qn}): "${c.evidence.quote}${c.evidence.cut ? '…' : ''}"` : c.evidence === null ? ' No sentence in your answers showed this skill.' : ''}`))
    lines.push('', 'Strengths', ...f.strengths.map((x) => `- ${x}`), '', 'Areas to improve', ...f.improvement_areas.map((x) => `- ${x}`), '', 'Suggestions', ...f.suggestions.map((x) => `- ${x}`))
  }
  lines.push('', 'Transcript', ...messages.map((m) => `${who(m)}: ${m.content}`))
  return lines.join('\n')
}

export default function Report() {
  const { id } = useParams()
  const toast = useToast()
  const [d, setD] = useState<Data | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [stars, setStars] = useState(0)
  const [comment, setComment] = useState('')
  const asked = useRef(false)

  const load = async () => { try { const x = await get<Data>(`/interviews/${id}`); setD(x); setError(null); return x } catch (e) { setError(e) } }
  const requestReport = async () => { try { await post('/interview-feedback', { id }); await load() } catch (e) { setError(e) } }
  useEffect(() => { load().then((x) => { if (x && !asked.current && x.session.feedback_status === 'none' && x.session.status !== 'in_progress') { asked.current = true; requestReport() } }) }, [id]) // eslint-disable-line
  // poll while the report is being written
  useEffect(() => {
    if (d?.session.feedback_status !== 'pending') return
    const t = setInterval(load, 1500)
    return () => clearInterval(t)
  }, [d?.session.feedback_status]) // eslint-disable-line
  const rate = useAction(async () => { await post(`/interviews/${id}/rating`, { rating: stars, comment }); toast('Thanks for the rating'); await load() })

  if (error && !d) return <ErrorBox error={error} onRetry={load} />
  if (!d) return <Spinner />
  const { session: s, feedback: f, messages } = d
  const download = () => { const a = document.createElement('a'); a.href = URL.createObjectURL(new Blob([reportText(d)], { type: 'text/plain' })); a.download = `promanai-${s.category}-${s.id}.txt`; a.click(); URL.revokeObjectURL(a.href) }
  const st = s.feedback_status
  return (
    <>
      <PageHead title={`${interviewTitle(s)} report`} sub={`${s.level} · ${s.difficulty}${s.industry ? ' · ' + (s.industry_name ?? s.industry) : ''} · ${fmtDate(s.created_at)}`} right={<div className="row"><Link className="btn ghost" to="/history">All interviews</Link>{f && <button className="btn" onClick={download}>Download .txt</button>}</div>} />
      <div className="stack lg">
        {s.opening === 'ai-usage' && <div className="banner info"><span><b>Practice only.</b> This "How do you use AI?" practice is kept separate: it does not change your progress, focus areas or study plan.</span></div>}
        {s.status === 'in_progress' && <div className="banner info"><span><b>This interview is still in progress.</b> The report is written after it ends.</span><Link className="btn sm" to="/interview/live">Resume</Link></div>}
        {s.status !== 'in_progress' && (st === 'pending' || (st === 'none' && !error)) && <div className="card row"><Spinner /> <b>Preparing your feedback report…</b><span className="muted">This takes a few seconds.</span></div>}
        {st === 'failed' && <div className="err" role="alert"><span>The report could not be generated. Your interview and transcript are safe.</span><button className="btn sm ghost" onClick={requestReport}>Retry feedback</button></div>}
        {st === 'not_available' && <Empty title="No score for this interview">There were no submitted answers to score. Your transcript is below.<Link className="btn" to="/interview/setup">Try another interview</Link></Empty>}
        <ErrorBox error={error} onRetry={st === 'none' || st === 'failed' ? requestReport : load} />
        {f && (<>
          <section className="card row" style={{ gap: 24 }}>
            <div className="score-ring"><div><b>{f.overall_score}</b><span>out of 5</span></div></div>
            <div style={{ flex: 1, minWidth: 240 }}><h2>Overall {f.band && <span className={'pill ' + (f.band === 'Strong' ? 'ok' : f.band === 'Needs work' ? 'warn' : '')}>{f.band}</span>}</h2><p className="muted" style={{ marginTop: 6 }}>{f.explanation}</p><p className="small muted" style={{ marginTop: 8 }}>A practice estimate generated by AI, not a hiring assessment. <Link to="/disclaimer">Disclaimer</Link></p></div>
          </section>
          {f.answers && f.answers.length > 0 && (
            <section className="card stack">
              <div><h2>Answer by answer</h2><p className="small muted">What worked and what to fix in each answer. Every point quotes your own words, exactly as you submitted them, so you can check it for yourself.</p></div>
              <div>{f.answers.map((a, k) => (
                <div key={a.seq} className="qa">
                  <div className="row between"><b>Question {k + 1}{a.area && CATEGORY_LABELS[a.area] && ` · ${CATEGORY_LABELS[a.area]}`}</b>{a.skipped ? <span className="pill line">Skipped</span> : <span className={'pill ' + (a.verdict === 'Strong' ? 'ok' : a.verdict === 'Needs work' ? 'warn' : '')}>{a.verdict}</span>}</div>
                  <p className="muted">{a.question}</p>
                  {!a.skipped && (<>
                    <details><summary className="small">Your answer</summary><p className="small" style={{ marginTop: 6 }}>{a.answer}</p></details>
                    {!!a.good?.length && <Points title="What worked" items={a.good} seq={a.seq} good />}
                    {!!a.missing?.length && <Points title="What was missing" items={a.missing} seq={a.seq} good={false} />}
                    <p className="small"><b>Try next time:</b> {a.tip}</p>
                  </>)}
                </div>
              ))}</div>
            </section>
          )}
          <div className="grid2">
            <section className="card"><h2 style={{ marginBottom: 6 }}>Competencies</h2>
              {f.competency_scores.map((c) => <div className="comp" key={c.name}><div className="row between"><b>{c.name}</b><span><b>{c.score}</b>/5</span></div><div className="meter lime"><i style={{ width: `${(c.score / 5) * 100}%` }} /></div><p className="small muted">{c.explanation}</p>{c.evidence ? <Quote text={c.evidence.quote} cut={c.evidence.cut} seq={c.evidence.seq} label={`Question ${c.evidence.qn}`} /> : c.evidence === null && <p className="small muted"><i>No sentence in your answers showed this skill.</i></p>}</div>)}
            </section>
            <div className="stack">
              <section className="card stack"><h2>Strengths</h2><ul className="list-plain">{f.strengths.map((x) => <li key={x}>{x}</li>)}</ul></section>
              <section className="card stack"><h2>Where to improve</h2><ul className="list-plain">{f.improvement_areas.map((x) => <li key={x}>{x}</li>)}</ul></section>
              <section className="card stack"><h2>Next steps</h2><ul className="list-plain">{f.suggestions.map((x) => <li key={x}>{x}</li>)}</ul>{s.opening === 'ai-usage'
                ? <div className="row"><Link className="btn lime" to="/interview/setup?categories=behavioral&question=ai-usage">Practise this again</Link><Link className="btn ghost" to="/ai-tools?prep=1">Rework your talking points</Link></div>
                : <div className="row"><Link className="btn lime" to={`/interview/setup?categories=${sessionCategories(s).join(',')}`}>Practise this again</Link><Link className="btn ghost" to={`/study-plan?areas=${sessionCategories(s).join(',')}`}>Build a study plan</Link></div>}</section>
            </div>
          </div>
        </>)}
        {s.status !== 'in_progress' && (
          <section className="card stack"><h2>How was this interview?</h2>
            {s.rating ? <div className="row"><Stars value={s.rating.rating} /> <span className="muted">{s.rating.comment || 'Thanks for rating.'}</span></div> : (<>
              <Stars value={stars} onChange={setStars} />
              <textarea placeholder="Optional comment" value={comment} onChange={(e) => setComment(e.target.value)} style={{ minHeight: 70 }} maxLength={500} />
              <ErrorBox error={rate.error} />
              <button className="btn" style={{ justifySelf: 'start' }} disabled={!stars || rate.busy} onClick={() => rate.run()}>Submit rating</button>
            </>)}
          </section>
        )}
        <section className="card stack"><h2>Transcript</h2>
          <div className="convo" style={{ maxHeight: 'none' }}>{messages.map((m) => <div key={m.seq} id={`msg-${m.seq}`} className={`msg ${m.role}${m.skipped ? ' skipped' : ''}${m.kind === 'clarify' ? ' clarify' : ''}`}><small>{who(m)}</small>{m.content}</div>)}</div>
        </section>
      </div>
    </>
  )
}
