// Thin client for the mock backend. Identity is the bearer token; the server never trusts ids from the body.
export class ApiError extends Error {
  constructor(public code: string, message: string, public retryable = false, public status = 0) { super(message) }
}

export const getToken = () => { try { return localStorage.getItem('pm_token') } catch { return null } }
export const setToken = (t: string | null) => { try { t ? localStorage.setItem('pm_token', t) : localStorage.removeItem('pm_token') } catch { /* private mode */ } }

export async function api<T = any>(method: string, path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch('/api' + path, { method, headers: { 'content-type': 'application/json', ...(getToken() ? { authorization: `Bearer ${getToken()}` } : {}) }, body: body === undefined ? undefined : JSON.stringify(body) })
  } catch {
    throw new ApiError('network', 'Cannot reach the server. Check your connection and try again.', true)
  }
  const data = await res.json().catch(() => ({}))
  if (!res.ok) {
    if (res.status === 401) { setToken(null); window.dispatchEvent(new Event('pm-signed-out')) }
    const e = data?.error || {}
    throw new ApiError(e.code || 'error', e.message || 'Something went wrong. Try again.', !!e.retryable, res.status)
  }
  return data as T
}
export const get = <T = any>(p: string) => api<T>('GET', p)
export const post = <T = any>(p: string, b: unknown = {}) => api<T>('POST', p, b)
export const engine = <T = any>(body: Record<string, unknown>) => post<T>('/interview-engine', body)

export type User = { id: string; name: string; email: string; verified: boolean }
export type Msg = { seq: number; role: 'interviewer' | 'candidate'; content: string; skipped: boolean; kind?: 'clarify'; area?: string }
export type Session = { id: string; level: string; category: string; categories?: string[]; current_category?: string; difficulty: string; industry: string | null; industry_name?: string | null; opening?: string | null; clarifications?: number; status: string; feedback_status: string; timer_remaining_ms: number; skips_used: number; end_reason: string | null; created_at: string; size_bytes: number; rating: { rating: number; comment: string } | null; has_feedback: boolean }
// a feedback point, with the candidate's own words (verbatim) that earned it, or where it was missing
export type FeedbackPoint = { text: string; quote?: string; cut?: boolean; note?: string }
export type AnswerFeedback = { seq: number; question: string; answer?: string; area?: string; skipped: boolean; verdict?: 'Strong' | 'Solid' | 'Needs work'; good?: (FeedbackPoint | string)[]; missing?: (FeedbackPoint | string)[]; tip?: string }
export type Feedback = { overall_score: number; band?: string; answers?: AnswerFeedback[]; explanation: string; competency_scores: { name: string; score: number; explanation: string; evidence?: { quote: string; cut?: boolean; seq: number; qn: number } | null }[]; strengths: string[]; improvement_areas: string[]; suggestions: string[]; model: string }

export const CATEGORY_LABELS: Record<string, string> = { 'product-sense': 'Product Sense', execution: 'Execution', metrics: 'Metrics', strategy: 'Strategy', behavioral: 'Behavioral', 'ai-product': 'AI Product Sense' }
// An interview can cover several focus areas; `category` is the first one, kept for older records
export const sessionCategories = (s: Pick<Session, 'category' | 'categories'>) => (s.categories?.length ? s.categories : [s.category])
export const catLabel = (s: Pick<Session, 'category' | 'categories'>) => sessionCategories(s).map((c) => CATEGORY_LABELS[c]).join(' + ')
// the "How do you use AI?" practice is named for what it is, not by its focus area
export const interviewTitle = (s: Pick<Session, 'category' | 'categories' | 'opening'>) => (s.opening === 'ai-usage' ? 'AI question practice' : catLabel(s))
export const fmtBytes = (n: number) => (n > 1024 * 1024 ? (n / 1024 / 1024).toFixed(1) + ' MB' : Math.max(1, Math.round(n / 1024)) + ' KB')
export const fmtDate = (iso: string) => new Date(iso).toLocaleDateString(undefined, { day: 'numeric', month: 'short', year: 'numeric' })
