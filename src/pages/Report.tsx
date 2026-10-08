import { useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { CATEGORY_LABELS, fmtDate, get, post, type Feedback, type Msg, type Session } from '../api'
import { Empty, ErrorBox, PageHead, Spinner, Stars, useAction, useToast } from '../ui'

type Data = { session: Session; messages: Msg[]; feedback: Feedback | null }

function reportText(d: Data) {
  const { session: s, feedback: f, messages } = d
  const lines = [`ProManAI interview report`, `${CATEGORY_LABELS[s.category]} · ${s.level} · ${s.difficulty} · ${fmtDate(s.created_at)}`, '']
  if (f) {
    lines.push(`Overall score: ${f.overall_score}/5`, f.explanation, '', 'Competencies')
    f.competency_scores.forEach((c) => lines.push(`- ${c.name}: ${c.score}/5. ${c.explanation}`))
    lines.push('', 'Strengths', ...f.strengths.map((x) => `- ${x}`), '', 'Areas to improve', ...f.improvement_areas.map((x) => `- ${x}`), '', 'Suggestions', ...f.suggestions.map((x) => `- ${x}`))
  }
  lines.push('', 'Transcript', ...messages.map((m) => `${m.role === 'interviewer' ? 'Interviewer' : 'You'}: ${m.content}`))
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
      <PageHead title={`${CATEGORY_LABELS[s.category]} report`} sub={`${s.level} · ${s.difficulty}${s.industry ? ' · ' + s.industry : ''} · ${fmtDate(s.created_at)}`} right={<div className="row"><Link className="btn ghost" to="/history">All interviews</Link>{f && <button className="btn" onClick={download}>Download .txt</button>}</div>} />
      <div className="stack lg">
        {(st === 'pending' || st === 'none') && <div className="card row"><Spinner /> <b>Preparing your feedback report…</b><span className="muted">This takes a few seconds.</span></div>}
        {st === 'failed' && <div className="err" role="alert"><span>The report could not be generated. Your interview and transcript are safe.</span><button className="btn sm ghost" onClick={requestReport}>Retry feedback</button></div>}
        {st === 'not_available' && <Empty title="No score for this interview">There were no submitted answers to score. Your transcript is below.<Link className="btn" to="/interview/setup">Try another interview</Link></Empty>}
        <ErrorBox error={error} onRetry={load} />
        {f && (<>
          <section className="card row" style={{ gap: 24 }}>
            <div className="score-ring"><div><b>{f.overall_score}</b><span>out of 5</span></div></div>
            <div style={{ flex: 1, minWidth: 240 }}><h2>Overall</h2><p className="muted" style={{ marginTop: 6 }}>{f.explanation}</p></div>
          </section>
          <div className="grid2">
            <section className="card"><h2 style={{ marginBottom: 6 }}>Competencies</h2>
              {f.competency_scores.map((c) => <div className="comp" key={c.name}><div className="row between"><b>{c.name}</b><span><b>{c.score}</b>/5</span></div><div className="meter lime"><i style={{ width: `${(c.score / 5) * 100}%` }} /></div><p className="small muted">{c.explanation}</p></div>)}
            </section>
            <div className="stack">
              <section className="card stack"><h2>Strengths</h2><ul className="list-plain">{f.strengths.map((x) => <li key={x}>{x}</li>)}</ul></section>
              <section className="card stack"><h2>Where to improve</h2><ul className="list-plain">{f.improvement_areas.map((x) => <li key={x}>{x}</li>)}</ul></section>
              <section className="card stack"><h2>Next steps</h2><ul className="list-plain">{f.suggestions.map((x) => <li key={x}>{x}</li>)}</ul><Link to="/ideas/roadmap" className="small">Turn these gaps into a study plan (idea 4)</Link></section>
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
          <div className="convo" style={{ maxHeight: 'none' }}>{messages.map((m) => <div key={m.seq} className={`msg ${m.role}${m.skipped ? ' skipped' : ''}`}><small>{m.role === 'interviewer' ? 'Interviewer' : 'You'}</small>{m.content}</div>)}</div>
        </section>
      </div>
    </>
  )
}
