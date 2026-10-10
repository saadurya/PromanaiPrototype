import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { ApiError } from './api'

export const Spinner = () => <span className="spin" role="status" aria-label="Loading" />

export function ErrorBox({ error, onRetry }: { error: unknown; onRetry?: () => void }) {
  if (!error) return null
  const e = error as ApiError
  return (
    <div className="err" role="alert">
      <span>{e.message || 'Something went wrong.'}</span>
      {onRetry && (e.retryable ?? true) && <button className="btn sm ghost" onClick={onRetry}>Retry</button>}
    </div>
  )
}

export function Stars({ value, onChange }: { value: number; onChange?: (n: number) => void }) {
  if (!onChange) return <span className="stars static" aria-label={`${value} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <span key={n} className={n <= Math.round(value) ? 'on' : ''}>★</span>)}</span>
  return (
    <span className="stars" role="radiogroup" aria-label="Rating">
      {[1, 2, 3, 4, 5].map((n) => <button key={n} type="button" role="radio" aria-checked={n === value} aria-label={`${n} star${n > 1 ? 's' : ''}`} className={n <= value ? 'on' : ''} onClick={() => onChange(n)}>★</button>)}
    </span>
  )
}

export const Meter = ({ pct, lime }: { pct: number; lime?: boolean }) => <div className={'meter' + (lime ? ' lime' : '')}><i style={{ width: `${Math.min(100, pct)}%` }} /></div>

export function Modal({ title, children, onClose, wide }: { title: string; children: ReactNode; onClose: () => void; wide?: boolean }) {
  useEffect(() => { const k = (e: KeyboardEvent) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k) }, [onClose])
  return <div className="modal-bg" onClick={onClose}><div className={'modal' + (wide ? ' wide' : '')} role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}><h2>{title}</h2>{children}</div></div>
}

export function PageHead({ title, sub, right, sample }: { title: string; sub?: string; right?: ReactNode; sample?: boolean }) {
  return (
    <div className="page-head">
      <div>
        <h1>{title}</h1>
        {sub && <p>{sub}</p>}
        {sample && <p style={{ marginTop: 10 }}><span className="sample-chip">Prototype with sample data</span></p>}
      </div>
      {right}
    </div>
  )
}

export const Empty = ({ title, children }: { title: string; children?: ReactNode }) => <div className="empty"><h3 style={{ color: 'var(--ink)' }}>{title}</h3>{children}</div>

// Candidate view hides the stakeholder-only parts (ideas to compare, developer tools) for user testing. Per browser.
const VIEW_KEY = 'pm_candidate_view'
const readView = () => { try { return localStorage.getItem(VIEW_KEY) === '1' } catch { return false } }
export function useCandidateView(): [boolean, (on: boolean) => void] {
  const [on, setOn] = useState(readView)
  useEffect(() => { const f = () => setOn(readView()); window.addEventListener('pm-view', f); return () => window.removeEventListener('pm-view', f) }, [])
  const set = useCallback((v: boolean) => {
    try { if (v) localStorage.setItem(VIEW_KEY, '1'); else localStorage.removeItem(VIEW_KEY) } catch { /* private mode */ }
    window.dispatchEvent(new Event('pm-view'))
  }, [])
  return [on, set]
}

// "How do you use AI?" talking points, kept on this device between the prep, setup and the interview
const POINTS_KEY = 'pm_ai_points'
export const aiPoints = {
  get: (): string[] => { try { const v = JSON.parse(localStorage.getItem(POINTS_KEY) || '[]'); return Array.isArray(v) ? v : [] } catch { return [] } },
  set: (p: string[]) => { try { if (p.length) localStorage.setItem(POINTS_KEY, JSON.stringify(p)); else localStorage.removeItem(POINTS_KEY) } catch { /* private mode */ } },
}
export function TalkingPoints({ points }: { points: string[] }) {
  return <ol style={{ margin: 0, paddingLeft: 20, display: 'grid', gap: 6 }}>{points.map((p) => <li key={p}>{p}</li>)}</ol>
}

// tiny toast context
const ToastCtx = createContext<(m: string) => void>(() => {})
export const useToast = () => useContext(ToastCtx)
export function ToastProvider({ children }: { children: ReactNode }) {
  const [msg, setMsg] = useState('')
  const show = useCallback((m: string) => { setMsg(m); setTimeout(() => setMsg(''), 2600) }, [])
  return <ToastCtx.Provider value={show}>{children}{msg && <div className="toast" role="status">{msg}</div>}</ToastCtx.Provider>
}

// run an async action with loading + error state
export function useAction<A extends unknown[], R>(fn: (...a: A) => Promise<R>) {
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<unknown>(null)
  const run = useCallback(async (...a: A) => {
    setBusy(true); setError(null)
    try { return await fn(...a) } catch (e) { setError(e); return undefined } finally { setBusy(false) }
  }, [fn])
  return { run, busy, error, setError }
}

export function useLoad<T>(loader: () => Promise<T>, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<unknown>(null)
  const [loading, setLoading] = useState(true)
  const reload = useCallback(() => {
    setLoading(true); setError(null)
    loader().then(setData).catch(setError).finally(() => setLoading(false))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps)
  useEffect(reload, [reload])
  return { data, setData, error, loading, reload }
}
