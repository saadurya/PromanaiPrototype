import { useMemo, useState } from 'react'
import { get, post } from '../api'
import { Empty, ErrorBox, Modal, PageHead, Spinner, Stars, useAction, useLoad } from '../ui'

type Turn = { speaker: 'interviewer' | 'candidate'; text: string; note?: string }
type Review = { rating: number; verdict: string; comment: string; reviewer: { name: string; role: string; company?: string; years: number; verified: boolean } }
type Exp = { id: string; company: string; role: string; industry: string; round: string; level: string; outcome: string; posted: string; author: string; summary: string; turns: Turn[]; reviews: Review[]; helpfulCount: number; helpedByMe: boolean; avgExpert: number | null }
const INDUSTRIES = ['FinTech', 'E-commerce', 'EdTech', 'HealthTech', 'SaaS', 'Consumer Tech', 'Social Media', 'Entertainment', 'Travel', 'Communication']
const ROUNDS = ['Product sense', 'Execution', 'Metrics', 'Strategy', 'Behavioral']

export default function Experiences() {
  const { data, loading, error, reload } = useLoad(() => get<{ experiences: Exp[] }>('/experiences'))
  const [view, setView] = useState<'library' | 'share'>('library')
  const [openId, setOpenId] = useState<string | null>(null)
  const [fi, setFi] = useState(''); const [fr, setFr] = useState('')
  const [review, setReview] = useState(false)
  const list = useMemo(() => (data?.experiences ?? []).filter((e) => (!fi || e.industry === fi) && (!fr || e.round === fr)), [data, fi, fr])
  const open = data?.experiences.find((e) => e.id === openId)
  const helpful = useAction(async (id: string) => { await post(`/experiences/${id}/helpful`); reload() })
  return (
    <>
      <PageHead title="Real interview experiences" sub="What interviewers actually asked, how candidates answered, and how senior PMs rank those answers." sample
        right={<div className="row"><button className={'btn' + (view === 'library' ? '' : ' ghost')} onClick={() => setView('library')}>Library</button><button className={'btn' + (view === 'share' ? '' : ' ghost')} onClick={() => setView('share')}>Share yours</button></div>} />
      {view === 'share' ? <Share onDone={() => { reload(); setView('library') }} /> : (<>
        {loading && <Spinner />}<ErrorBox error={error} onRetry={reload} />
        <div className="row" style={{ marginBottom: 16 }}>
          <select aria-label="Industry" value={fi} onChange={(e) => setFi(e.target.value)} style={{ width: 'auto' }}><option value="">All industries</option>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select>
          <select aria-label="Round" value={fr} onChange={(e) => setFr(e.target.value)} style={{ width: 'auto' }}><option value="">All rounds</option>{ROUNDS.map((i) => <option key={i}>{i}</option>)}</select>
        </div>
        <div className="grid2" style={{ gridTemplateColumns: 'minmax(0,5fr) minmax(0,7fr)', alignItems: 'start' }}>
          <div className="stack">
            {data && list.length === 0 && <Empty title="No experiences match">Clear a filter, or share yours.</Empty>}
            {list.map((e) => (
              <button key={e.id} className={'choice' + (openId === e.id ? ' on' : '')} onClick={() => setOpenId(e.id)}>
                <div className="row between"><b>{e.company}</b><span className={'pill ' + (e.outcome === 'Offer' ? 'ok' : e.outcome === 'Rejected' ? 'warn' : '')}>{e.outcome}</span></div>
                <span className="small muted">{e.role} · {e.industry} · {e.round}</span>
                <span>{e.summary}</span>
                <span className="row small muted">{e.avgExpert ? <><Stars value={e.avgExpert} /> Expert {e.avgExpert}</> : 'Awaiting expert ranking'} · {e.helpfulCount} found this helpful</span>
              </button>
            ))}
          </div>
          <div>
            {!open ? <Empty title="Pick an experience">See the full conversation and the expert rankings.</Empty> : (
              <section className="card stack">
                <div className="row between"><div><h2>{open.company}</h2><p className="muted small">{open.role} · {open.industry} · {open.round} round · shared by {open.author}</p></div>
                  <button className={'btn sm' + (open.helpedByMe ? '' : ' ghost')} onClick={() => helpful.run(open.id)}>{open.helpedByMe ? 'Marked helpful' : 'This helped me'}</button></div>
                <div>{open.turns.map((t, i) => <div key={i} className={'turn' + (t.speaker === 'candidate' ? ' cand' : '')}><span className="who">{t.speaker === 'interviewer' ? 'Interviewer' : 'Candidate'}</span><div>{t.text}{t.note && <div className="note-tag">{t.note}</div>}</div></div>)}</div>
                <div className="row between"><h3>Expert evaluation</h3><button className="btn sm ghost" onClick={() => setReview(true)}>Rank this as an expert</button></div>
                {open.reviews.length === 0 && <p className="muted">No expert has ranked this yet.</p>}
                {open.reviews.map((r, i) => (
                  <div key={i} className={'review' + (r.reviewer.verified ? '' : ' unver')}>
                    <div className="row between"><b>{r.reviewer.name}</b><span className="row"><Stars value={r.rating} />{r.verdict && <span className="pill lime">{r.verdict}</span>}</span></div>
                    <div className="small muted">{r.reviewer.role}{r.reviewer.company ? ` · ${r.reviewer.company}` : ''} · {r.reviewer.years} yrs experience · {r.reviewer.verified ? 'Verified expert' : 'Pending verification'}</div>
                    <p>{r.comment}</p>
                  </div>
                ))}
              </section>
            )}
          </div>
        </div>
        {review && open && <ReviewModal exp={open} onClose={() => setReview(false)} onDone={() => { setReview(false); reload() }} />}
      </>)}
    </>
  )
}

