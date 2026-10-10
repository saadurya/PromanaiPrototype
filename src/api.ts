// Thin client for the mock backend. Identity is the bearer token; the server never trusts ids from the body.
export class ApiError extends Error {
  constructor(public code: string, message: string, public retryable = false, public status = 0) { super(message) }
}

export const getToken = () => { try { return localStorage.getItem('pm_token') } catch { return null } }
export const setToken = (t: string | null) => { try { t ? localStorage.setItem('pm_token', t) : localStorage.removeItem('pm_token') } catch { /* private mode */ } }

// Where requests go: the Node mock server in `npm run dev`, or the same mock running in the page for static builds.
export const BROWSER_API = import.meta.env.VITE_API !== 'server'
// The failure-screen switches in Settings exist wherever the mock's /_dev routes do.
export const PROTOTYPE_TOOLS = BROWSER_API || import.meta.env.DEV
let local: Promise<typeof import('./mockServer')> | null = null

async function send(method: string, path: string, body?: unknown): Promise<{ status: number; data: any }> {
  if (BROWSER_API) {
    const { dispatch } = await (local ??= import('./mockServer'))
    const out = await dispatch({ method, path: '/api' + path, token: getToken(), body: body ?? {} })
    return { status: out.status, data: JSON.parse(JSON.stringify(out.body ?? {})) } // copy, like a network response
  }
  let res: Response
  try {
    res = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('network', 'Cannot reach the server. Check your connection and try again.', true)
  }
  return { status: res.status, data: await res.json().catch(() => ({})) }
}

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  const { status, data } = await send(method, path, body)
  if (status < 200 || status >= 300) {
    if (status === 401) { setToken(null); window.dispatchEvent(new Event('pm-signed-out')) }
    const e = data?.error || {}
    throw new ApiError(e.code || 'error', e.message || 'Something went wrong. Try again.', !!e.retryable, status)
  }
  return data as T
}
export const get = <T = any>(p: string) => api<T>('GET', p)
export const post = <T = any>(p: string, b: unknown = {}) => api<T>('POST', p, b)
export const del = <T = any>(p: string) => api<T>('DELETE', p)
export const engine = <T = any>(body: Record<string, unknown>) => post<T>('/interview-engine', body)

// Local copy of the answer being spoken, so a refresh or dropped connection never loses it.
// The server keeps its own copy too; whichever was written last wins on resume.
export type Draft = { text: string; for_seq: number; at: number }
const DRAFT_PREFIX = 'pm_draft_'
export const loadDraft = (id: string): Draft | null => { try { return JSON.parse(localStorage.getItem(DRAFT_PREFIX + id) || 'null') } catch { return null } }
export const storeDraft = (id: string, d: Draft | null) => { try { d?.text.trim() ? localStorage.setItem(DRAFT_PREFIX + id, JSON.stringify(d)) : localStorage.removeItem(DRAFT_PREFIX + id) } catch { /* private mode */ } }
export const clearAllDrafts = () => { try { Object.keys(localStorage).filter((k) => k.startsWith(DRAFT_PREFIX)).forEach((k) => localStorage.removeItem(k)) } catch { /* private mode */ } }

export type User = { id: string; name: string; email: string; verified: boolean }
export type Msg = { seq: number; role: 'interviewer' | 'candidate'; content: string; skipped: boolean; submitted: boolean }
export type Storage = { used: number; limit: number; full: boolean }
export type Session = { id: string; level: string; category: string; difficulty: string; industry: string | null; status: string; feedback_status: string; timer_remaining_ms: number; skips_used: number; end_reason: string | null; created_at: string; size_bytes: number; rating: { rating: number; comment: string } | null; has_feedback: boolean }
export type Feedback = { overall_score: number; explanation: string; competency_scores: { name: string; score: number; explanation: string }[]; strengths: string[]; improvement_areas: string[]; suggestions: string[]; model: string }

export const CATEGORY_LABELS: Record<string, string> = { 'product-sense': 'Product Sense', execution: 'Execution', metrics: 'Metrics', strategy: 'Strategy', behavioral: 'Behavioral' }
export const fmtBytes = (n: number) => (n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB')
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
