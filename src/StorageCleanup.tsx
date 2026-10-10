import { useState } from 'react'
import { CATEGORY_LABELS, del, fmtBytes, fmtDate, get, type Session, type Storage } from './api'
import { downloadReportById } from './report'
import { ErrorBox, Meter, Modal, Spinner, useAction, useLoad, useToast } from './ui'

// Shown when storage is full: offers the oldest finished interview for download, then deletes it after confirmation.
export default function StorageCleanup({ onFreed }: { onFreed?: (s: Storage) => void }) {
  const toast = useToast()
  const list = useLoad(() => get<{ interviews: Session[]; storage: Storage }>('/interviews'))
  const [downloaded, setDownloaded] = useState<string | null>(null)
  const [confirm, setConfirm] = useState(false)
  const oldest = list.data?.interviews.filter((i) => i.status !== 'in_progress').sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
  const download = useAction(async () => { await downloadReportById(oldest!.id); setDownloaded(oldest!.id) })
  const remove = useAction(async () => {
    const r = await del<{ storage: Storage }>(`/interviews/${oldest!.id}`)
    setConfirm(false); setDownloaded(null)
    toast(`Deleted. ${fmtBytes(oldest!.size_bytes)} freed`)
    list.reload(); onFreed?.(r.storage)
  })

  if (list.loading) return <Spinner />
  if (list.error) return <ErrorBox error={list.error} onRetry={list.reload} />
  const st = list.data!.storage
  if (!st.full) return null
  return (
    <section className="card stack" style={{ borderColor: '#f3bccd' }} aria-live="polite">
      <div className="row between"><h2>Your storage is full</h2><span className="small muted">{fmtBytes(st.used)} of {fmtBytes(st.limit)}</span></div>
      <Meter pct={(st.used / st.limit) * 100} />
      {!oldest ? <p className="muted">Finish your running interview first, then you can free space.</p> : (<>
        <p className="muted">Free space by removing your oldest interview. Download it first if you want to keep a copy.</p>
        <div className="row between" style={{ padding: '8px 0', borderTop: '1px solid var(--line)', borderBottom: '1px solid var(--line)' }}>
          <span><b>{CATEGORY_LABELS[oldest.category]}</b> <span className="muted small">· {oldest.difficulty} · {fmtDate(oldest.created_at)} · {fmtBytes(oldest.size_bytes)}</span></span>
          <div className="row">
            <button className="btn ghost sm" onClick={() => download.run()} disabled={download.busy}>{downloaded === oldest.id ? 'Downloaded ✓' : 'Download .txt'}</button>
            <button className="btn danger sm" onClick={() => setConfirm(true)}>Delete</button>
          </div>
        </div>
        <ErrorBox error={download.error} />
      </>)}
      {confirm && oldest && (
        <Modal title="Delete this interview?" onClose={() => setConfirm(false)}>
          <p>{CATEGORY_LABELS[oldest.category]} from {fmtDate(oldest.created_at)}: its transcript and report will be removed for good.</p>
          {downloaded !== oldest.id && <div className="err" role="alert"><span>You have not downloaded a copy yet.</span><button className="btn sm ghost" onClick={() => download.run()} disabled={download.busy}>Download .txt</button></div>}
          <ErrorBox error={remove.error} />
          <div className="row"><button className="btn danger" onClick={() => remove.run()} disabled={remove.busy}>Delete interview</button><button className="btn ghost" onClick={() => setConfirm(false)}>Cancel</button></div>
        </Modal>
      )}
    </section>
  )
}
