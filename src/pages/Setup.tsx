import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORY_LABELS, engine, get } from '../api'
import { ErrorBox, PageHead, useAction, useLoad } from '../ui'
import StorageCleanup from '../StorageCleanup'

const DIFFS = [['easy', 'Easy', 'A warm-up pace with clearer prompts.'], ['medium', 'Medium', 'Realistic pressure and small constraints.'], ['hard', 'Hard', 'Tight constraints and sharper follow-ups.']] as const
type Ind = { id: string; name: string; company: string; ctx: string; user: string; metric: string; tension: string }

export default function Setup() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const industryId = params.get('industry') || ''
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState('')
  const [industry, setIndustry] = useState(industryId)
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const inds = useLoad(() => get<{ industries: Ind[] }>('/industries'))
  useEffect(() => { const c = params.get('category'); if (c && CATEGORY_LABELS[c]) setCategory(c) }, [params])
  const selInd = inds.data?.industries.find((x) => x.id === industry)
  const start = useAction(async () => { await engine({ action: 'start', level, category, difficulty, industry: industry || undefined }); nav('/interview/live', { replace: true, state: { fresh: true } }) })
  const startErr = (start.error as { code?: string } | null)?.code
  const steps = ['Level', 'Industry', 'Focus', 'Confirm']
  return (
    <>
      <PageHead title="Set up your AI interview" sub="Four quick steps. The clock starts only when you confirm." />
      <div style={{ maxWidth: 760, marginBottom: 14 }}><StorageCleanup key={startErr === 'storage_full' ? 'full' : 'ok'} onFreed={(st) => { if (!st.full) start.setError(null) }} /></div>
      <div className="stepper">{steps.map((s, i) => <div key={s} className={'step' + (i === step ? ' on' : i < step ? ' done' : '')}><i>{i < step ? '✓' : i + 1}</i>{s}</div>)}</div>
      <div className="card stack lg" style={{ maxWidth: 760 }}>
        {step === 0 && (<>
          <h2>Which role are you practising for?</h2>
          <div className="grid2">{[['APM', 'Associate PM', 'Early career or career switch'], ['PM', 'Product Manager', 'Practising PM aiming for the next role']].map(([v, t, d]) => <button key={v} className={'choice' + (level === v ? ' on' : '')} onClick={() => setLevel(v)}><b>{t}</b><span className="muted">{d}</span></button>)}</div>
        </>)}
        {step === 1 && (<>
          <h2>Pick an industry for your questions</h2>
          <p className="muted">The interviewer sets every question inside that world: its users, its metrics and its trade-offs. Industry selection is part of setting up the interview, not a separate menu.</p>
          {inds.loading && <p className="muted">Loading industries…</p>}
          <ErrorBox error={inds.error} onRetry={inds.reload} />
          <div className="ind-grid" role="radiogroup" aria-label="Industry">
            <button role="radio" aria-checked={industry === ''} className={'choice' + (industry === '' ? ' on' : '')} onClick={() => setIndustry('')}><b>No specific industry</b></button>
            {inds.data?.industries.map((i) => <button key={i.id} role="radio" aria-checked={industry === i.id} className={'choice' + (industry === i.id ? ' on' : '')} onClick={() => setIndustry(i.id)}><b>{i.name}</b></button>)}
          </div>
          {selInd && (
            <section className="card stack" style={{ background: 'var(--bg, #faf9ff)' }}>
              <span className="pill lime" style={{ justifySelf: 'start' }}>{selInd.name}</span>
              <h3>{selInd.company}</h3>
              <p className="small">{selInd.ctx.charAt(0).toUpperCase() + selInd.ctx.slice(1)}.</p>
              <table className="t"><tbody>
                <tr><th>Typical user</th><td>{selInd.user}</td></tr>
                <tr><th>Metric that matters</th><td>{selInd.metric}</td></tr>
                <tr><th>Core tension</th><td>{selInd.tension}</td></tr>
              </tbody></table>
              <p className="small muted">Fictional company, used so nothing you say is judged against real company facts.</p>
            </section>
          )}
        </>)}
        {step === 2 && (<>
          <h2>What do you want to practise?</h2>
          <div className="grid3">{Object.entries(CATEGORY_LABELS).map(([v, t]) => <button key={v} className={'choice' + (category === v ? ' on' : '')} onClick={() => setCategory(v)}><b>{t}</b></button>)}</div>
          <h3>Difficulty</h3>
          <div className="grid3">{DIFFS.map(([v, t, d]) => <button key={v} className={'choice' + (difficulty === v ? ' on' : '')} onClick={() => setDifficulty(v)}><b>{t}</b><span className="muted small">{d}</span></button>)}</div>
        </>)}
        {step === 3 && (<>
          <h2>Ready when you are</h2>
          <ul className="list-plain"><li><b>{level === 'APM' ? 'Associate PM' : 'Product Manager'}</b>, {CATEGORY_LABELS[category]}, {difficulty}{selInd ? `, ${selInd.name}` : ''}</li><li>20 minutes. The timer keeps running if you refresh, so take your time but do not close the tab.</li><li>You can skip up to 2 questions. Nothing auto-submits.</li></ul>
          <ErrorBox error={start.error} />
          {startErr === 'already_running' && <Link className="btn ghost" to="/interview/live" style={{ justifySelf: 'start' }}>Go to the running interview</Link>}
        </>)}
        <div className="row between">
          <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          {step < 3 ? <button className="btn" disabled={(step === 0 && !level) || (step === 2 && !(category && difficulty))} onClick={() => setStep(step + 1)}>Continue</button>
            : <button className="btn lime lg" disabled={start.busy} onClick={() => start.run()}>{start.busy ? 'Preparing your question…' : 'Start interview'}</button>}
        </div>
      </div>
    </>
  )
}
