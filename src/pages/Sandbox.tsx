import { useEffect, useRef, useState } from 'react'
import { post } from '../api'
import { ErrorBox, PageHead, Spinner, useAction } from '../ui'
import { isNaturalVoice, onVoiceFallback, speak, useRecognizer, useVoices } from '../voice'
import { MicCheck } from './Setup'

const SAMPLE_LINE = 'Hi, thanks for joining. Tell me about a product you love, and one thing you would change about it.'

// Choose how the interviewer sounds; remembered on this device
export function VoicePicker() {
  const { voices, selected, choose, supported } = useVoices()
  const [notice, setNotice] = useState('')
  useEffect(() => onVoiceFallback(setNotice), [])
  if (!supported) return <p className="small muted">This browser cannot read questions aloud. Questions are always shown as text as well.</p>
  if (!voices.length) return <p className="small muted">Loading voices…</p>
  const hasNatural = voices.some(isNaturalVoice)
  return (
    <div className="stack" style={{ gap: 8 }}>
      <label className="field">Interviewer voice
        <select value={selected} onChange={(e) => { setNotice(''); choose(e.target.value); speak(SAMPLE_LINE) }}>
          {voices.map((v) => <option key={v.name} value={v.name}>{v.name}{isNaturalVoice(v) ? ' · natural' : ''}</option>)}
        </select>
      </label>
      <div className="row">
        <button className="btn ghost sm" onClick={() => speak(SAMPLE_LINE)}>Play sample</button>
        <span className="small muted">{hasNatural ? 'Voices marked “natural” sound the most human. They stream online, so they need an internet connection and may not work in private windows.' : 'This browser only has basic voices. Edge and Chrome offer more natural ones.'}</span>
      </div>
      {notice && <div className="banner warn" role="status"><span>{notice}</span></div>}
      <p className="small muted">Still silent? Check that this tab is not muted and your system volume is up.</p>
    </div>
  )
}

export function VoiceTest() {
  const [text, setText] = useState('')
  const ref = useRef(text); ref.current = text
  const rec = useRecognizer(setText, () => ref.current)
  return (
    <>
      <PageHead title="Voice test" sub="A sandbox for your mic and speakers. Nothing here is saved or scored." />
      <div className="grid2">
        <section className="card stack"><h2>Microphone</h2><MicCheck onPass={() => {}} /></section>
        <section className="card stack"><h2>Speech and playback</h2>
          <VoicePicker />
          <textarea value={text} onChange={(e) => setText(e.target.value)} placeholder="Press Start speaking and say a sentence." />
          {rec.error && <div className="err" role="alert">{rec.error}</div>}
          <div className="row"><button className="btn" onClick={() => (rec.listening ? rec.stop() : rec.start())}>{rec.listening ? 'Stop speaking' : 'Start speaking'}</button><button className="btn ghost" onClick={() => setText('This is a simulated sentence for the prototype.')}>Fill sample text (prototype)</button></div>
          {!rec.supported && <p className="small muted">Speech recognition needs desktop Chrome or Edge.</p>}
        </section>
      </div>
    </>
  )
}

export function AiTest() {
  const [q, setQ] = useState('')
  const [a, setA] = useState('')
  const [follow, setFollow] = useState('')
  const [evalr, setEvalr] = useState<{ score: number; note: string } | null>(null)
  const open = useAction(async () => { const r = await post('/interview-ai', { action: 'opening' }); setQ(r.text); setFollow(''); setEvalr(null) })
  const fu = useAction(async () => { const r = await post('/interview-ai', { action: 'followup', answer: a }); setFollow(r.text) })
  const ev = useAction(async () => { const r = await post('/interview-ai', { action: 'evaluate', answer: a }); setEvalr(r) })
  return (
    <>
      <PageHead title="AI test" sub="One question, one answer, one follow-up and a test evaluation. Nothing is saved." />
      <div className="card stack" style={{ maxWidth: 720 }}>
        <div className="row"><button className="btn" onClick={() => open.run()} disabled={open.busy}>{q ? 'New opening question' : 'Get an opening question'}</button>{open.busy && <Spinner />}</div>
        {q && <div className="msg interviewer">{q}</div>}
        {q && <textarea value={a} onChange={(e) => setA(e.target.value)} placeholder="Type a short answer to test the AI." />}
        {q && <div className="row"><button className="btn ghost" disabled={!a.trim() || fu.busy} onClick={() => fu.run()}>Get follow-up</button><button className="btn ghost" disabled={!a.trim() || ev.busy} onClick={() => ev.run()}>Test evaluation</button></div>}
        {follow && <div className="msg interviewer">{follow}</div>}
        {evalr && <div className="banner info"><span><b>Test score {evalr.score}/5.</b> {evalr.note}</span></div>}
        <ErrorBox error={open.error ?? fu.error ?? ev.error} />
      </div>
    </>
  )
}
