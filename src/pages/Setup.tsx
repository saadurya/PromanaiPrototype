import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORY_LABELS, engine, get } from '../api'
import { ErrorBox, PageHead, useAction } from '../ui'

const DIFFS = [['easy', 'Easy', 'A warm-up pace with clearer prompts.'], ['medium', 'Medium', 'Realistic pressure and small constraints.'], ['hard', 'Hard', 'Tight constraints and sharper follow-ups.']] as const

export function MicCheck({ onPass, compact }: { onPass: () => void; compact?: boolean }) {
  const [s, setS] = useState({ perm: false, sound: false, speech: false })
  const [err, setErr] = useState('')
  const [level, setLevel] = useState(0)
  const test = async () => {
    setErr('')
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setS((x) => ({ ...x, perm: true }))
      const ctx = new AudioContext(); const an = ctx.createAnalyser(); ctx.createMediaStreamSource(stream).connect(an)
      const buf = new Uint8Array(an.frequencyBinCount); let n = 0
      const t = setInterval(() => {
        an.getByteTimeDomainData(buf); const v = Math.max(...buf) - 128; setLevel(Math.min(100, v * 2.5))
        if (v > 12 && ++n > 3) { clearInterval(t); stream.getTracks().forEach((tr) => tr.stop()); setS({ perm: true, sound: true, speech: true }); onPass() }
      }, 120)
      setTimeout(() => clearInterval(t), 15000)
    } catch { setErr('We could not access your microphone. Allow access in your browser, then test again. You cannot start without a working mic.') }
  }
  const simulate = () => { setS({ perm: true, sound: true, speech: true }); setErr(''); onPass() }
  const C = ({ ok, label }: { ok: boolean; label: string }) => <div className={'check' + (ok ? ' ok' : '')}><i>{ok ? '✓' : ''}</i>{label}</div>
  return (
    <div className="stack">
      <div className="checklist"><C ok={s.perm} label="Microphone permission granted" /><C ok={s.sound} label="Sound detected: say a few words" /><C ok={s.speech} label="Speech recognized" /></div>
      {!compact && <div className="meter lime" aria-hidden="true"><i style={{ width: `${level}%` }} /></div>}
      {err && <div className="err" role="alert">{err}</div>}
      <div className="row"><button className="btn" onClick={test}>Test microphone</button><button className="btn ghost" onClick={simulate}>Use simulated mic (prototype)</button></div>
    </div>
  )
}

export default function Setup() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  const industryId = params.get('industry')
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState('')
  const [category, setCategory] = useState('')
  const [difficulty, setDifficulty] = useState('')
  const [mic, setMic] = useState(false)
  const [industryName, setIndustryName] = useState('')
  useEffect(() => { if (industryId) get('/industries').then((r) => setIndustryName(r.industries.find((x: any) => x.id === industryId)?.name || '')).catch(() => {}) }, [industryId])
  useEffect(() => { const c = params.get('category'); if (c && CATEGORY_LABELS[c]) setCategory(c) }, [params])
  const start = useAction(async () => { await engine({ action: 'start', level, category, difficulty, industry: industryId || undefined }); nav('/interview/live', { replace: true, state: { fresh: true } }) })
  const steps = ['Level', 'Focus', 'Microphone', 'Confirm']
  return (
    <>
      <PageHead title="Set up your interview" sub="Four quick steps. The clock starts only when you confirm." />
      <div className="stepper">{steps.map((s, i) => <div key={s} className={'step' + (i === step ? ' on' : i < step ? ' done' : '')}><i>{i < step ? '✓' : i + 1}</i>{s}</div>)}</div>
      {industryId && <p className="small" style={{ marginBottom: 14 }}><span className="pill lime">Industry: {industryName || industryId}</span> <Link to="/ideas/industry">Change</Link></p>}
      <div className="card stack lg" style={{ maxWidth: 760 }}>
        {step === 0 && (<>
          <h2>Which role are you practising for?</h2>
          <div className="grid2">{[['APM', 'Associate PM', 'Early career or career switch'], ['PM', 'Product Manager', 'Practising PM aiming for the next role']].map(([v, t, d]) => <button key={v} className={'choice' + (level === v ? ' on' : '')} onClick={() => setLevel(v)}><b>{t}</b><span className="muted">{d}</span></button>)}</div>
        </>)}
        {step === 1 && (<>
          <h2>What do you want to practise?</h2>
          <div className="grid3">{Object.entries(CATEGORY_LABELS).map(([v, t]) => <button key={v} className={'choice' + (category === v ? ' on' : '')} onClick={() => setCategory(v)}><b>{t}</b></button>)}</div>
          <h3>Difficulty</h3>
          <div className="grid3">{DIFFS.map(([v, t, d]) => <button key={v} className={'choice' + (difficulty === v ? ' on' : '')} onClick={() => setDifficulty(v)}><b>{t}</b><span className="muted small">{d}</span></button>)}</div>
        </>)}
        {step === 2 && (<><h2>Check your microphone</h2><p className="muted">This is a voice interview, so a working mic is required.</p><MicCheck onPass={() => setMic(true)} /></>)}
        {step === 3 && (<>
          <h2>Ready when you are</h2>
          <ul className="list-plain"><li><b>{level === 'APM' ? 'Associate PM' : 'Product Manager'}</b>, {CATEGORY_LABELS[category]}, {difficulty}{industryName ? `, ${industryName}` : ''}</li><li>20 minutes. The timer runs on our server, so refreshing will not reset it.</li><li>You can skip up to 2 questions. Nothing auto-submits.</li></ul>
          <ErrorBox error={start.error} />
          {(start.error as any)?.code === 'already_running' && <Link className="btn ghost" to="/interview/live" style={{ justifySelf: 'start' }}>Go to the running interview</Link>}
        </>)}
        <div className="row between">
          <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
          {step < 3 ? <button className="btn" disabled={(step === 0 && !level) || (step === 1 && !(category && difficulty)) || (step === 2 && !mic)} onClick={() => setStep(step + 1)}>Continue</button>
            : <button className="btn lime lg" disabled={start.busy} onClick={() => start.run()}>{start.busy ? 'Preparing your question…' : 'Start interview'}</button>}
        </div>
      </div>
    </>
  )
}
