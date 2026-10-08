import { useRef, useState } from 'react'
import { post } from '../api'
import { ErrorBox, PageHead, Spinner, useAction } from '../ui'
import { speak, useRecognizer } from '../voice'
import { MicCheck } from './Setup'

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
          <button className="btn ghost" style={{ justifySelf: 'start' }} onClick={() => speak('This is how your interviewer will sound. Can you hear me clearly?')}>Play sample question</button>
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
