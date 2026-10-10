// Mock backend core for the ProManAI prototype: multi-user, no real AI, no platform APIs beyond Web Crypto.
// It mirrors the doc: server owns the timer, skips and scores; the browser only displays.
// Runs under Node (server/index.js) and inside the browser for static hosting (src/mockServer.ts).
import * as S from './seed.js'
import { makeGuard } from './guard.js'
import { SECRET_PROMPTS } from './prompts.js'

const TOTAL_MS = 20 * 60 * 1000
const MAX_SKIPS = 2
const MAX_GAP_MS = 30_000 // doc: at most ~30s lost per gap
const STORAGE_LIMIT = 5 * 1024 * 1024
const STORAGE_HEADROOM = 20_000 // room one more interview needs
const MAX_ANSWER = 4000
const VERIFY_TTL_MS = 24 * 60 * 60 * 1000
const RATE = { engine: 20, feedback: 6, draft: 40, verify: 5 } // per user per minute
const DEMO = { id: 'u-demo', email: 'demo@promanai.dev', name: 'Demo', password: 'demo-pass' }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rid = () => Math.random().toString(36).slice(2, 9)
const hex = (buf) => [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
const randomHex = (n) => hex(globalThis.crypto.getRandomValues(new Uint8Array(n)))
const newToken = () => randomHex(24)
const byteLength = (s) => new TextEncoder().encode(s).length
const guard = makeGuard(SECRET_PROMPTS)

async function hashPassword(pw, salt = randomHex(16)) {
  const key = await globalThis.crypto.subtle.importKey('raw', new TextEncoder().encode(String(pw)), 'PBKDF2', false, ['deriveBits'])
  const bits = await globalThis.crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: new TextEncoder().encode(salt), iterations: 100_000 }, key, 256)
  return { salt, hash: hex(bits) }
}
async function passwordMatches(pw, rec) {
  const { hash } = await hashPassword(pw, rec.salt)
  let diff = hash.length ^ rec.hash.length // constant-time compare
  for (let k = 0; k < hash.length; k++) diff |= hash.charCodeAt(k) ^ rec.hash.charCodeAt(k % rec.hash.length)
  return diff === 0
}

const userState = () => ({
  myAvailability: new Set(),
  bookings: [],
  resourceVotes: {},
  toolVotes: {},
  experienceHelpful: new Set(),
  flags: { busyNext: false, feedbackFailNext: false },
  hits: { engine: [], feedback: [], draft: [], verify: [] },
})

async function fresh() {
  const demo = { id: DEMO.id, email: DEMO.email, name: DEMO.name, verified: true, pw: await hashPassword(DEMO.password), verify: null }
  return {
    users: new Map([[demo.id, demo]]),
    tokens: new Map(), // bearer token -> user id
    state: new Map([[demo.id, userState()]]),
    interviews: S.seedInterviews().map((i) => ({ ...i, owner_id: demo.id })),
    experiences: structuredClone(S.EXPERIENCES),
    toolReports: {},
  }
}
// Saved form of the database (Maps and Sets become arrays), so the browser build can keep it in localStorage.
const serialize = (db) => ({
  users: [...db.users.values()],
  tokens: [...db.tokens],
  state: [...db.state].map(([id, st]) => [id, { ...st, myAvailability: [...st.myAvailability], experienceHelpful: [...st.experienceHelpful], hits: undefined }]),
  interviews: db.interviews,
  experiences: db.experiences,
  toolReports: db.toolReports,
})
const deserialize = (o) => ({
  users: new Map(o.users.map((u) => [u.id, u])),
  tokens: new Map(o.tokens),
  state: new Map(o.state.map(([id, st]) => [id, { ...userState(), ...st, myAvailability: new Set(st.myAvailability), experienceHelpful: new Set(st.experienceHelpful) }])),
  // A report that was being written when the page closed is retried on the next visit.
  interviews: o.interviews.map((i) => (i.feedback_status === 'pending' ? { ...i, feedback_status: 'none' } : i)),
  experiences: o.experiences,
  toolReports: o.toolReports,
})

