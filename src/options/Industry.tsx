import { useState } from 'react'
import { Link } from 'react-router-dom'
import { CATEGORY_LABELS, get } from '../api'
import { ErrorBox, PageHead, Spinner, useLoad } from '../ui'

type Ind = { id: string; name: string; company: string; ctx: string; user: string; metric: string; tension: string; questions: Record<string, string> }
const GENERIC: Record<string, string> = {
  'product-sense': 'You are the PM at Lumen, a photo-sharing app. How would you improve the experience for a casual user?',
  execution: 'Lumen plans to launch a major feature in six weeks and engineering says it will take eight. Walk me through what you do.',
  metrics: 'Weekly active users at Lumen dropped 8% week over week. How do you figure out what happened?',
  strategy: 'Lumen, a photo-sharing app, is considering a new market segment. Would you enter it, and why?',
  behavioral: 'Tell me about a time you had to push a product decision forward without full agreement.',
}

export default function Industry() {
  const { data, loading, error, reload } = useLoad(() => get<{ industries: Ind[] }>('/industries'))
  const [sel, setSel] = useState('fintech')
  const [cat, setCat] = useState('metrics')
  const ind = data?.industries.find((i) => i.id === sel)
  return (
    <>
      <PageHead title="Choose your industry" sub="Pick an industry before you start, and the interviewer sets every question inside that world: its users, its metrics and its trade-offs." sample />
      {loading && <Spinner />}
      <ErrorBox error={error} onRetry={reload} />
      {data && ind && (
        <div className="stack lg">
          <div className="ind-grid" role="radiogroup" aria-label="Industry">
            {data.industries.map((i) => <button key={i.id} role="radio" aria-checked={sel === i.id} className={'choice' + (sel === i.id ? ' on' : '')} onClick={() => setSel(i.id)}><b>{i.name}</b></button>)}
          </div>
          <div className="grid2">
            <section className="card stack">
              <span className="pill lime" style={{ justifySelf: 'start' }}>{ind.name}</span>
              <h2>{ind.company}</h2>
              <p>{ind.ctx.charAt(0).toUpperCase() + ind.ctx.slice(1)}.</p>
              <table className="t"><tbody>
                <tr><th>Typical user</th><td>{ind.user}</td></tr>
                <tr><th>Metric that matters</th><td>{ind.metric}</td></tr>
                <tr><th>Core tension</th><td>{ind.tension}</td></tr>
              </tbody></table>
              <p className="small muted">Fictional company, used so nothing you say is judged against real company facts.</p>
            </section>
            <section className="card stack">
              <h2>Same question type, tailored</h2>
              <div className="tabs" role="tablist">{Object.entries(CATEGORY_LABELS).map(([k, v]) => <button key={k} role="tab" aria-selected={cat === k} className={'tab' + (cat === k ? ' on' : '')} onClick={() => setCat(k)}>{v}</button>)}</div>
              <div><div className="small muted" style={{ marginBottom: 4 }}>With {ind.name}</div><div className="msg interviewer" style={{ maxWidth: '100%' }}>{ind.questions[cat]}</div></div>
              <div><div className="small muted" style={{ marginBottom: 4 }}>Without an industry</div><div className="msg candidate" style={{ maxWidth: '100%', justifySelf: 'stretch' }}>{GENERIC[cat]}</div></div>
              <Link className="btn lime" style={{ justifySelf: 'start' }} to={`/interview/setup?industry=${ind.id}&category=${cat}`}>Practise {ind.name} · {CATEGORY_LABELS[cat]}</Link>
            </section>
          </div>
        </div>
      )}
    </>
  )
}
