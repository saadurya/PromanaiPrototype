import { useState } from 'react'
import { CATEGORY_LABELS, get, api, post } from '../api'
import { Empty, ErrorBox, Modal, PageHead, Spinner, Stars, useAction, useLoad, useToast } from '../ui'

type Peer = { id: string; name: string; level: string; focus: string[]; bio: string; availability: string[]; overlap: string[] }
type Booking = { id: string; peerId: string; peerName: string; slot: string; focus: string; status: string; feedbackGiven: null | { structure: number; depth: number; communication: number; comment: string } }
type Data = { days: string[]; hours: number[]; mine: string[]; peers: Peer[]; bookings: Booking[] }
const hr = (h: number) => `${h % 12 || 12} ${h < 12 ? 'AM' : 'PM'}`
const dayLabel = (d: string) => new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric' })
const slotLabel = (s: string) => { const [d, h] = s.split('@'); return `${new Date(d + 'T00:00').toLocaleDateString(undefined, { weekday: 'short', day: 'numeric', month: 'short' })}, ${hr(Number(h))}` }

export default function PeerMocks() {
  const { data, setData, loading, error, reload } = useLoad(() => get<Data>('/peers'))
  const toast = useToast()
  const [book, setBook] = useState<Peer | null>(null)
  const [fb, setFb] = useState<Booking | null>(null)
  const toggle = useAction(async (slot: string) => {
    if (!data) return
    const next = data.mine.includes(slot) ? data.mine.filter((s) => s !== slot) : [...data.mine, slot]
    setData({ ...data, mine: next })
    await api('PUT', '/availability', { slots: next })
    reload()
  })
  if (loading && !data) return <Spinner />
  if (!data) return <ErrorBox error={error} onRetry={reload} />
  const freeCount = (slot: string) => data.peers.filter((p) => p.availability.includes(slot)).length
  const matches = data.peers.filter((p) => p.overlap.length).sort((a, b) => b.overlap.length - a.overlap.length)
  const upcoming = data.bookings.filter((b) => b.status !== 'cancelled')
  return (
    <>
      <PageHead title="Peer mock interviews" sub="Mark when you are free. Peers who are free at the same time show up, and you can book a live mock and swap feedback." sample />
      <div className="stack lg">
        <section className="card stack">
          <div className="row between"><h2>Your availability</h2><span className="small muted">{data.mine.length} slots marked · times in your local time zone</span></div>
          <div className="row small"><span className="pill" style={{ background: 'var(--violet)', color: '#fff' }}>You are free</span><span className="pill lime">You and a peer are free</span><span className="pill">A peer is free (number)</span></div>
          <div className="cal" role="grid" aria-label="Weekly availability">
            <div />{data.days.map((d) => <div key={d} className="h">{dayLabel(d)}</div>)}
            {data.hours.map((h) => (<div key={h} style={{ display: 'contents' }}>
              <div className="tm">{hr(h)}</div>
              {data.days.map((d) => { const s = `${d}@${h}`; const mine = data.mine.includes(s); const n = freeCount(s); return <button key={s} className={'cell' + (mine ? (n ? ' overlap' : ' mine') : n ? ' peer' : '')} aria-pressed={mine} aria-label={`${slotLabel(s)}${mine ? ', you are free' : ''}${n ? `, ${n} peers free` : ''}`} onClick={() => toggle.run(s)}>{n || ''}</button> })}
            </div>))}
          </div>
          <ErrorBox error={toggle.error} />
        </section>
        <section className="stack">
          <h2>Peers you can meet</h2>
          {data.mine.length === 0 && <Empty title="Mark a few slots above">Peers with matching free time will appear here.</Empty>}
          {data.mine.length > 0 && matches.length === 0 && <Empty title="No overlap yet">Try adding more evening or weekend slots.</Empty>}
          <div className="grid2">{matches.map((p) => (
            <div key={p.id} className="card stack">
              <div className="row between"><h3>{p.name}</h3><span className="pill lime">{p.overlap.length} shared slot{p.overlap.length > 1 ? 's' : ''}</span></div>
              <p className="small muted">{p.level} · {p.bio}</p>
              <div className="row">{p.focus.map((f) => <span key={f} className="pill">{CATEGORY_LABELS[f]}</span>)}</div>
              <button className="btn" style={{ justifySelf: 'start' }} onClick={() => setBook(p)}>Request a mock</button>
            </div>))}</div>
        </section>
        <section className="card stack">
          <h2>Your sessions</h2>
          {upcoming.length === 0 ? <p className="muted">No sessions booked yet.</p> : upcoming.map((b) => (
            <div key={b.id} className="row between" style={{ borderBottom: '1px solid var(--line)', paddingBottom: 10 }}>
              <div><b>{b.peerName}</b> · {CATEGORY_LABELS[b.focus]}<div className="small muted">{slotLabel(b.slot)}</div></div>
              {b.status === 'done' && b.feedbackGiven ? <span className="pill ok">Feedback sent</span> : <div className="row"><button className="btn sm" onClick={() => setFb(b)}>Finish and give feedback</button><button className="btn sm ghost" onClick={() => post(`/bookings/${b.id}/cancel`).then(() => { toast('Session cancelled'); reload() })}>Cancel</button></div>}
            </div>))}
        </section>
      </div>
      {book && <BookModal peer={book} onClose={() => setBook(null)} onDone={() => { setBook(null); toast('Session confirmed'); reload() }} />}
      {fb && <FeedbackModal b={fb} onClose={() => setFb(null)} onDone={() => { setFb(null); toast('Feedback sent'); reload() }} />}
    </>
  )
}