function ReviewModal({ exp, onClose, onDone }: { exp: Exp; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ name: '', role: '', years: '', rating: 0, verdict: '', comment: '' })
  const save = useAction(async () => { await post(`/experiences/${exp.id}/reviews`, { ...f, years: Number(f.years) }); onDone() })
  return (
    <Modal title="Rank this answer" onClose={onClose}>
      <p className="small muted">Your name, role and experience are shown beside your ranking. New reviewers are marked pending until verified.</p>
      <label className="field">Name<input value={f.name} onChange={(e) => setF({ ...f, name: e.target.value })} /></label>
      <div className="grid2"><label className="field">Role<input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Senior PM" /></label><label className="field">Years of experience<input type="number" min={0} value={f.years} onChange={(e) => setF({ ...f, years: e.target.value })} /></label></div>
      <div className="field">Ranking<Stars value={f.rating} onChange={(n) => setF({ ...f, rating: n })} /></div>
      <label className="field">One-line verdict<input value={f.verdict} onChange={(e) => setF({ ...f, verdict: e.target.value })} maxLength={60} /></label>
      <label className="field">What would you change?<textarea value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} style={{ minHeight: 80 }} /></label>
      <ErrorBox error={save.error} />
      <div className="row"><button className="btn" disabled={save.busy} onClick={() => save.run()}>Submit ranking</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
    </Modal>
  )
}

function Share({ onDone }: { onDone: () => void }) {
  const [f, setF] = useState({ company: '', role: '', industry: '', round: 'Product sense', outcome: 'Pending' })
  const [raw, setRaw] = useState('')
  const [file, setFile] = useState<File | null>(null)
  const [turns, setTurns] = useState<Turn[]>([])
  const parse = useAction(async () => { const r = await post('/experiences/parse', file ? { sampleAudio: true, filename: file.name } : { text: raw }); setTurns(r.turns); if (r.detected) setF((x) => ({ ...x, industry: x.industry || r.detected.industry, round: r.detected.round || x.round })) })
  const publish = useAction(async () => { await post('/experiences', { ...f, turns }); onDone() })
  const upd = (i: number, p: Partial<Turn>) => setTurns((t) => t.map((x, k) => (k === i ? { ...x, ...p } : x)))
  return (
    <div className="stack lg" style={{ maxWidth: 820 }}>
      <section className="card stack">
        <h2>1. About the interview</h2>
        <div className="grid2">
          <label className="field">Company<input value={f.company} onChange={(e) => setF({ ...f, company: e.target.value })} /></label>
          <label className="field">Role<input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} placeholder="Associate Product Manager" /></label>
          <label className="field">Industry<select value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })}><option value="">Choose…</option>{INDUSTRIES.map((i) => <option key={i}>{i}</option>)}</select></label>
          <label className="field">Round<select value={f.round} onChange={(e) => setF({ ...f, round: e.target.value })}>{ROUNDS.map((i) => <option key={i}>{i}</option>)}</select></label>
          <label className="field">Outcome<select value={f.outcome} onChange={(e) => setF({ ...f, outcome: e.target.value })}><option>Pending</option><option>Offer</option><option>Rejected</option></select></label>
        </div>
      </section>
      <section className="card stack">
        <h2>2. What happened in the room</h2>
        <p className="muted">Upload a recording and AI turns it into a structured conversation, or paste your notes with lines starting “Interviewer:” and “Me:”.</p>
        <div className="grid2">
          <label className="field">Audio recording (optional)<input type="file" accept="audio/*" onChange={(e) => setFile(e.target.files?.[0] ?? null)} /></label>
          <label className="field">Or paste a transcript<textarea value={raw} onChange={(e) => setRaw(e.target.value)} placeholder={'Interviewer: How would you improve onboarding?\nMe: I would start with where users drop off…'} /></label>
        </div>
        <div className="row"><button className="btn" disabled={parse.busy || (!file && !raw.trim())} onClick={() => parse.run()}>{parse.busy ? 'Structuring with AI…' : 'Structure my experience'}</button>{parse.busy && <Spinner />}</div>
        {file && <p className="small muted">Prototype: any audio file returns the same sample conversation. Nothing is uploaded.</p>}
        <ErrorBox error={parse.error} />
      </section>
      {turns.length > 0 && (
        <section className="card stack">
          <h2>3. Check and publish</h2>
          <p className="muted small">Fix anything the AI got wrong and remove anything that identifies a person. You are responsible for what you publish.</p>
          {turns.map((t, i) => (
            <div key={i} className="turn" style={{ gridTemplateColumns: '120px 1fr' }}>
              <select value={t.speaker} onChange={(e) => upd(i, { speaker: e.target.value as Turn['speaker'] })} aria-label="Speaker"><option value="interviewer">Interviewer</option><option value="candidate">Candidate</option></select>
              <textarea value={t.text} onChange={(e) => upd(i, { text: e.target.value })} style={{ minHeight: 56 }} />
            </div>
          ))}
          <ErrorBox error={publish.error} />
          <button className="btn lime" style={{ justifySelf: 'start' }} disabled={publish.busy} onClick={() => publish.run()}>Publish to the library</button>
        </section>
      )}
    </div>
  )
}
