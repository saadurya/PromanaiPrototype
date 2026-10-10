import { useEffect, useRef, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { CATEGORY_LABELS, catLabel, engine, get, interviewTitle, sessionCategories, type Session } from '../api'
import { ErrorBox, PageHead, Spinner, TalkingPoints, aiPoints, useAction, useLoad } from '../ui'
import { micPassedRecently, recognitionSupported, rememberMic } from '../voice'

const DIFFS = [['easy', 'Easy', 'A warm-up pace with clearer prompts.'], ['medium', 'Medium', 'Realistic pressure and small constraints.'], ['hard', 'Hard', 'Tight constraints and deeper follow-ups, in the same friendly tone.']] as const

type Ind = { id: string; name: string }
const GENERAL: Ind = { id: '', name: 'General' } // no industry: the server uses its neutral default scenario

export function MicCheck({ onPass, compact }: { onPass: () => void; compact?: boolean }) {
  const [s, setS] = useState({ perm: false, sound: false })
  const [err, setErr] = useState('')
  const [level, setLevel] = useState(0)
  const [testing, setTesting] = useState(false)
  // always release the microphone: on success, on timeout, on a new test and when the step closes
  const cleanup = useRef<() => void>(() => {})
  useEffect(() => () => cleanup.current(), [])
  const test = async () => {
    cleanup.current(); setErr(''); setTesting(true)
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      setS((x) => ({ ...x, perm: true }))
      const ctx = new AudioContext(); const an = ctx.createAnalyser(); ctx.createMediaStreamSource(stream).connect(an)
      const buf = new Uint8Array(an.frequencyBinCount); let n = 0
      let tick = 0, timeout = 0
      const stop = () => { clearInterval(tick); clearTimeout(timeout); stream.getTracks().forEach((tr) => tr.stop()); ctx.close().catch(() => {}); setLevel(0); setTesting(false); cleanup.current = () => {} }
      cleanup.current = stop
      tick = window.setInterval(() => {
        an.getByteTimeDomainData(buf); const v = Math.max(...buf) - 128; setLevel(Math.min(100, v * 2.5))
        if (v > 12 && ++n > 3) { stop(); setS({ perm: true, sound: true }); rememberMic(); onPass() }
      }, 120)
      timeout = window.setTimeout(() => { stop(); setErr('We did not hear anything for 15 seconds. Check that the right microphone is selected and not muted, then test again.') }, 15000)
    } catch { setTesting(false); setErr('We could not access your microphone. Allow access in your browser, then test again. You cannot start without a working mic.') }
  }
  const simulate = () => { cleanup.current(); setS({ perm: true, sound: true }); setErr(''); rememberMic(); onPass() }
  const C = ({ ok, label }: { ok: boolean; label: string }) => <div className={'check' + (ok ? ' ok' : '')}><i>{ok ? '✓' : ''}</i>{label}</div>
  return (
    <div className="stack">
      <div className="checklist">
        <C ok={s.perm} label="Microphone permission granted" />
        <C ok={s.sound} label="Sound detected: say a few words" />
        <C ok={recognitionSupported} label={recognitionSupported ? 'Speech-to-text works in this browser' : 'Speech-to-text is not available in this browser, so you would type your answers'} />
      </div>
      {!compact && <div className="meter lime" aria-hidden="true"><i style={{ width: `${level}%` }} /></div>}
      {err && <div className="err" role="alert">{err}</div>}
      <div className="row"><button className="btn" onClick={test} disabled={testing}>{testing ? 'Listening… say a few words' : 'Test microphone'}</button><button className="btn ghost" onClick={simulate}>Use simulated mic (prototype)</button></div>
    </div>
  )
}

const LEVELS = [['APM', 'Associate PM', 'Early career or career switch'], ['PM', 'Product Manager', 'Practising PM aiming for the next role']] as const
const STEPS = ['Level', 'Industry', 'Focus', 'Microphone', 'Confirm']
// canonical order, which is also the order the interviewer covers the areas in
const inOrder = (cats: string[]) => Object.keys(CATEGORY_LABELS).filter((c) => cats.includes(c))