function BookModal({ peer, onClose, onDone }: { peer: Peer; onClose: () => void; onDone: () => void }) {
  const [slot, setSlot] = useState(peer.overlap[0])
  const [focus, setFocus] = useState(peer.focus[0])
  const save = useAction(async () => { await post('/bookings', { peerId: peer.id, slot, focus }); onDone() })
  return (
    <Modal title={`Mock interview with ${peer.name}`} onClose={onClose}>
      <label className="field">When<select value={slot} onChange={(e) => setSlot(e.target.value)}>{peer.overlap.map((s) => <option key={s} value={s}>{slotLabel(s)}</option>)}</select></label>
      <label className="field">Practise<select value={focus} onChange={(e) => setFocus(e.target.value)}>{peer.focus.map((f) => <option key={f} value={f}>{CATEGORY_LABELS[f]}</option>)}</select></label>
      <p className="small muted">You take turns: 20 minutes each way, then 10 minutes of feedback. A call link would be shared here in the real product.</p>
      <ErrorBox error={save.error} />
      <div className="row"><button className="btn" disabled={save.busy} onClick={() => save.run()}>Confirm session</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
    </Modal>
  )
}

function FeedbackModal({ b, onClose, onDone }: { b: Booking; onClose: () => void; onDone: () => void }) {
  const [f, setF] = useState({ structure: 0, depth: 0, communication: 0, comment: '' })
  const save = useAction(async () => { await post(`/bookings/${b.id}/feedback`, f); onDone() })
  const ok = f.structure && f.depth && f.communication
  return (
    <Modal title={`Feedback for ${b.peerName}`} onClose={onClose}>
      {(['structure', 'depth', 'communication'] as const).map((k) => <div key={k} className="row between"><span style={{ textTransform: 'capitalize' }}>{k}</span><Stars value={f[k]} onChange={(n) => setF({ ...f, [k]: n })} /></div>)}
      <label className="field">One thing they did well, one thing to change<textarea value={f.comment} onChange={(e) => setF({ ...f, comment: e.target.value })} style={{ minHeight: 80 }} /></label>
      <ErrorBox error={save.error} />
      <div className="row"><button className="btn" disabled={!ok || save.busy} onClick={() => save.run()}>Send feedback</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
    </Modal>
  )
}
