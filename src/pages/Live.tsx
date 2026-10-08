import { useCallback, useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { ApiError, CATEGORY_LABELS, engine, type Msg, type Session } from '../api'
import { ErrorBox, Modal, Spinner } from '../ui'
import { SAMPLE_ANSWERS, speak, stopSpeaking, useRecognizer } from '../voice'

const mmss = (ms: number) => { const s = Math.ceil(ms / 1000); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}` }
const MAX_SKIPS = 2

export default function Live() {
  const nav = useNavigate()
  const loc = useLocation()
  const [fresh] = useState(() => !!(loc.state as { fresh?: boolean } | null)?.fresh) // only true right after Start, not after a refresh
  const [boot, setBoot] = useState<'loading' | 'prompt' | 'ready'>('loading')
  const [session, setSession] = useState<Session | null>(null)
  const [msgs, setMsgs] = useState<Msg[]>([])
  const [text, setText] = useState('')
  const [phase, setPhase] = useState<'idle' | 'analyzing' | 'preparing'>('idle')
  const [error, setError] = useState<unknown>(null)
  const [remaining, setRemaining] = useState(20 * 60 * 1000)
  const [offline, setOffline] = useState(!navigator.onLine)
  const [serverDown, setServerDown] = useState(false)
  const [confirmEnd, setConfirmEnd] = useState(false)
  const [silent, setSilent] = useState(false)
  const textRef = useRef(text); textRef.current = text
  const lastActive = useRef(Date.now())
  const convoRef = useRef<HTMLDivElement>(null)
  const ending = useRef(false)
  const sessionId = session?.id
  const touch = () => { lastActive.current = Date.now(); setSilent(false) }

  const rec = useRecognizer(useCallback((t: string) => { setText(t); touch() }, []), useCallback(() => textRef.current, []))

  const applyServer = useCallback((s: Session, m?: Msg[]) => { setSession(s); setRemaining(s.timer_remaining_ms); if (m) setMsgs(m) }, [])

  const finish = useCallback(async (reason: 'user_ended' | 'time_up') => {
    if (ending.current || !sessionId) return
    ending.current = true; stopSpeaking(); rec.stop()
    try { await engine({ action: 'end', id: sessionId, reason }) } catch (e) { if ((e as ApiError).code !== 'not_running') { ending.current = false; setError(e); return } }
    nav(`/history/${sessionId}`, { replace: true })
  }, [sessionId, nav, rec])

  // boot: find the running interview
  useEffect(() => {
    engine<{ active: Session | null }>({ action: 'status' }).then(async (r) => {
      if (!r.active) { nav('/interview/setup', { replace: true }); return }
      if (fresh) {
        nav('/interview/live', { replace: true, state: {} })
        const x = await engine({ action: 'resume', id: r.active.id })
        applyServer(x.session, x.messages); setBoot('ready')
        const q = [...x.messages].reverse().find((m: Msg) => m.role === 'interviewer'); q && speak(q.content)
      } else { setSession(r.active); setRemaining(r.active.timer_remaining_ms); setBoot('prompt') }
    }).catch((e) => { setError(e); setBoot('ready') })
    return () => { stopSpeaking() }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const resume = async () => {
    try { const x = await engine({ action: 'resume', id: session!.id }); applyServer(x.session, x.messages); setBoot('ready'); touch() } catch (e) { setError(e) }
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
      try { const x = await engine({ action: 'heartbeat', id: sessionId }); setServerDown(false); setRemaining(x.session.timer_remaining_ms); if (x.session.status !== 'in_progress') nav(`/history/${sessionId}`, { replace: true }) }
      catch (e) { const c = (e as ApiError).code; if (c === 'network') setServerDown(true); else if (c === 'not_running') nav(`/history/${sessionId}`, { replace: true }) }
    }
    const t = setInterval(beat, 10_000)
    window.addEventListener('online', beat)
    return () => { clearInterval(t); window.removeEventListener('online', beat) }
  }, [boot, sessionId, nav])

  useEffect(() => { convoRef.current?.scrollTo({ top: convoRef.current.scrollHeight, behavior: 'smooth' }) }, [msgs.length, phase])

  const lastIsAnswer = msgs.at(-1)?.role === 'candidate'
  const lastQuestion = [...msgs].reverse().find((m) => m.role === 'interviewer')

  const getNext = async () => {
    setPhase('preparing'); setError(null)
    try {
      const x = await engine({ action: 'next_question', id: sessionId })
      applyServer(x.session); setMsgs((m) => [...m, x.message]); speak(x.message.content); touch()
    } catch (e) { setError(e) } finally { setPhase('idle') }
  }
  const submit = async () => {
    if (!text.trim()) return
    rec.stop(); stopSpeaking(); setPhase('analyzing'); setError(null)
    try {
      const x = await engine({ action: 'submit_answer', id: sessionId, text })
      applyServer(x.session); setMsgs((m) => [...m, x.message]); setText('')
    } catch (e) { setError(e); setPhase('idle'); return }
    await getNext()
  }
  const skip = async () => {
    setPhase('preparing'); setError(null); stopSpeaking()
    try {
      const x = await engine({ action: 'skip', id: sessionId })
      applyServer(x.session); setMsgs((m) => [...m.slice(0, -1), { ...m[m.length - 1], skipped: true }, x.message]); speak(x.message.content); touch()
    } catch (e) { setError(e) } finally { setPhase('idle') }
  }
  const sample = () => {
    const pool = SAMPLE_ANSWERS[session!.category]; const n = msgs.filter((m) => m.role === 'candidate').length
    setText(pool[n % pool.length]); touch()
  }

  if (boot === 'loading') return <div style={{ padding: 40 }}>{error ? <ErrorBox error={error} /> : <Spinner />}</div>
  if (boot === 'prompt' && session) return (
    <Modal title="You have an interview in progress" onClose={() => {}}>
      <p>{CATEGORY_LABELS[session.category]}, {session.difficulty}. Time left: <b>{mmss(session.timer_remaining_ms)}</b>. Time spent away is not charged beyond a short gap.</p>
      <ErrorBox error={error} />
      <div className="row"><button className="btn" onClick={resume}>Resume</button><button className="btn ghost" onClick={() => nav('/dashboard')}>Back to dashboard</button></div>
    </Modal>
  )
  if (!session) return null
  const busy = phase !== 'idle'
  return (
    <div className="stack">
      {(offline || serverDown) && <div className="banner off" role="alert"><span><b>{offline ? 'You are offline.' : 'We lost the connection.'}</b> Your timer is paused. It will sync when you reconnect.</span></div>}
      {silent && <div className="banner info" role="status"><span>Still there? Take your time. You can use Replay to hear the question again.</span><button className="btn sm" onClick={touch}>I am here</button></div>}
      <div className="live">
        <aside className="stage" aria-label="Interview controls">
          <div><div className="lbl">Time left</div><div className={'clock' + (remaining < 60_000 ? ' low' : '')} aria-live="off">{mmss(remaining)}</div></div>
          <div className="lbl">Skips left: <b style={{ color: '#fff' }}>{MAX_SKIPS - session.skips_used}</b> of {MAX_SKIPS}</div>
          <div className="stack" style={{ gap: 8 }}>
            <button className="btn ghost" onClick={() => lastQuestion && speak(lastQuestion.content)} disabled={!lastQuestion}>Replay question</button>
            <button className="btn ghost" onClick={skip} disabled={busy || session.skips_used >= MAX_SKIPS || lastIsAnswer}>Skip question</button>
            <button className="btn ghost" onClick={() => setConfirmEnd(true)}>End interview</button>
          </div>
        </aside>
        <section className="stack">
          <div className="row"><span className="pill lime">{CATEGORY_LABELS[session.category]}</span><span className="pill">{session.level}</span><span className="pill">{session.difficulty}</span>{session.industry && <span className="pill line">{session.industry}</span>}</div>
          <div className="card stack">
            <div className="convo" ref={convoRef} aria-live="polite">
              {msgs.map((m) => <div key={m.seq} className={`msg ${m.role}${m.skipped ? ' skipped' : ''}`}><small>{m.role === 'interviewer' ? 'Interviewer' : 'You'}</small>{m.content}</div>)}
              {phase === 'analyzing' && <div className="row muted"><Spinner /> Analyzing your answer…</div>}
              {phase === 'preparing' && <div className="row muted"><Spinner /> Preparing your question…</div>}
            </div>
          </div>
          <ErrorBox error={error} onRetry={lastIsAnswer && sessionId ? getNext : undefined} />
          {lastIsAnswer && !busy && !error && <div className="banner info"><span>Your answer is saved. The next question has not loaded yet.</span><button className="btn sm" onClick={getNext}>Get next question</button></div>}
          <div className="card stack">
            <label className="field" htmlFor="ans">Your answer <span className="muted small" style={{ fontWeight: 400 }}>Speak, then edit anything the mic got wrong</span></label>
            <textarea id="ans" value={text} onChange={(e) => { setText(e.target.value); touch() }} placeholder={rec.listening ? 'Listening…' : 'Press Start speaking and answer out loud.'} disabled={busy || lastIsAnswer} rows={5} />
            {rec.error && <div className="err" role="alert">{rec.error}</div>}
            <div className="row between">
              <div className="row">
                <button className={'mic-btn' + (rec.listening ? ' rec' : '')} onClick={() => (rec.listening ? rec.stop() : rec.start())} disabled={busy || lastIsAnswer || !rec.supported} aria-label={rec.listening ? 'Stop speaking' : 'Start speaking'}>{rec.listening ? '■' : '●'}</button>
                <span className="small">{rec.listening ? 'Stop speaking' : 'Start speaking'}</span>
                <button className="btn ghost sm" onClick={sample} disabled={busy || lastIsAnswer}>Fill sample answer (prototype)</button>
              </div>
              <button className="btn lg" onClick={submit} disabled={busy || !text.trim() || lastIsAnswer}>{phase === 'analyzing' ? 'Submitting…' : 'Submit answer'}</button>
            </div>
            {!rec.supported && <p className="small muted">Speech recognition needs desktop Chrome or Edge. In this prototype you can use the sample answer button instead.</p>}
          </div>
        </section>
      </div>
      {confirmEnd && (
        <Modal title="End the interview now?" onClose={() => setConfirmEnd(false)}>
          <p>Your answers so far will be scored. You cannot come back to this interview.</p>
          <div className="row"><button className="btn danger" onClick={() => finish('user_ended')}>End and get report</button><button className="btn ghost" onClick={() => setConfirmEnd(false)}>Keep going</button></div>
        </Modal>
      )}
    </div>
  )
}
