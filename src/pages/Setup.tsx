import { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORY_LABELS, engine, get } from '../api'
import { ErrorBox, PageHead, useAction } from '../ui'
import StorageCleanup from '../StorageCleanup'
import { browserSupport, ERRORS, SR } from '../voice'

const DIFFS = [['easy', 'Easy', 'A warm-up pace with clearer prompts.'], ['medium', 'Medium', 'Realistic pressure and small constraints.'], ['hard', 'Hard', 'Tight constraints and sharper follow-ups.']] as const

// Each check must pass on real hardware: browser, mic permission, audible sound, and an actual speech-recognition result.
type Checks = { browser: boolean; perm: boolean; sound: boolean; speech: boolean }
export function MicCheck({ onPass, compact }: { onPass: () => void; compact?: boolean }) {
  const browser = useMemo(browserSupport, [])
  const [s, setS] = useState<Checks>({ browser: browser.ok, perm: false, sound: false, speech: false })
  const [err, setErr] = useState('')
  const [level, setLevel] = useState(0)
  const [heard, setHeard] = useState('')
  const [running, setRunning] = useState(false)
  const cleanup = useRef<() => void>(() => {})
  useEffect(() => () => cleanup.current(), [])

  const test = async () => {
    cleanup.current(); setErr(''); setHeard(''); setS({ browser: browser.ok, perm: false, sound: false, speech: false })
    let stream: MediaStream
    try { stream = await navigator.mediaDevices.getUserMedia({ audio: true }) } catch { setErr('We could not access your microphone. Allow access in your browser, then test again. You cannot start without a working mic.'); return }
    setRunning(true)
    const got = { sound: false, speech: false }
    const ctx = new AudioContext(); const an = ctx.createAnalyser(); ctx.createMediaStreamSource(stream).connect(an)
    const buf = new Uint8Array(an.frequencyBinCount); let n = 0
    const rec = new SR(); rec.continuous = true; rec.interimResults = true; rec.lang = 'en-US'
    let done = false
    const stop = () => {
      if (done) return
      done = true
      clearInterval(tick); clearTimeout(limit)
      try { rec.abort() } catch { /* noop */ }
      stream.getTracks().forEach((tr) => tr.stop()); ctx.close().catch(() => {})
      setLevel(0); setRunning(false)
    }
    cleanup.current = stop
    const check = () => { setS({ browser: true, perm: true, sound: got.sound, speech: got.speech }); if (got.sound && got.speech) { stop(); onPass() } }
    const tick = setInterval(() => {
      an.getByteTimeDomainData(buf); const v = Math.max(...buf) - 128; setLevel(Math.min(100, v * 2.5))
      if (!got.sound && v > 12 && ++n > 3) { got.sound = true; check() }
    }, 120)
    rec.onresult = (e: any) => {
      let t = ''; for (let k = 0; k < e.results.length; k++) t += e.results[k][0].transcript
      setHeard(t.trim())
      if (!got.speech && t.trim().split(/\s+/).length >= 2) { got.speech = true; check() }
    }
    rec.onerror = (e: any) => { if (e.error === 'no-speech' || e.error === 'aborted') return; stop(); setErr(ERRORS[e.error] || 'Speech recognition failed. Try again.') }
    const limit = setTimeout(() => {
      stop()
      setErr(!got.sound ? 'We did not pick up any sound. Check the right microphone is selected and not muted, then test again.' : 'We heard sound but could not recognise words. Speak a full sentence clearly, then test again.')
    }, 15000)
    setS({ browser: true, perm: true, sound: false, speech: false })
    try { rec.start() } catch { stop(); setErr('Could not start speech recognition. Close other tabs using the mic and try again.') }
  }
  const simulate = () => { setS({ browser: true, perm: true, sound: true, speech: true }); setErr(''); onPass() }
  const C = ({ ok, label }: { ok: boolean; label: string }) => <div className={'check' + (ok ? ' ok' : '')}><i>{ok ? '✓' : ''}</i>{label}</div>
  return (
    <div className="stack">
      {!browser.ok && <div className="err" role="alert"><span>Voice interviews only work in desktop Chrome or Edge, and you are using {browser.name}. Open ProManAI in Chrome or Edge to continue.</span></div>}
      <div className="checklist">
        <C ok={s.browser} label="Desktop Chrome or Edge" />
        <C ok={s.perm} label="Microphone permission granted" />
        <C ok={s.sound} label="Sound detected" />
        <C ok={s.speech} label="Speech recognized" />
      </div>
      {running && <p className="small"><b>Say out loud:</b> “I am ready for my interview.”</p>}
      {heard && <p className="small muted">We heard: “{heard}”</p>}
      {!compact && <div className="meter lime" aria-hidden="true"><i style={{ width: `${level}%` }} /></div>}
      {err && <div className="err" role="alert">{err}</div>}
      <div className="row">
        <button className="btn" onClick={test} disabled={!browser.ok || running}>{running ? 'Listening…' : 'Test microphone'}</button>
        {import.meta.env.DEV && <button className="btn ghost" onClick={simulate}>Use simulated mic (dev only)</button>}
      </div>
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
  const startErr = (start.error as { code?: string } | null)?.code
  const steps = ['Level', 'Focus', 'Microphone', 'Confirm']
  return (
    <>
      <PageHead title="Set up your interview" sub="Four quick steps. The clock starts only when you confirm." />
      <div style={{ maxWidth: 760, marginBottom: 14 }}><StorageCleanup key={startErr === 'storage_full' ? 'full' : 'ok'} onFreed={(st) => { if (!st.full) start.setError(null) }} /></div>
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
          {startErr === 'already_running' && <Link className="btn ghost" to="/interview/live" style={{ justifySelf: 'start' }}>Go to the running interview</Link>}
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
