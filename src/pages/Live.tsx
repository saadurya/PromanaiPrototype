import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { ApiError, CATEGORY_LABELS, engine, interviewTitle, sessionCategories, type Msg, type Session } from '../api'
import { ErrorBox, Modal, Spinner, TalkingPoints, aiPoints } from '../ui'
import { SAMPLE_ANSWERS, speak, stopSpeaking, useRecognizer } from '../voice'

const mmss = (ms: number) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }
const MAX_SKIPS = 2
const MAX_CLARIFY = 4
const isQuestion = (m: Msg) => m.role === 'interviewer' && m.kind !== 'clarify'
const lastQuestionOf = (ms: Msg[]) => [...ms].reverse().find(isQuestion)
// an unsubmitted answer survives a refresh or "Leave for now" (this device only)
const draftKey = (id: string) => `pm_draft_${id}`
const saveDraft = (id: string, t: string) => { try { if (t) localStorage.setItem(draftKey(id), t); else localStorage.removeItem(draftKey(id)) } catch { /* private mode */ } }
const loadDraft = (id: string) => { try { return localStorage.getItem(draftKey(id)) || '' } catch { return '' } }
type Result = { session: Session; message?: Msg; messages?: Msg[]; ended?: boolean }

export default function Live() {
  const nav = useNavigate()
  const loc = useLocation()
  const freshRef = useRef(!!(loc.state as { fresh?: boolean } | null)?.fresh) // only true right after Start, not after a refresh
  const [boot, setBoot] = useState<'loading' | 'prompt' | 'ready' | 'error'>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'preparing' | 'clarifying'>('idle')
  const [error, setError] = useState<unknown>(null)
  const [endError, setEndError] = useState<unknown>(null)
  const [ending, setEnding] = useState(false)
  const [remaining, setRemaining] = useState(20 * 60 * 1000)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [serverDown, setServerDown] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [promptEnd, setPromptEnd] = useState(false)
  const [silent, setSilent] = useState(false)
  const [points] = useState(aiPoints.get)
  const textRef = useRef(text); textRef.current = text
  const lastActive = useRef(Date.now())
  const convoRef = useRef<HTMLDivElement>(null)
  const endingRef = useRef(false)
  const sessionId = session?.id
  const touch = () => { lastActive.current = Date.now(); setSilent(false) }

  const rec = useRecognizer(useCallback((t: string) => { setText(t); touch() }, []), useCallback(() => textRef.current, []))
  const recStop = rec.stop // stable, unlike the `rec` object, so effects depending on it do not re-run every render

  const applyServer = useCallback((s: Session, m?: Msg[]) => { setSession(s); setRemaining(s.timer_remaining_ms); if (m) setMsgs(m) }, [])
  const toReport = useCallback((id: string) => { saveDraft(id, ''); nav(`/history/${id}`, { replace: true }) }, [nav])

  const finish = useCallback(async (reason: 'user_ended' | 'time_up') => {
    if (endingRef.current || !sessionId) return
    endingRef.current = true; setEnding(true); setEndError(null); stopSpeaking(); recStop()
    try { await engine({ action: 'end', id: sessionId, reason }) } catch (e) {
      // no automatic retry: the user sees the error and can try again
      if ((e as ApiError).code !== 'not_running') { endingRef.current = false; setEnding(false); setEndError(e); return }
    }
    toReport(sessionId)
  }, [sessionId, recStop, toReport])

  const enter = (x: Result) => {
    applyServer(x.session, x.messages)
    setText((t) => t || loadDraft(x.session.id))
    setBoot('ready'); touch()
    const q = x.messages && lastQuestionOf(x.messages); if (q) speak(q.content)
  }

  // boot: find the running interview
  const bootUp = useCallback(async () => {
    setBoot('loading'); setError(null)
    try {
      const r = await engine<{ active: Session | null }>({ action: 'status' })
      if (!r.active) { nav('/interview/setup', { replace: true }); return }
      if (freshRef.current) {
        freshRef.current = false
        nav('/interview/live', { replace: true, state: {} })
        enter(await engine<Result>({ action: 'resume', id: r.active.id }))
      } else { setSession(r.active); setRemaining(r.active.timer_remaining_ms); setBoot('prompt') }
    } catch (e) { setError(e); setBoot('error') }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => { bootUp(); return () => { stopSpeaking() } }, [bootUp])

  const resume = async () => {
    try { enter(await engine<Result>({ action: 'resume', id: session!.id })) } catch (e) { setError(e) }
  }

  // online/offline
  useEffect(() => {
    const on = () => setOffline(false), off = () => setOffline(true)
    window.addEventListener('online', on); window.addEventListener('offline', off)
    return () => { window.removeEventListener('online', on); window.removeEventListener('offline', off) }
  }, [])

  // display countdown (server is the source of truth; paused while offline) + silence check-in
  useEffect(() => {
    if (boot !== 'ready') return
    const t = setInterval(() => {
      if (!(offline || serverDown)) setRemaining((r) => Math.max(0, r - 250))
      if (Date.now() - lastActive.current > 90_000 && phase === 'idle') setSilent(true)
    }, 250)
    return () => clearInterval(t)
  }, [boot, offline, serverDown, phase])
  useEffect(() => { if (boot === 'ready' && remaining <= 0) finish('time_up') }, [remaining, boot, finish])

  // heartbeat: re-syncs the clock from the server and resumes after reconnect
  useEffect(() => {
    if (boot !== 'ready' || !sessionId) return
    const beat = async () => {
      if (!navigator.onLine) return
      try { const x = await engine<Result>({ action: 'heartbeat', id: sessionId }); setServerDown(false); setRemaining(x.session.timer_remaining_ms); if (x.session.status !== 'in_progress') toReport(sessionId) }
      catch (e) { const c = (e as ApiError).code; if (c === 'network') setServerDown(true); else if (c === 'not_running') toReport(sessionId) }
    }
    const t = setInterval(beat, 10_000)
    window.addEventListener('online', beat)
    return () => { clearInterval(t); window.removeEventListener('online', beat) }
  }, [boot, sessionId, toReport])

  // keep the unsubmitted answer on this device
  useEffect(() => { if (sessionId && boot === 'ready') saveDraft(sessionId, text) }, [text, sessionId, boot])

  useEffect(() => { convoRef.current?.scrollTo({ top: convoRef.current.scrollHeight, behavior: 'smooth' }) }, [msgs.length, phase])

  const lastIsAnswer = msgs.at(-1)?.role === 'candidate'
  const lastQuestion = lastQuestionOf(msgs)
  // the interview ended on the server (for example the clock ran out): go to the report instead of breaking
  const fail = (e: unknown) => { if ((e as ApiError).code === 'not_running' && sessionId) toReport(sessionId); else setError(e) }

  const getNext = async () => {
    setPhase('preparing'); setError(null)
    try {
      const x = await engine<Result>({ action: 'next_question', id: sessionId })
      if (x.ended || !x.message) { toReport(sessionId!); return }
      applyServer(x.session); setMsgs((m) => [...m, x.message!]); speak(x.message.content); touch()
    } catch (e) { fail(e) } finally { setPhase('idle') }
  }
  const submit = async () => {
    if (!text.trim() || !sessionId) return
    recStop(); stopSpeaking(); setPhase('analyzing'); setError(null)
    try {
      const x = await engine<Result>({ action: 'submit_answer', id: sessionId, text })
      setText(''); saveDraft(sessionId, '')
      if (x.ended) { toReport(sessionId); return } // the answer was saved before the clock ran out
      applyServer(x.session); setMsgs((m) => [...m, x.message!])
    } catch (e) { fail(e); setPhase('idle'); return }
    await getNext()
  }
  const clarify = async () => {
    if (!text.trim() || !sessionId) return
    recStop(); stopSpeaking(); setPhase('clarifying'); setError(null)
    try {
      const x = await engine<Result>({ action: 'clarify', id: sessionId, text })
      if (x.ended || !x.messages) { toReport(sessionId); return }
      applyServer(x.session); setMsgs((m) => [...m, ...x.messages!]); setText(''); saveDraft(sessionId, '')
      speak(x.messages[1].content); touch()
    } catch (e) { fail(e) } finally { setPhase('idle') }
  }
  const skip = async () => {
    setPhase('preparing'); setError(null); stopSpeaking()
    try {
      const x = await engine<Result>({ action: 'skip', id: sessionId })
      if (x.ended || !x.message) { toReport(sessionId!); return }
      applyServer(x.session)
      setMsgs((m) => { const q = lastQuestionOf(m); return [...m.map((y) => (y === q ? { ...y, skipped: true } : y)), x.message!] })
      speak(x.message.content); touch()
    } catch (e) { fail(e) } finally { setPhase('idle') }
  }
  const sample = () => {
    const pool = SAMPLE_ANSWERS[session!.current_category ?? session!.category]; const n = msgs.filter((m) => m.role === 'candidate' && m.kind !== 'clarify').length
    setText(pool[n % pool.length]); touch()
  }

  if (boot === 'loading') return <div style={{ padding: 40 }}><Spinner /></div>
  if (boot === 'error') return (
    <section className="card stack" style={{ maxWidth: 560 }}>
      <h2>We could not load your interview</h2>
      <p className="muted">Your interview and answers are saved on the server. Try again, or come back from the dashboard.</p>
      <ErrorBox error={error} />
      <div className="row"><button className="btn" onClick={bootUp}>Try again</button><Link className="btn ghost" to="/dashboard">Back to dashboard</Link></div>
    </section>
  )
  if (boot === 'prompt' && session) return (
    <Modal title={promptEnd ? 'End this interview?' : 'You have an interview in progress'} onClose={() => {}}>
      {promptEnd ? <p>Your answers so far will be scored. You cannot come back to this interview.</p>
        : <p>{interviewTitle(session)}, {session.difficulty}. Time left: <b>{mmss(session.timer_remaining_ms)}</b>. Time spent away is not charged beyond a short gap.</p>}
      <ErrorBox error={error ?? endError} />
      {promptEnd
        ? <div className="row"><button className="btn danger" disabled={ending} onClick={() => finish('user_ended')}>{ending ? 'Ending…' : 'End and get report'}</button><button className="btn ghost" onClick={() => setPromptEnd(false)}>Back</button></div>
        : <div className="row"><button className="btn" onClick={resume}>Resume</button><button className="btn ghost" onClick={() => setPromptEnd(true)}>End this interview</button><button className="btn ghost" onClick={() => nav('/dashboard')}>Back to dashboard</button></div>}
    </Modal>
  )
  if (!session) return null
  const busy = phase !== 'idle' || ending
  const clarifyLeft = MAX_CLARIFY - (session.clarifications ?? 0)
  const label = (m: Msg) => (m.role === 'interviewer' ? (m.kind === 'clarify' ? 'Interviewer · clarification' : 'Interviewer') : m.kind === 'clarify' ? 'You · clarifying question' : 'You')
  return (
    <div className="stack">
      {(offline || serverDown) && <div className="banner off" role="alert"><span><b>{offline ? 'You are offline.' : 'We lost the connection.'}</b> Your timer is paused. It will sync when you reconnect.</span></div>}
      {remaining > 0 && remaining <= 60_000 && <div className="banner warn" role="alert"><span><b>1 minute left.</b> Submit your answer now: text you have not submitted is not scored.</span></div>}
      {!!endError && !confirmEnd && <div className="banner warn" role="alert"><span><b>We could not end the interview.</b> {(endError as ApiError).message}</span><button className="btn sm" disabled={ending} onClick={() => finish(remaining <= 0 ? 'time_up' : 'user_ended')}>Try again</button></div>}
      {silent && <div className="banner info" role="status"><span>Still there? Take your time. You can use Replay to hear the question again.</span><button className="btn sm" onClick={touch}>I am here</button></div>}
      <div className="live">
        <aside className="stage" aria-label="Interview controls">
          <div><div className="lbl">Time left</div><div className={'clock' + (remaining < 60_000 ? ' low' : '')} aria-live="off">{mmss(remaining)}</div></div>
          <div className="lbl">Skips left: <b style={{ color: '#fff' }}>{MAX_SKIPS - session.skips_used}</b> of {MAX_SKIPS}</div>
          <div className="stack" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => lastQuestion && speak(lastQuestion.content)} disabled={!lastQuestion}>Replay question</button>
            <button className="btn ghost" onClick={skip} disabled={busy || session.skips_used >= MAX_SKIPS || lastIsAnswer}>Skip question</button>
            <button className="btn ghost" onClick={() => setConfirmEnd(true)} disabled={ending}>End interview</button>
          </div>
        </aside>
        <section className="stack">
          <div className="row">{sessionCategories(session).map((c) => <span key={c} className={'pill' + (c === (session.current_category ?? session.category) ? ' lime' : '')}>{CATEGORY_LABELS[c]}</span>)}<span className="pill">{session.level}</span><span className="pill">{session.difficulty}</span>{session.opening === 'ai-usage' && <span className="pill line">AI question practice</span>}{session.industry && <span className="pill line">{session.industry_name ?? session.industry}</span>}</div>
          <div className="card stack">
            <div className="convo" ref={convoRef} aria-live="polite">
              {msgs.map((m) => <div key={m.seq} className={`msg ${m.role}${m.skipped ? ' skipped' : ''}${m.kind === 'clarify' ? ' clarify' : ''}`}><small>{label(m)}</small>{m.content}</div>)}
              {phase === 'analyzing' && <div className="row muted"><Spinner /> Analyzing your answer…</div>}
              {phase === 'preparing' && <div className="row muted"><Spinner /> Preparing your question…</div>}
              {phase === 'clarifying' && <div className="row muted"><Spinner /> The interviewer is answering…</div>}
            </div>
          </div>
          <ErrorBox error={error} onRetry={lastIsAnswer && sessionId ? getNext : undefined} />
          {lastIsAnswer && !busy && !error && <div className="banner info"><span>Your answer is saved. The next question has not loaded yet.</span><button className="btn sm" onClick={getNext}>Get next question</button></div>}
          <div className="card stack">
            <label className="field" htmlFor="ans">Your answer <span className="muted small" style={{ fontWeight: 400 }}>Speak, then edit anything the mic got wrong. Not ready to answer? Ask a clarifying question first; it is not scored.</span></label>
            <textarea id="ans" value={text} onChange={(e) => { setText(e.target.value); touch() }} placeholder={rec.listening ? 'Listening…' : 'Press Start speaking and answer out loud.'} disabled={busy || lastIsAnswer} rows={5} />
            {rec.error && <div className="err" role="alert">{rec.error}</div>}
            <div className="row between">
              <div className="row">
                <button className={'mic-btn' + (rec.listening ? ' rec' : '')} onClick={() => (rec.listening ? rec.stop() : rec.start())} disabled={busy || lastIsAnswer || !rec.supported} aria-label={rec.listening ? 'Stop speaking' : 'Start speaking'}>{rec.listening ? '■' : '●'}</button>
                <span className="small">{rec.listening ? 'Stop speaking' : 'Start speaking'}</span>
                <button className="btn ghost sm" onClick={sample} disabled={busy || lastIsAnswer}>Fill sample answer (prototype)</button>
              </div>
              <div className="row">
                <button className="btn ghost" onClick={clarify} disabled={busy || !text.trim() || lastIsAnswer || clarifyLeft <= 0} title="Ask the interviewer to clarify. It is not scored.">{clarifyLeft > 0 ? `Ask as a clarifying question (${clarifyLeft} left)` : 'No clarifying questions left'}</button>
                <button className="btn lg" onClick={submit} disabled={busy || !text.trim() || lastIsAnswer}>{phase === 'analyzing' ? 'Submitting…' : 'Submit answer'}</button>
              </div>
            </div>
            {session.opening === 'ai-usage' && points.length > 0 && <details><summary className="small">My talking points (hidden, so it still feels like a real interview)</summary><div className="small" style={{ marginTop: 8 }}><TalkingPoints points={points} /></div></details>}
            {!rec.supported && <p className="small muted">Speech recognition needs desktop Chrome or Edge. In this prototype you can use the sample answer button instead.</p>}
          </div>
        </section>
      </div>
      {confirmEnd && (
        <Modal title="End the interview now?" onClose={() => !ending && setConfirmEnd(false)}>
          <p>Your answers so far will be scored. You cannot come back to this interview.</p>
          <ErrorBox error={endError} />
          <div className="row"><button className="btn danger" disabled={ending} onClick={() => finish('user_ended')}>{ending ? 'Ending…' : 'End and get report'}</button><button className="btn ghost" disabled={ending} onClick={() => setConfirmEnd(false)}>Keep going</button></div>
        </Modal>
      )}
    </div>
  )
}