export default function Setup() {
  const nav = useNavigate()
  const [params] = useSearchParams()
  // links from a report or the study plan can preselect focus areas (?categories=a,b or ?category=a)
  const linked = inOrder((params.get('categories') ?? params.get('category') ?? '').split(','))
  const [step, setStep] = useState(0)
  const [level, setLevel] = useState(() => (['APM', 'PM'].includes(params.get('level') ?? '') ? params.get('level')! : ''))
  const [industry, setIndustry] = useState(params.get('industry') || '')
  const [categories, setCategories] = useState<string[]>(linked)
  const [difficulty, setDifficulty] = useState('')
  const [micRemembered] = useState(micPassedRecently)
  const [mic, setMic] = useState(micRemembered)
  const [quick, setQuick] = useState(true)
  const [editing, setEditing] = useState(false) // changing one setting from the review step
  // "How do you use AI?" practice from the AI tools page: a behavioral interview that opens with that question
  const opening = params.get('question') === 'ai-usage' ? 'ai-usage' : ''
  const [points] = useState(() => (opening ? aiPoints.get() : []))
  const inds = useLoad(() => get<{ industries: Ind[] }>('/industries'))
  // returning users: prefill everything from their latest interview
  const hist = useLoad(() => get<{ interviews: Session[] }>('/interviews'))
  const last = hist.data?.interviews[0]
  const running = hist.data?.interviews.find((i) => i.status === 'in_progress')
  const endRunning = useAction(async () => { await engine({ action: 'end', id: running!.id, reason: 'user_ended' }); hist.reload() })
  useEffect(() => {
    if (!last) return
    setLevel((v) => v || last.level)
    setDifficulty((v) => v || last.difficulty)
    setCategories((v) => (v.length ? v : sessionCategories(last)))
    if (!params.has('industry')) setIndustry(last.industry || '')
  }, [last]) // eslint-disable-line react-hooks/exhaustive-deps
  const options = [GENERAL, ...(inds.data?.industries ?? [])]
  const industryName = options.find((x) => x.id === industry)?.name ?? industry
  // an unknown ?industry= falls back to General instead of failing at Start
  useEffect(() => { if (inds.data && industry && !inds.data.industries.some((x) => x.id === industry)) setIndustry('') }, [inds.data, industry])
  const toggleCategory = (c: string) => setCategories((cur) => inOrder(cur.includes(c) ? cur.filter((x) => x !== c) : [...cur, c]))
  const start = useAction(async () => { await engine({ action: 'start', level, categories, difficulty, industry: industry || undefined, opening: aiOpening ? opening : undefined }); nav('/interview/live', { replace: true, state: { fresh: true } }) })
  const ready = !!(level && categories.length && difficulty)
  const aiOpening = !!opening && categories.length === 1 && categories[0] === 'behavioral'
  // every setting, labelled, with the step that changes it
  const settings: [string, string, number][] = [
    ['Role', LEVELS.find((l) => l[0] === level)?.[1] ?? 'Not chosen', 0],
    ['Industry', industry ? industryName : 'General (no industry)', 1],
    [categories.length > 1 ? 'Focus areas' : 'Focus area', categories.length ? catLabel({ category: categories[0], categories }) : 'Not chosen', 2],
    ['Difficulty', difficulty ? difficulty.charAt(0).toUpperCase() + difficulty.slice(1) : 'Not chosen', 2],
    ...(aiOpening ? [['Opening question', 'How you use AI in your work', 2] as [string, string, number]] : []),
    ['Microphone', mic ? (micRemembered ? 'Checked on this device in the last 7 days' : 'Checked') : 'Not checked yet', 3],
  ]
  const editStep = (i: number) => { setEditing(true); setStep(i) }
  const settingsTable = (editable: boolean) => (
    <table className="t"><tbody>{settings.filter(([, , i]) => editable || i !== 3).map(([k, v, i]) => (
      <tr key={k}><th scope="row" style={{ width: 130 }}>{k}</th><td><b>{v}</b></td>
        {editable && <td style={{ textAlign: 'right' }}><button className="btn sm ghost" onClick={() => editStep(i)} aria-label={`Change ${k.toLowerCase()}`}>Change</button></td>}</tr>
    ))}</tbody></table>
  )
  const stepValid = !((step === 0 && !level) || (step === 2 && !(categories.length && difficulty)) || (step === 3 && !mic))
  const showQuick = quick && step === 0 && !!last && ready
  return (
    <>
      {aiOpening
        ? <PageHead title="Practise: “How do you use AI in your work?”" sub="A behavioral mock interview that opens with this question, then follows up on your answer like a real interviewer would. The clock starts only when you confirm." />
        : <PageHead title="Set up your interview" sub="Five quick steps. The clock starts only when you confirm." />}
      {!recognitionSupported && <div className="banner warn" role="note" style={{ marginBottom: 16, maxWidth: 760 }}><span><b>Voice answers need desktop Chrome or Edge.</b> This browser cannot turn your speech into text, so you would type your answers instead. For the full spoken interview, open ProManAI in Chrome or Edge on a computer.</span></div>}
      {running && (
        <div className="banner info" role="status" style={{ marginBottom: 16, maxWidth: 760 }}>
          <span><b>You already have an interview in progress</b> ({interviewTitle(running)}, {running.difficulty}). Resume it, or end it to start a new one.</span>
          <span className="row"><Link className="btn sm" to="/interview/live">Resume</Link><button className="btn sm ghost" disabled={endRunning.busy} onClick={() => endRunning.run()}>{endRunning.busy ? 'Ending…' : 'End it and get the report'}</button></span>
        </div>
      )}
      <ErrorBox error={endRunning.error} />
      {hist.loading ? <Spinner /> : showQuick ? (
        <section className="card stack" style={{ maxWidth: 760 }}>
          <h2>{aiOpening ? 'Your practice interview' : linked.length ? 'Your next interview' : 'Same as last time?'}</h2>
          {settingsTable(false)}
          {aiOpening && points.length > 0 && <div className="stack" style={{ gap: 6 }}><b className="small">Your talking points</b><div className="small"><TalkingPoints points={points} /></div><p className="small muted">You can open them during the interview if you get stuck.</p></div>}
          <p className="small muted">{mic ? 'Your microphone passed a check on this device in the last 7 days, so you can go straight to the final check.' : 'You will check your microphone before you start.'}</p>
          <div className="row"><button className="btn lime lg" onClick={() => setStep(mic ? 4 : 3)}>{mic ? 'Review and start' : 'Use these settings'}</button><button className="btn ghost" onClick={() => setQuick(false)}>Change settings</button></div>
        </section>
      ) : (<>
        <div className="stepper">{STEPS.map((s, i) => i < step
          ? <button key={s} className="step done" onClick={() => (step === 4 ? editStep(i) : setStep(i))} aria-label={`Change ${s.toLowerCase()}`}><i>✓</i>{s}</button>
          : <div key={s} className={'step' + (i === step ? ' on' : '')} aria-current={i === step ? 'step' : undefined}><i>{i + 1}</i>{s}</div>)}</div>
        <div className="card stack lg" style={{ maxWidth: 760 }}>
          {step === 0 && (<>
            <h2>Which role are you practising for?</h2>
            <div className="grid2">{LEVELS.map(([v, t, d]) => <button key={v} aria-pressed={level === v} className={'choice' + (level === v ? ' on' : '')} onClick={() => setLevel(v)}><b>{t}</b><span className="muted">{d}</span></button>)}</div>
          </>)}
          {step === 1 && (<>
            <h2>Which industry should the interview be set in?</h2>
            <p className="muted">Optional. The interviewer sets every question inside this world: its users, its metrics and its trade-offs.</p>
            {inds.loading && <Spinner />}
            <ErrorBox error={inds.error} onRetry={inds.reload} />
            <div className="ind-grid" role="radiogroup" aria-label="Industry">{options.map((i) => <button key={i.id || 'general'} role="radio" aria-checked={industry === i.id} className={'choice' + (industry === i.id ? ' on' : '')} onClick={() => setIndustry(i.id)}><b>{i.name}</b></button>)}</div>
          </>)}
          {step === 2 && (<>
            <h2>What do you want to practise?</h2>
            <p className="muted">Pick one or more. With more than one, the 20 minutes are shared and the interviewer covers them in the order shown.</p>
            <div className="grid3">{Object.entries(CATEGORY_LABELS).map(([v, t]) => <button key={v} aria-pressed={categories.includes(v)} className={'choice' + (categories.includes(v) ? ' on' : '')} onClick={() => toggleCategory(v)}><b>{t}</b></button>)}</div>
            <h3>Difficulty</h3>
            <div className="grid3">{DIFFS.map(([v, t, d]) => <button key={v} aria-pressed={difficulty === v} className={'choice' + (difficulty === v ? ' on' : '')} onClick={() => setDifficulty(v)}><b>{t}</b><span className="muted small">{d}</span></button>)}</div>
          </>)}
          {step === 3 && (<>
            <h2>Check your microphone</h2>
            <p className="muted">This is a voice interview, so a working mic is required.{micRemembered && ' Your mic passed a check on this device in the last 7 days, so you can continue or test again.'}</p>
            <MicCheck onPass={() => setMic(true)} />
          </>)}
          {step === 4 && (<>
            <h2>Review and start</h2>
            {settingsTable(true)}
            {aiOpening && points.length > 0 && <details><summary className="small">Your talking points</summary><div className="small" style={{ marginTop: 8 }}><TalkingPoints points={points} /></div></details>}
            <ul className="list-plain"><li>20 minutes. The timer runs on our server, so refreshing will not reset it.</li><li>You can skip up to 2 questions. Nothing auto-submits.</li></ul>
            <p className="small muted">Practice only: the AI's questions and scores can be wrong and do not predict real interview results. Do not share confidential information from a current or past employer. <Link to="/disclaimer">Read the disclaimer</Link></p>
            <ErrorBox error={start.error} />
            {(start.error as any)?.code === 'already_running' && <Link className="btn ghost" to="/interview/live" style={{ justifySelf: 'start' }}>Go to the running interview</Link>}
          </>)}
          <div className="row between">
            <button className="btn ghost" disabled={step === 0} onClick={() => setStep(step - 1)}>Back</button>
            {step < 4 ? (editing
              ? <button className="btn" disabled={!stepValid || !ready || !mic} onClick={() => { setEditing(false); setStep(4) }}>Back to review</button>
              : <button className="btn" disabled={!stepValid} onClick={() => setStep(step + 1)}>Continue</button>)
              : <button className="btn lime lg" disabled={start.busy || !ready || !!running} title={running ? 'End or resume your current interview first' : undefined} onClick={() => start.run()}>{start.busy ? 'Preparing your question…' : 'Start interview'}</button>}
          </div>
        </div>
      </>)}
    </>
  )
}