// opts.devTools: no email service, so verification links come back in responses, plus the /_dev routes.
// opts.load / opts.save: optional persistence of the serialized database. opts.storageLimit: tests use a small cap.
export function createCore(opts = {}) {
  const DEV_TOOLS = !!opts.devTools
  const storageLimit = opts.storageLimit ?? STORAGE_LIMIT
  let db
  const ready = (async () => {
    const saved = opts.load?.()
    if (saved) { try { db = deserialize(saved); return } catch (e) { console.warn('saved mock data unreadable, starting fresh', e) } }
    db = await fresh()
  })()
  const persist = () => opts.save?.(serialize(db))
  const reset = async () => { db = await fresh() }
  const err = (status, code, message, retryable = false) => ({ status, body: { error: { code, message, retryable } } })
  const publicUser = (u) => ({ id: u.id, email: u.email, name: u.name, verified: u.verified })

  const limited = (c, kind) => {
    const now = Date.now()
    const hits = c.st.hits
    hits[kind] = hits[kind].filter((t) => now - t < 60_000)
    if (hits[kind].length >= RATE[kind]) return true
    hits[kind].push(now)
    return false
  }

  const bytes = (i) => i.messages.reduce((n, m) => n + byteLength(m.content), 0) + 600
  const mine = (c) => db.interviews.filter((i) => i.owner_id === c.user.id)
  // Interviews belonging to someone else look exactly like ones that do not exist.
  const findMine = (c, id) => db.interviews.find((i) => i.id === id && i.owner_id === c.user.id)
  const storage = (c) => { const used = mine(c).reduce((n, i) => n + i.size_bytes, 0); return { used, limit: storageLimit, full: used > storageLimit - STORAGE_HEADROOM } }
  const publicSession = (i) => ({ ...i, messages: undefined, feedback: undefined, draft: undefined, owner_id: undefined, has_feedback: !!i.feedback })
  const active = (c) => mine(c).find((i) => i.status === 'in_progress')
  const lastQuestion = (i) => [...i.messages].reverse().find((m) => m.role === 'interviewer')

  // Server-side clock. Charges elapsed time since last tick, capped per gap.
  function charge(i) {
    const now = Date.now()
    const gap = Math.min(now - (i.last_tick || now), MAX_GAP_MS)
    i.timer_remaining_ms = Math.max(0, i.timer_remaining_ms - gap)
    i.last_tick = now
    if (i.timer_remaining_ms === 0 && i.status === 'in_progress') finish(i, 'time_up')
  }
  function finish(i, reason) {
    i.status = 'completed'
    i.end_reason = reason
    i.feedback_status = 'none'
    // An answer still being worked on is kept in the transcript but marked unsubmitted, so it is never scored.
    if (i.draft?.text && i.messages.at(-1)?.role === 'interviewer' && i.draft.for_seq === i.messages.at(-1).seq) addMsg(i, 'candidate', i.draft.text, { submitted: false })
    i.draft = null
    if (!i.messages.some((m) => m.role === 'interviewer' && m.content === S.CLOSING)) addMsg(i, 'interviewer', S.CLOSING)
    i.size_bytes = bytes(i)
  }
  const addMsg = (i, role, content, extra = {}) => {
    const m = { seq: i.messages.length + 1, role, content, submitted: role === 'candidate', skipped: false, ...extra }
    i.messages.push(m)
    return m
  }

  const ctxFor = (industryId) => {
    const ind = S.INDUSTRIES.find((x) => x.id === industryId)
    return ind || { company: 'Lumen', ctx: 'a photo-sharing app', user: 'a casual user', metric: 'weekly active users', tension: 'growth vs. quality' }
  }

  // Mock "Gemini": candidate questions in order of preference, based on simple features of the last answer.
  function questionPool(i) {
    const lastAnswer = [...i.messages].reverse().find((m) => m.role === 'candidate')?.content || ''
    const words = lastAnswer.trim().split(/\s+/).filter(Boolean).length
    const pool = []
    if (i.timer_remaining_ms < 180_000) pool.push('We are short on time. In two sentences, what is your single most important recommendation?')
    if (words < 25) pool.push(S.GENERIC_FOLLOWUPS.shortAnswer)
    if (!/user|customer|segment/i.test(lastAnswer) && i.category === 'product-sense') pool.push(S.GENERIC_FOLLOWUPS.noUser)
    if (!/metric|measure|kpi|rate/i.test(lastAnswer) && i.category !== 'behavioral') pool.push(S.GENERIC_FOLLOWUPS.noMetric)
    if (!/trade|instead|cost|versus/i.test(lastAnswer)) pool.push(S.GENERIC_FOLLOWUPS.noTradeoff)
    pool.push(...S.FOLLOWUPS[i.category])
    return pool
  }
  const WRAP_UP = 'Is there anything you would like to add before we wrap up?'
  // Every question goes through the output guard; a rejected one is replaced by the next safe candidate.
  function nextQuestion(i, opts = {}) {
    if (opts.opening) {
      const q = guard.checkQuestion(S.QUESTION_TEMPLATES[i.category](ctxFor(i.industry)) + S.HARD_SUFFIX[i.difficulty])
      if (q.ok) return q.text
      console.warn('guard rejected opening question:', q.reason)
    }
    const asked = new Set(i.messages.filter((m) => m.role === 'interviewer').map((m) => m.content))
    for (const raw of questionPool(i)) {
      if (asked.has(raw)) continue
      const q = guard.checkQuestion(raw)
      if (q.ok) return q.text
      console.warn('guard rejected question:', q.reason)
    }
    return WRAP_UP
  }

  async function engine(b, c) {
    const a = b.action
    if (a === 'save_draft') return saveDraft(b, c)
    if (limited(c, 'engine')) return err(429, 'rate_limited', 'You are going too quickly. Wait a few seconds and try again.', true)
    if (a === 'status') {
      const i = active(c)
      if (i) charge(i)
      const cur = active(c)
      return { body: { active: cur ? publicSession(cur) : null, storage: storage(c) } }
    }
    if (a === 'start') {
      if (!c.user.verified) return err(403, 'email_unverified', 'Verify your email to start an interview.')
      if (active(c)) return err(409, 'already_running', 'You already have an interview in progress.')
      if (storage(c).full) return err(409, 'storage_full', 'Storage is full. Download and delete your oldest interview first.')
      const { level, category, difficulty, industry } = b
      if (!['APM', 'PM'].includes(level) || !S.CATEGORIES[category] || !['easy', 'medium', 'hard'].includes(difficulty)) return err(400, 'invalid_input', 'Choose a level, category and difficulty.')
      if (industry && !S.INDUSTRIES.some((x) => x.id === industry)) return err(400, 'invalid_input', 'Unknown industry.')
      const i = { id: 'i' + rid(), owner_id: c.user.id, level, category, difficulty, industry: industry || null, status: 'in_progress', feedback_status: 'none', timer_remaining_ms: TOTAL_MS, skips_used: 0, end_reason: null, created_at: new Date().toISOString(), size_bytes: 0, rating: null, feedback_attempts: 0, messages: [], draft: null, last_tick: Date.now(), feedback: null }
      db.interviews.unshift(i)
      await sleep(700)
      const first = c.user.name.split(' ')[0]
      addMsg(i, 'interviewer', `Hi ${first}, thanks for joining. ${nextQuestion(i, { opening: true })}`)
      return { body: { session: publicSession(i), messages: i.messages } }
    }
    const i = b.id ? findMine(c, b.id) : active(c)
    if (!i) return err(404, 'not_found', 'Interview not found.')
    if (i.status !== 'in_progress' && a !== 'resume') return err(409, 'not_running', 'This interview has ended.')
    if (a === 'resume' || a === 'heartbeat') {
      charge(i)
      return { body: { session: publicSession(i), messages: a === 'resume' ? i.messages : undefined, draft: a === 'resume' ? i.draft : undefined } }
    }
    charge(i)
    if (i.status !== 'in_progress') return { body: { session: publicSession(i), messages: i.messages, ended: true } }
    if (a === 'submit_answer') {
      const text = String(b.text || '').trim()
      if (!text) return err(400, 'empty_answer', 'Say or edit your answer before submitting.')
      if (text.length > MAX_ANSWER) return err(400, 'too_long', 'That answer is too long. Keep it under 4,000 characters.')
      const last = i.messages.at(-1)
      if (last.role === 'candidate') return err(409, 'duplicate', 'Answer already submitted.')
      if (bytes(i) + text.length > 200_000) return err(413, 'session_too_large', 'This interview is too large to continue.')
      addMsg(i, 'candidate', text)
      i.draft = null
      return { body: { session: publicSession(i), message: i.messages.at(-1) } }
    }
    if (a === 'next_question') {
      if (i.messages.at(-1).role !== 'candidate') return err(409, 'out_of_order', 'Submit an answer first.')
      await sleep(900)
      if (c.st.flags.busyNext) { c.st.flags.busyNext = false; return err(429, 'ai_busy', 'The AI is busy or the free limit was reached. Your answer is saved. Try again.', true) }
      const m = addMsg(i, 'interviewer', nextQuestion(i))
      i.size_bytes = bytes(i)
      charge(i)
      return { body: { session: publicSession(i), message: m } }
    }
    if (a === 'skip') {
      if (i.skips_used >= MAX_SKIPS) return err(409, 'no_skips', 'No skips left.')
      const lastQ = i.messages.at(-1)
      if (lastQ.role !== 'interviewer') return err(409, 'out_of_order', 'Nothing to skip.')
      lastQ.skipped = true
      i.skips_used += 1
      i.draft = null
      await sleep(600)
      const m = addMsg(i, 'interviewer', nextQuestion(i))
      return { body: { session: publicSession(i), message: m } }
    }
    if (a === 'end') {
      // The browser sends its latest text with End so nothing typed since the last autosave is lost.
      if (typeof b.draft === 'string') storeDraft(i, b.draft, b.at)
      finish(i, b.reason === 'time_up' ? 'time_up' : 'user_ended')
      return { body: { session: publicSession(i), messages: i.messages } }
    }
    return err(400, 'unknown_action', 'Unknown action.')
  }

  // Autosave of the answer being spoken or edited. Has its own rate bucket so it never blocks real actions.
  function storeDraft(i, raw, at) {
    const q = i.messages.at(-1)
    if (q?.role !== 'interviewer') return false
    const text = String(raw).slice(0, MAX_ANSWER)
    i.draft = text.trim() ? { text, for_seq: q.seq, at: Number(at) || Date.now() } : null
    return true
  }
  function saveDraft(b, c) {
    if (limited(c, 'draft')) return err(429, 'rate_limited', 'Autosave is going too quickly.', true)
    const i = findMine(c, b.id)
    if (!i) return err(404, 'not_found', 'Interview not found.')
    charge(i)
    if (i.status !== 'in_progress') return { body: { session: publicSession(i), ended: true } }
    if (!storeDraft(i, b.text ?? '', b.at)) return err(409, 'out_of_order', 'There is no open question to answer.')
    return { body: { saved: true, timer_remaining_ms: i.timer_remaining_ms } }
  }

  // Mock evaluator: transparent heuristics so scores respond to what the user said. Deterministic: same answers, same scores.
  function generateFeedback(i) {
    const answers = i.messages.filter((m) => m.role === 'candidate' && m.submitted).map((m) => m.content)
    const all = answers.join(' ')
    const avgWords = all.split(/\s+/).filter(Boolean).length / Math.max(1, answers.length)
    const comps = S.CATEGORIES[i.category].competencies.map((name) => {
      const re = S.KEYWORDS[name.toLowerCase()]
      const hits = re ? (all.match(new RegExp(re.source, 'gi')) || []).length : 0
      const raw = 1.8 + Math.min(1.4, avgWords / 55) + Math.min(1.2, hits * 0.3)
      const score = Math.max(1, Math.min(5, Math.round(raw * 2) / 2))
      const sentence = answers.flatMap((t) => t.split(/(?<=[.!?])\s+/)).find((s) => re && new RegExp(re.source, 'i').test(s))
      const band = score >= 4 ? 'Strong' : score >= 3 ? 'Solid' : 'Needs work'
      const explanation = { Strong: `You handled ${name.toLowerCase()} with clear reasoning.`, Solid: `Reasonable on ${name.toLowerCase()}, but the reasoning could be more explicit.`, 'Needs work': `${name} was thin. Be more specific and show your reasoning step by step.` }[band] + (sentence ? ` Evidence: "${sentence.slice(0, 140)}"` : '')
      return { name, score, explanation }
    })
    const sorted = [...comps].sort((a, b) => b.score - a.score)
    return {
      competency_scores: comps,
      strengths: sorted.slice(0, 2).map((c) => (c.score >= 4 ? `${c.name}: clear, well-reasoned answers.` : `${c.name}: a solid base to build on (${c.score}/5).`)),
      improvement_areas: sorted.slice(-2).reverse().map((c) => c.name),
      suggestions: [`Spend your first 30 seconds on structure before answering ${S.CATEGORIES[i.category].label.toLowerCase()} questions.`, 'Name the trade-off you are accepting whenever you pick an option.', 'Close each answer with how you would measure success.'],
      model: 'mock-evaluator-1',
    }
  }

  function feedback(b, c) {
    if (limited(c, 'feedback')) return err(429, 'rate_limited', 'Too many requests. Wait a minute and try again.', true)
    const i = findMine(c, b.id)
    if (!i) return err(404, 'not_found', 'Interview not found.')
    if (i.status === 'in_progress') return err(409, 'not_finished', 'End the interview first.')
    if (i.feedback_status === 'ready' || i.feedback_status === 'pending') return { body: { session: publicSession(i) } }
    const answers = i.messages.filter((m) => m.role === 'candidate' && m.submitted).map((m) => m.content)
    if (!answers.length) { i.feedback_status = 'not_available'; return { body: { session: publicSession(i) } } }
    if (i.feedback_attempts >= 5) return err(429, 'too_many_attempts', 'Report attempts used up for this interview.')
    i.feedback_attempts += 1
    i.feedback_status = 'pending'
    const flags = c.st.flags
    setTimeout(() => {
      if (flags.feedbackFailNext) { flags.feedbackFailNext = false; i.feedback_status = 'failed'; persist(); return }
      const checked = guard.checkFeedback(generateFeedback(i), { competencies: S.CATEGORIES[i.category].competencies, answers })
      if (!checked.ok) { console.warn('guard rejected feedback:', checked.reason); i.feedback_status = 'failed'; persist(); return }
      i.feedback = checked.feedback
      i.feedback_status = 'ready'
      i.size_bytes = bytes(i)
      persist()
    }, 2800)
    return { body: { session: publicSession(i) } }
  }

  // ---------- option features ----------
  const scoreRes = (c, r) => r.up + (c.st.resourceVotes[r.id] || 0) + r.expertUp * 3
  const resources = (c) => S.RESOURCES.map((r) => ({ ...r, voted: c.st.resourceVotes[r.id] || 0, score: scoreRes(c, r) }))
  const avgByCategory = (c) => {
    const by = {}
    mine(c).filter((i) => i.feedback).forEach((i) => ((by[i.category] ||= []).push(i.feedback.overall_score)))
    return Object.keys(S.CATEGORIES).map((k) => ({ area: k, label: S.CATEGORIES[k].label, score: by[k] ? Math.round((by[k].reduce((a, b) => a + b, 0) / by[k].length) * 10) / 10 : null }))
  }

  function roadmap(b, c) {
    const hours = Math.max(1, Math.min(40, Number(b.hoursPerWeek) || 5))
    const weeks = Math.max(1, Math.min(12, Number(b.weeks) || 3))
    const areas = (b.areas || []).filter((a) => a.area)
    if (!areas.length) return err(400, 'invalid_input', 'Pick at least one area to work on.')
    const budget = hours * weeks * 60
    const weight = (a) => (a.score == null ? 3 : Math.max(0.5, 5.5 - a.score)) // lower score = more time
    const totalW = areas.reduce((n, a) => n + weight(a), 0)
    const tierRank = { must: 0, should: 1, could: 2 }
    const all = resources(c)
    const picked = [], later = []
    const queues = areas.map((a) => {
      let left = (budget * weight(a)) / totalW
      const list = all.filter((r) => r.topics.includes(a.area) && !picked.some((p) => p.id === r.id)).sort((x, y) => tierRank[x.tier] - tierRank[y.tier] || y.score - x.score)
      const q = []
      list.forEach((r) => { if (r.minutes <= left && !picked.some((p) => p.id === r.id)) { left -= r.minutes; picked.push(r); q.push({ ...r, area: a.area }) } else later.push({ ...r, area: a.area }) })
      return q
    })
    // second pass: use any leftover time on the best remaining resources for the chosen areas
    let spare = budget - picked.reduce((n, r) => n + r.minutes, 0)
    const extras = []
    later.filter((r, k, arr) => arr.findIndex((z) => z.id === r.id) === k && !picked.some((p) => p.id === r.id))
      .sort((x, y) => tierRank[x.tier] - tierRank[y.tier] || y.score - x.score)
      .forEach((r) => { if (r.minutes <= spare) { spare -= r.minutes; picked.push(r); extras.push(r) } })
    // interleave by priority (largest gap first), then fill weeks sequentially
    const order = []
    const sortedIdx = areas.map((a, k) => k).sort((x, y) => weight(areas[y]) - weight(areas[x]))
    while (queues.some((q) => q.length)) sortedIdx.forEach((k) => queues[k].length && order.push(queues[k].shift()))
    order.push(...extras)
    const plan = Array.from({ length: weeks }, (_, w) => ({ week: w + 1, minutes: 0, items: [] }))
    const spill = []
    order.forEach((r) => {
      const slot = plan.find((p) => p.minutes + r.minutes <= hours * 60)
      slot ? (slot.items.push(r), (slot.minutes += r.minutes)) : spill.push(r)
    })
    const mustTotal = all.filter((r) => r.tier === 'must' && areas.some((a) => r.topics.includes(a.area))).length
    const mustCovered = picked.filter((r) => r.tier === 'must').length
    const dedupe = (arr) => arr.filter((r, k) => arr.findIndex((z) => z.id === r.id) === k && !picked.some((p) => p.id === r.id))
    return { body: { weeks: plan, budgetMinutes: budget, plannedMinutes: plan.reduce((n, p) => n + p.minutes, 0), mustTotal, mustCovered, notFitted: dedupe([...later, ...spill]).slice(0, 8) } }
  }

  function parseTranscript(text) {
    const turns = []
    text.split(/\n+/).map((l) => l.trim()).filter(Boolean).forEach((line) => {
      const m = line.match(/^(interviewer|i|q|them|me|candidate|c|a|you)\s*[:\-]\s*(.+)$/i)
      if (m) turns.push({ speaker: /^(interviewer|i|q|them)$/i.test(m[1]) ? 'interviewer' : 'candidate', text: m[2] })
      else if (turns.length) turns[turns.length - 1].text += ' ' + line
    })
    return turns
  }

  const days = () => S.dayKeys()
  const peerView = (c, p) => {
    const overlap = p.availability.filter((s) => c.st.myAvailability.has(s))
    return { id: p.id, name: p.name, level: p.level, focus: p.focus, bio: p.bio, availability: p.availability, overlap }
  }
  const toolView = (c, t) => {
    const reports = db.toolReports[t.id] || []
    const infl = reports.length ? Math.round(((t.influence * 5 + reports.reduce((n, r) => n + r.impact, 0)) / (5 + reports.length)) * 10) / 10 : t.influence
    return { ...t, influence: infl, up: t.up + (c.st.toolVotes[t.id] || 0), voted: c.st.toolVotes[t.id] || 0, reports: reports.map(({ user_id, ...r }) => r) }
  }

  // ---------- router ----------
  const routes = []
  const on = (method, path, fn, open = false) => routes.push({ method, re: new RegExp('^' + path.replace(/:\w+/g, '([^/]+)') + '$'), fn, open })

  const signIn = (u) => { const token = newToken(); db.tokens.set(token, u.id); if (!db.state.has(u.id)) db.state.set(u.id, userState()); return token }
  const issueVerification = (u) => {
    u.verify = { token: newToken(), expires: Date.now() + VERIFY_TTL_MS }
    const path = `/verify-email?token=${u.verify.token}`
    if (!DEV_TOOLS) console.log(`[mock email] verification link for ${u.email}: ${path}`)
    return DEV_TOOLS ? { dev_verify_url: path } : {}
  }
  const findByEmail = (email) => [...db.users.values()].find((u) => u.email === email)

  on('POST', '/api/auth/login', async (b) => {
    if (!b.email || !b.password) return err(400, 'invalid_input', 'Enter your email and password.')
    const u = findByEmail(String(b.email).trim().toLowerCase())
    if (!u || !(await passwordMatches(b.password, u.pw))) return err(401, 'invalid_credentials', 'Email or password is incorrect.')
    return { body: { token: signIn(u), user: publicUser(u) } }
  }, true)
  on('POST', '/api/auth/signup', async (b) => {
    const email = String(b.email || '').trim().toLowerCase()
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || !b.password || String(b.password).length < 8) return err(400, 'invalid_input', 'Use a valid email and a password of at least 8 characters.')
    if (findByEmail(email)) return err(409, 'email_taken', 'An account with this email already exists. Log in instead.')
    const u = { id: 'u' + rid(), email, name: String(b.name || email.split('@')[0]).trim().slice(0, 60), verified: false, pw: await hashPassword(b.password), verify: null }
    db.users.set(u.id, u)
    const dev = issueVerification(u)
    return { body: { token: signIn(u), user: publicUser(u), ...dev } }
  }, true)
  // Prototype stand-in for Google sign-in: Google has already verified the address, so the account is verified.
  on('POST', '/api/auth/google', async () => {
    let u = db.users.get(DEMO.id)
    if (!u) { u = (await fresh()).users.get(DEMO.id); db.users.set(u.id, u) } // demo account was deleted: recreate it empty
    return { body: { token: signIn(u), user: publicUser(u) } }
  }, true)
  on('POST', '/api/auth/verify', (b) => {
    const u = [...db.users.values()].find((x) => x.verify && x.verify.token === String(b.token || ''))
    if (!u || u.verify.expires < Date.now()) return err(400, 'invalid_token', 'This verification link is invalid or has expired. Send a new one from your dashboard.')
    u.verified = true
    u.verify = null
    return { body: { user: publicUser(u) } }
  }, true)
  on('POST', '/api/auth/resend-verification', (b, c) => {
    if (c.user.verified) return { body: { user: publicUser(c.user) } }
    if (limited(c, 'verify')) return err(429, 'rate_limited', 'Wait a minute before asking for another email.', true)
    return { body: { sent: true, ...issueVerification(c.user) } }
  })
  on('POST', '/api/auth/logout', (b, c) => { db.tokens.delete(c.token); return { body: { ok: true } } })
  on('GET', '/api/me', (b, c) => ({ body: { user: publicUser(c.user) } }))
  on('PATCH', '/api/me', (b, c) => { if (b.name) c.user.name = String(b.name).trim().slice(0, 60) || c.user.name; return { body: { user: publicUser(c.user) } } })
  on('POST', '/api/delete-account', (b, c) => {
    if (b.confirm !== 'DELETE') return err(400, 'confirm_required', 'Type DELETE to confirm.')
    const uid = c.user.id
    db.interviews = db.interviews.filter((i) => i.owner_id !== uid)
    db.experiences = db.experiences.filter((e) => e.author_id !== uid)
    db.experiences.forEach((e) => { e.reviews = e.reviews.filter((r) => r.reviewer_id !== uid) })
    Object.keys(db.toolReports).forEach((k) => { db.toolReports[k] = db.toolReports[k].filter((r) => r.user_id !== uid) })
    for (const [t, owner] of db.tokens) if (owner === uid) db.tokens.delete(t)
    db.state.delete(uid)
    db.users.delete(uid)
    return { body: { deleted: true } }
  })

  on('POST', '/api/interview-engine', engine)
  on('POST', '/api/interview-feedback', feedback)
  on('GET', '/api/interviews', (b, c) => ({ body: { interviews: mine(c).map(publicSession), storage: storage(c) } }))
  on('GET', '/api/interviews/:id', (b, c, id) => {
    const i = findMine(c, id)
    return i ? { body: { session: publicSession(i), messages: i.messages, feedback: i.feedback } } : err(404, 'not_found', 'Interview not found.')
  })
  on('DELETE', '/api/interviews/:id', (b, c, id) => {
    const i = findMine(c, id)
    if (!i) return err(404, 'not_found', 'Interview not found.')
    if (i.status === 'in_progress') return err(409, 'in_progress', 'End this interview before deleting it.')
    db.interviews = db.interviews.filter((x) => x !== i)
    return { body: { deleted: true, storage: storage(c) } }
  })
  on('POST', '/api/interviews/:id/rating', (b, c, id) => {
    const i = findMine(c, id)
    if (!i) return err(404, 'not_found', 'Interview not found.')
    if (i.status === 'in_progress') return err(409, 'not_finished', 'Finish the interview before rating it.')
    const rating = Number(b.rating)
    if (!(rating >= 1 && rating <= 5)) return err(400, 'invalid_input', 'Choose 1 to 5 stars.')
    i.rating = { rating, comment: String(b.comment || '').slice(0, 500) }
    return { body: { rating: i.rating } }
  })

  // Prototype switches so the fallback screens can be shown on demand. Not available in production.
  if (DEV_TOOLS) {
    on('POST', '/api/_dev/flags', (b, c) => { const f = c.st.flags; if (typeof b.busyNext === 'boolean') f.busyNext = b.busyNext; if (typeof b.feedbackFailNext === 'boolean') f.feedbackFailNext = b.feedbackFailNext; return { body: f } })
    on('POST', '/api/_dev/reset', async () => { await reset(); return { body: { ok: true } } }, true)
  }

  // Proof of concept: stateless, saves nothing. Outputs still go through the guard.
  on('POST', '/api/interview-ai', async (b) => {
    await sleep(600)
    const ans = String(b.answer || '')
    if (b.action === 'opening') return { body: { text: S.QUESTION_TEMPLATES['product-sense'](ctxFor(null)) } }
    if (!ans.trim()) return err(400, 'empty_answer', 'Write a short answer first.')
    if (b.action === 'followup') {
      const q = guard.checkQuestion(ans.split(/\s+/).length < 25 ? S.GENERIC_FOLLOWUPS.shortAnswer : S.FOLLOWUPS['product-sense'][0])
      return { body: { text: q.ok ? q.text : WRAP_UP } }
    }
    if (b.action === 'evaluate') { const w = ans.split(/\s+/).length; return { body: { score: Math.min(5, Math.max(1, Math.round(1 + w / 25))), note: 'Test evaluation based on length and structure only.' } } }
    return err(400, 'unknown_action', 'Unknown action.')
  })

  // Option 1: industries
  on('GET', '/api/industries', () => ({ body: { industries: S.INDUSTRIES.map((x) => ({ ...x, questions: Object.fromEntries(Object.keys(S.CATEGORIES).map((k) => [k, S.QUESTION_TEMPLATES[k](x)])) })) } }))

  // Option 2: experience library (shared community content; authors are never named to other users)
  const expView = (c, e) => ({
    ...e,
    author_id: undefined,
    author: e.author_id ? (e.author_id === c.user.id ? 'You' : 'Community member') : e.author,
    mine: e.author_id === c.user.id,
    helpfulCount: e.helpful + (c.st.experienceHelpful.has(e.id) ? 1 : 0),
    helpedByMe: c.st.experienceHelpful.has(e.id),
    reviews: e.reviews.map(({ reviewer_id, ...r }) => ({ ...r, reviewer: r.reviewer || S.EXPERTS.find((x) => x.id === r.expertId) })),
    avgExpert: e.reviews.length ? Math.round((e.reviews.reduce((n, r) => n + r.rating, 0) / e.reviews.length) * 10) / 10 : null,
  })
  on('GET', '/api/experiences', (b, c) => ({ body: { experiences: db.experiences.map((e) => expView(c, e)), experts: S.EXPERTS } }))
  on('POST', '/api/experiences/parse', async (b) => {
    await sleep(1600)
    if (b.sampleAudio) return { body: { turns: S.SAMPLE_AUDIO_TRANSCRIPT, detected: { industry: 'Communication', round: 'Product sense' }, source: 'audio' } }
    const turns = parseTranscript(String(b.text || ''))
    return turns.length ? { body: { turns, source: 'text' } } : err(422, 'unparseable', 'Could not find turns. Start lines with "Interviewer:" and "Me:".')
  })
  on('POST', '/api/experiences', (b, c) => {
    const { company, role, industry, round, turns } = b
    if (!company?.trim() || !role?.trim() || !industry || !Array.isArray(turns) || turns.length < 2) return err(400, 'invalid_input', 'Add company, role, industry and at least two turns.')
    const e = { id: 'e' + rid(), author_id: c.user.id, company: company.trim().slice(0, 80), role: role.trim().slice(0, 80), industry, round: round || 'General', level: /associate|apm/i.test(role) ? 'APM' : 'PM', outcome: b.outcome || 'Pending', posted: new Date().toISOString(), helpful: 0, summary: String(b.summary || turns[0].text).slice(0, 160), turns: turns.slice(0, 40).map((t) => ({ speaker: t.speaker === 'interviewer' ? 'interviewer' : 'candidate', text: String(t.text).slice(0, 1200), note: t.note })), reviews: [] }
    db.experiences.unshift(e)
    return { body: { experience: expView(c, e) } }
  })
  on('POST', '/api/experiences/:id/helpful', (b, c, id) => { const h = c.st.experienceHelpful; h.has(id) ? h.delete(id) : h.add(id); return { body: { ok: true } } })
  on('POST', '/api/experiences/:id/reviews', (b, c, id) => {
    const e = db.experiences.find((x) => x.id === id)
    if (!e) return err(404, 'not_found', 'Experience not found.')
    const rating = Number(b.rating)
    if (!b.name?.trim() || !b.role?.trim() || !(Number(b.years) >= 0) || !(rating >= 1 && rating <= 5) || !b.comment?.trim()) return err(400, 'invalid_input', 'Add your name, role, years of experience, a 1 to 5 ranking and a comment.')
    e.reviews.push({ expertId: null, reviewer_id: c.user.id, rating, verdict: String(b.verdict || '').slice(0, 60), comment: String(b.comment).slice(0, 800), reviewer: { id: 'self', name: b.name.trim().slice(0, 60), role: b.role.trim().slice(0, 80), years: Number(b.years), verified: false } })
    return { body: { experience: expView(c, e) } }
  })

  // Option 3: peer mocks
  on('GET', '/api/peers', (b, c) => ({ body: { days: days(), hours: S.SLOT_HOURS, mine: [...c.st.myAvailability], peers: S.PEERS.map((p) => peerView(c, p)), bookings: c.st.bookings } }))
  on('PUT', '/api/availability', (b, c) => {
    const valid = new Set(days().flatMap((d) => S.SLOT_HOURS.map((h) => `${d}@${h}`)))
    c.st.myAvailability = new Set((b.slots || []).filter((s) => valid.has(s)))
    return { body: { mine: [...c.st.myAvailability] } }
  })
  on('POST', '/api/bookings', (b, c) => {
    const p = S.PEERS.find((x) => x.id === b.peerId)
    if (!p) return err(404, 'not_found', 'Peer not found.')
    if (!p.availability.includes(b.slot) || !c.st.myAvailability.has(b.slot)) return err(409, 'slot_unavailable', 'Both of you need to be free in that slot.')
    if (c.st.bookings.some((x) => x.slot === b.slot && x.status !== 'cancelled')) return err(409, 'slot_taken', 'You already have a session at that time.')
    const bk = { id: 'b' + rid(), peerId: p.id, peerName: p.name, slot: b.slot, focus: S.CATEGORIES[b.focus] ? b.focus : p.focus[0], status: 'confirmed', feedbackGiven: null }
    c.st.bookings.push(bk)
    return { body: { booking: bk } }
  })
  on('POST', '/api/bookings/:id/cancel', (b, c, id) => { const bk = c.st.bookings.find((x) => x.id === id); if (bk) bk.status = 'cancelled'; return { body: { ok: true } } })
  on('POST', '/api/bookings/:id/feedback', (b, c, id) => {
    const bk = c.st.bookings.find((x) => x.id === id)
    if (!bk) return err(404, 'not_found', 'Session not found.')
    const clamp = (v) => Math.max(1, Math.min(5, Number(v) || 3))
    bk.feedbackGiven = { structure: clamp(b.structure), depth: clamp(b.depth), communication: clamp(b.communication), comment: String(b.comment || '').slice(0, 600) }
    bk.status = 'done'
    return { body: { booking: bk } }
  })

  // Option 4: resources + roadmap
  on('GET', '/api/resources', (b, c) => ({ body: { resources: resources(c), gaps: avgByCategory(c) } }))
  on('POST', '/api/resources/:id/vote', (b, c, id) => {
    if (!S.RESOURCES.some((r) => r.id === id)) return err(404, 'not_found', 'Resource not found.')
    const v = b.vote === 1 ? 1 : b.vote === -1 ? -1 : 0
    c.st.resourceVotes[id] = c.st.resourceVotes[id] === v ? 0 : v
    return { body: { resources: resources(c) } }
  })
  on('POST', '/api/roadmap', roadmap)

  // Option 5: AI tools
  on('GET', '/api/ai-tools', (b, c) => ({ body: { tools: S.AI_TOOLS.map((t) => toolView(c, t)), industries: [...new Set(S.AI_TOOLS.flatMap((t) => t.industries))].sort(), categories: [...new Set(S.AI_TOOLS.map((t) => t.category))] } }))
  on('POST', '/api/ai-tools/:id/vote', (b, c, id) => {
    if (!S.AI_TOOLS.some((t) => t.id === id)) return err(404, 'not_found', 'Tool not found.')
    c.st.toolVotes[id] = c.st.toolVotes[id] ? 0 : 1
    return { body: { tool: toolView(c, S.AI_TOOLS.find((t) => t.id === id)) } }
  })
  on('POST', '/api/ai-tools/:id/reports', (b, c, id) => {
    const t = S.AI_TOOLS.find((x) => x.id === id)
    if (!t) return err(404, 'not_found', 'Tool not found.')
    const impact = Number(b.impact)
    if (!b.use?.trim() || !b.industry || !(impact >= 1 && impact <= 5)) return err(400, 'invalid_input', 'Say what you use it for, your industry and the impact from 1 to 5.')
    ;(db.toolReports[id] ||= []).unshift({ user_id: c.user.id, use: b.use.trim().slice(0, 200), industry: b.industry, impact, role: String(b.role || 'PM').slice(0, 60), when: 'Just now' })
    return { body: { tool: toolView(c, t) } }
  })

  // One request in, one { status, body } out. Identity comes from the bearer token, never from the request body.
  return async function dispatch({ method, path, token, body = {} }) {
    await ready
    const route = routes.find((r) => r.method === method && r.re.test(path))
    if (!route) return { status: 404, body: { error: { code: 'not_found', message: 'Unknown endpoint.' } } }
    const user = db.users.get(db.tokens.get(token || ''))
    if (!route.open && !user) return { status: 401, body: { error: { code: 'unauthorized', message: 'Sign in again.' } } }
    const ctx = { user, token, st: user ? db.state.get(user.id) : null }
    try {
      const out = await route.fn(body, ctx, ...path.match(route.re).slice(1))
      return { status: out.status || 200, body: out.body }
    } catch (e) {
      console.error(e)
      return { status: 500, body: { error: { code: 'server_error', message: 'Something went wrong on our side. Try again.', retryable: true } } }
    } finally {
      persist()
    }
  }
}
