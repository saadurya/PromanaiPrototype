// Mock backend for the ProManAI prototype. In-memory, single demo user, no real AI.
// It mirrors the doc: server owns the timer, skips and scores; the browser only displays.
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import * as S from './seed.js'

const PORT = process.env.PORT || 8787
const TOTAL_MS = 20 * 60 * 1000
const MAX_SKIPS = 2
const MAX_GAP_MS = 30_000 // doc: at most ~30s lost per gap
const STORAGE_LIMIT = 5 * 1024 * 1024
const RATE = { engine: 20, feedback: 6 } // per minute
const sleep = (ms) => new Promise((r) => setTimeout(r, ms))
const rid = () => Math.random().toString(36).slice(2, 9)

function fresh() {
  return {
    user: null,
    interviews: S.seedInterviews(),
    experiences: structuredClone(S.EXPERIENCES),
    myAvailability: new Set(),
    bookings: [],
    resourceVotes: {},
    toolVotes: {},
    toolReports: {},
    experienceHelpful: new Set(),
    flags: { busyNext: false, feedbackFailNext: false },
    hits: { engine: [], feedback: [] },
  }
}
export function createApp() {
  let db = fresh()
  const reset = () => (db = fresh())
  const err = (status, code, message, retryable = false) => ({ status, body: { error: { code, message, retryable } } })

  const limited = (kind) => {
    const now = Date.now()
    db.hits[kind] = db.hits[kind].filter((t) => now - t < 60_000)
    if (db.hits[kind].length >= RATE[kind]) return true
    db.hits[kind].push(now)
    return false
  }

  const bytes = (i) => i.messages.reduce((n, m) => n + Buffer.byteLength(m.content), 0) + 600
  const storageUsed = () => db.interviews.reduce((n, i) => n + i.size_bytes, 0)
  const publicSession = (i) => ({ ...i, messages: undefined, feedback: undefined, has_feedback: !!i.feedback })
  const active = () => db.interviews.find((i) => i.status === 'in_progress')

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

  // Mock "Gemini": picks an unseen question based on simple features of the last answer.
  function nextQuestion(i, opts = {}) {
    const asked = new Set(i.messages.filter((m) => m.role === 'interviewer').map((m) => m.content))
    const lastAnswer = [...i.messages].reverse().find((m) => m.role === 'candidate')?.content || ''
    const words = lastAnswer.trim().split(/\s+/).filter(Boolean).length
    const pool = []
    if (opts.opening) return S.QUESTION_TEMPLATES[i.category](ctxFor(i.industry)) + S.HARD_SUFFIX[i.difficulty]
    if (i.timer_remaining_ms < 180_000) pool.push('We are short on time. In two sentences, what is your single most important recommendation?')
    if (words < 25) pool.push(S.GENERIC_FOLLOWUPS.shortAnswer)
    if (!/user|customer|segment/i.test(lastAnswer) && i.category === 'product-sense') pool.push(S.GENERIC_FOLLOWUPS.noUser)
    if (!/metric|measure|kpi|rate/i.test(lastAnswer) && i.category !== 'behavioral') pool.push(S.GENERIC_FOLLOWUPS.noMetric)
    if (!/trade|instead|cost|versus/i.test(lastAnswer)) pool.push(S.GENERIC_FOLLOWUPS.noTradeoff)
    pool.push(...S.FOLLOWUPS[i.category])
    return pool.find((q) => !asked.has(q)) || 'Is there anything you would like to add before we wrap up?'
  }

  function guardOwner(i) {
    return i ? null : err(404, 'not_found', 'Interview not found.')
  }

  async function engine(body) {
    if (limited('engine')) return err(429, 'rate_limited', 'You are going too quickly. Wait a few seconds and try again.', true)
    const a = body.action
    if (a === 'status') {
      const i = active()
      if (i) charge(i)
      const cur = active()
      return { body: { active: cur ? publicSession(cur) : null, storage: { used: storageUsed(), limit: STORAGE_LIMIT } } }
    }
    if (a === 'start') {
      if (!db.user?.verified) return err(403, 'email_unverified', 'Verify your email to start an interview.')
      if (active()) return err(409, 'already_running', 'You already have an interview in progress.')
      if (storageUsed() > STORAGE_LIMIT - 20_000) return err(409, 'storage_full', 'Storage is full. Download and delete your oldest interview first.')
      const { level, category, difficulty, industry } = body
      if (!['APM', 'PM'].includes(level) || !S.CATEGORIES[category] || !['easy', 'medium', 'hard'].includes(difficulty)) return err(400, 'invalid_input', 'Choose a level, category and difficulty.')
      if (industry && !S.INDUSTRIES.some((x) => x.id === industry)) return err(400, 'invalid_input', 'Unknown industry.')
      const i = { id: 'i' + rid(), level, category, difficulty, industry: industry || null, status: 'in_progress', feedback_status: 'none', timer_remaining_ms: TOTAL_MS, skips_used: 0, end_reason: null, created_at: new Date().toISOString(), size_bytes: 0, rating: null, feedback_attempts: 0, messages: [], last_tick: Date.now(), feedback: null }
      db.interviews.unshift(i)
      await sleep(700)
      const first = db.user.name.split(' ')[0]
      addMsg(i, 'interviewer', `Hi ${first}, thanks for joining. ${nextQuestion(i, { opening: true })}`)
      return { body: { session: publicSession(i), messages: i.messages } }
    }
    const i = body.id ? db.interviews.find((x) => x.id === body.id) : active()
    const miss = guardOwner(i)
    if (miss) return miss
    if (i.status !== 'in_progress' && a !== 'resume') return err(409, 'not_running', 'This interview has ended.')
    if (a === 'resume' || a === 'heartbeat') {
      charge(i)
      return { body: { session: publicSession(i), messages: a === 'resume' ? i.messages : undefined } }
    }
    charge(i)
    if (i.status !== 'in_progress') return { body: { session: publicSession(i), messages: i.messages, ended: true } }
    if (a === 'submit_answer') {
      const text = String(body.text || '').trim()
      if (!text) return err(400, 'empty_answer', 'Say or edit your answer before submitting.')
      if (text.length > 4000) return err(400, 'too_long', 'That answer is too long. Keep it under 4,000 characters.')
      const last = i.messages.at(-1)
      if (last.role === 'candidate') return err(409, 'duplicate', 'Answer already submitted.')
      if (bytes(i) + text.length > 200_000) return err(413, 'session_too_large', 'This interview is too large to continue.')
      addMsg(i, 'candidate', text)
      return { body: { session: publicSession(i), message: i.messages.at(-1) } }
    }
    if (a === 'next_question') {
      if (i.messages.at(-1).role !== 'candidate') return err(409, 'out_of_order', 'Submit an answer first.')
      await sleep(900)
      if (db.flags.busyNext) { db.flags.busyNext = false; return err(429, 'ai_busy', 'The AI is busy or the free limit was reached. Your answer is saved. Try again.', true) }
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
      await sleep(600)
      const m = addMsg(i, 'interviewer', nextQuestion(i))
      return { body: { session: publicSession(i), message: m } }
    }
    if (a === 'end') {
      finish(i, body.reason === 'time_up' ? 'time_up' : 'user_ended')
      return { body: { session: publicSession(i), messages: i.messages } }
    }
    return err(400, 'unknown_action', 'Unknown action.')
  }

  // Mock evaluator: transparent heuristics so scores respond to what the user said.
  function generateFeedback(i) {
    const answers = i.messages.filter((m) => m.role === 'candidate' && m.submitted).map((m) => m.content)
    const all = answers.join(' ')
    const avgWords = all.split(/\s+/).filter(Boolean).length / Math.max(1, answers.length)
    const comps = S.CATEGORIES[i.category].competencies.map((name, idx) => {
      const re = S.KEYWORDS[name.toLowerCase()]
      const hits = re ? (all.match(new RegExp(re.source, 'gi')) || []).length : 0
      const jitter = (((i.id.charCodeAt(1) || 1) * (idx + 3)) % 7) / 10 - 0.3
      const raw = 1.8 + Math.min(1.4, avgWords / 55) + Math.min(1.2, hits * 0.3) + jitter
      const score = Math.max(1, Math.min(5, Math.round(raw * 2) / 2))
      const sentence = answers.flatMap((t) => t.split(/(?<=[.!?])\s+/)).find((s) => re && new RegExp(re.source, 'i').test(s))
      const band = score >= 4 ? 'Strong' : score >= 3 ? 'Solid' : 'Needs work'
      const explanation = { Strong: `You handled ${name.toLowerCase()} with clear reasoning.`, Solid: `Reasonable on ${name.toLowerCase()}, but the reasoning could be more explicit.`, 'Needs work': `${name} was thin. Be more specific and show your reasoning step by step.` }[band] + (sentence ? ` Evidence: "${sentence.slice(0, 140)}"` : '')
      return { name, score, explanation }
    })
    const overall = Math.round((comps.reduce((n, c) => n + c.score, 0) / comps.length) * 10) / 10
    const sorted = [...comps].sort((a, b) => b.score - a.score)
    return {
      overall_score: overall,
      explanation: `Overall ${overall}/5 across ${comps.length} competencies, computed by the server as the average of competency scores.`,
      competency_scores: comps,
      strengths: sorted.slice(0, 2).map((c) => (c.score >= 4 ? `${c.name}: clear, well-reasoned answers.` : `${c.name}: a solid base to build on (${c.score}/5).`)),
      improvement_areas: sorted.slice(-2).reverse().map((c) => c.name),
      suggestions: [`Spend your first 30 seconds on structure before answering ${S.CATEGORIES[i.category].label.toLowerCase()} questions.`, 'Name the trade-off you are accepting whenever you pick an option.', 'Close each answer with how you would measure success.'],
      model: 'mock-evaluator-1',
    }
  }

  function feedback(body) {
    if (limited('feedback')) return err(429, 'rate_limited', 'Too many requests. Wait a minute and try again.', true)
    const i = db.interviews.find((x) => x.id === body.id)
    const miss = guardOwner(i)
    if (miss) return miss
    if (i.status === 'in_progress') return err(409, 'not_finished', 'End the interview first.')
    if (i.feedback_status === 'ready' || i.feedback_status === 'pending') return { body: { session: publicSession(i) } }
    if (!i.messages.some((m) => m.role === 'candidate' && m.submitted)) { i.feedback_status = 'not_available'; return { body: { session: publicSession(i) } } }
    if (i.feedback_attempts >= 5) return err(429, 'too_many_attempts', 'Report attempts used up for this interview.')
    i.feedback_attempts += 1
    i.feedback_status = 'pending'
    setTimeout(() => {
      if (db.flags.feedbackFailNext) { db.flags.feedbackFailNext = false; i.feedback_status = 'failed'; return }
      i.feedback = generateFeedback(i)
      i.feedback_status = 'ready'
    }, 2800)
    return { body: { session: publicSession(i) } }
  }

  // ---------- option features ----------
  const scoreRes = (r) => r.up + (db.resourceVotes[r.id] || 0) + r.expertUp * 3
  const resources = () => S.RESOURCES.map((r) => ({ ...r, voted: db.resourceVotes[r.id] || 0, score: scoreRes(r) }))
  const avgByCategory = () => {
    const by = {}
    db.interviews.filter((i) => i.feedback).forEach((i) => ((by[i.category] ||= []).push(i.feedback.overall_score)))
    return Object.keys(S.CATEGORIES).map((c) => ({ area: c, label: S.CATEGORIES[c].label, score: by[c] ? Math.round((by[c].reduce((a, b) => a + b, 0) / by[c].length) * 10) / 10 : null }))
  }

  function roadmap(body) {
    const hours = Math.max(1, Math.min(40, Number(body.hoursPerWeek) || 5))
    const weeks = Math.max(1, Math.min(12, Number(body.weeks) || 3))
    const areas = (body.areas || []).filter((a) => a.area)
    if (!areas.length) return err(400, 'invalid_input', 'Pick at least one area to work on.')
    const budget = hours * weeks * 60
    const weight = (a) => (a.score == null ? 3 : Math.max(0.5, 5.5 - a.score)) // lower score = more time
    const totalW = areas.reduce((n, a) => n + weight(a), 0)
    const tierRank = { must: 0, should: 1, could: 2 }
    const picked = [], later = []
    const queues = areas.map((a) => {
      let left = (budget * weight(a)) / totalW
      const list = resources().filter((r) => r.topics.includes(a.area) && !picked.some((p) => p.id === r.id)).sort((x, y) => tierRank[x.tier] - tierRank[y.tier] || y.score - x.score)
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
    const mustTotal = resources().filter((r) => r.tier === 'must' && areas.some((a) => r.topics.includes(a.area))).length
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
  const peerView = (p) => {
    const overlap = p.availability.filter((s) => db.myAvailability.has(s))
    return { id: p.id, name: p.name, level: p.level, focus: p.focus, bio: p.bio, availability: p.availability, overlap }
  }
  const toolView = (t) => {
    const reports = db.toolReports[t.id] || []
    const infl = reports.length ? Math.round(((t.influence * 5 + reports.reduce((n, r) => n + r.impact, 0)) / (5 + reports.length)) * 10) / 10 : t.influence
    return { ...t, influence: infl, up: t.up + (db.toolVotes[t.id] || 0), voted: db.toolVotes[t.id] || 0, reports }
  }

  // ---------- router ----------
  const routes = []
  const on = (method, path, fn, open = false) => routes.push({ method, re: new RegExp('^' + path.replace(/:\w+/g, '([^/]+)') + '$'), fn, open })

  on('POST', '/api/auth/login', (b) => {
    if (!b.email || !b.password) return err(400, 'invalid_input', 'Enter your email and password.')
    const email = String(b.email).trim().toLowerCase()
    db.user = { id: 'u1', email, name: db.user?.email === email ? db.user.name : email.split('@')[0].replace(/[._]/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase()), verified: db.user?.email === email ? db.user.verified : true }
    return { body: { token: 'demo-token', user: db.user } }
  }, true)
  on('POST', '/api/auth/signup', (b) => {
    if (!b.email || !b.password || String(b.password).length < 8) return err(400, 'invalid_input', 'Use a valid email and a password of at least 8 characters.')
    db = fresh()
    db.interviews = []
    db.user = { id: 'u1', email: String(b.email).toLowerCase(), name: String(b.name || b.email.split('@')[0]).trim(), verified: false }
    return { body: { token: 'demo-token', user: db.user } }
  }, true)
  on('GET', '/api/me', () => (db.user ? { body: { user: db.user } } : err(401, 'unauthorized', 'Sign in again.')))
  on('POST', '/api/auth/verify', () => { db.user.verified = true; return { body: { user: db.user } } })
  on('PATCH', '/api/me', (b) => { if (b.name) db.user.name = String(b.name).trim().slice(0, 60) || db.user.name; return { body: { user: db.user } } })
  on('POST', '/api/delete-account', (b) => {
    if (b.confirm !== 'DELETE') return err(400, 'confirm_required', 'Type DELETE to confirm.')
    reset()
    return { body: { deleted: true } }
  })

  on('POST', '/api/interview-engine', engine)
  on('POST', '/api/interview-feedback', feedback)
  on('GET', '/api/interviews', () => ({ body: { interviews: db.interviews.map(publicSession), storage: { used: storageUsed(), limit: STORAGE_LIMIT } } }))
  on('GET', '/api/interviews/:id', (b, id) => {
    const i = db.interviews.find((x) => x.id === id)
    return i ? { body: { session: publicSession(i), messages: i.messages, feedback: i.feedback } } : err(404, 'not_found', 'Interview not found.')
  })
  on('POST', '/api/interviews/:id/rating', (b, id) => {
    const i = db.interviews.find((x) => x.id === id)
    if (!i) return err(404, 'not_found', 'Interview not found.')
    if (i.status === 'in_progress') return err(409, 'not_finished', 'Finish the interview before rating it.')
    const rating = Number(b.rating)
    if (!(rating >= 1 && rating <= 5)) return err(400, 'invalid_input', 'Choose 1 to 5 stars.')
    i.rating = { rating, comment: String(b.comment || '').slice(0, 500) }
    return { body: { rating: i.rating } }
  })

  // Prototype switches so the fallback screens can be shown on demand
  on('POST', '/api/_dev/flags', (b) => { Object.assign(db.flags, b); return { body: db.flags } })
  on('POST', '/api/_dev/reset', () => { reset(); return { body: { ok: true } } }, true)

  // Proof of concept: stateless, saves nothing
  on('POST', '/api/interview-ai', async (b) => {
    await sleep(600)
    const ans = String(b.answer || '')
    if (b.action === 'opening') return { body: { text: S.QUESTION_TEMPLATES['product-sense'](ctxFor(null)) } }
    if (!ans.trim()) return err(400, 'empty_answer', 'Write a short answer first.')
    if (b.action === 'followup') return { body: { text: ans.split(/\s+/).length < 25 ? S.GENERIC_FOLLOWUPS.shortAnswer : S.FOLLOWUPS['product-sense'][0] } }
    if (b.action === 'evaluate') { const w = ans.split(/\s+/).length; return { body: { score: Math.min(5, Math.max(1, Math.round(1 + w / 25))), note: 'Test evaluation based on length and structure only.' } } }
    return err(400, 'unknown_action', 'Unknown action.')
  })

  // Option 1: industries
  on('GET', '/api/industries', () => ({ body: { industries: S.INDUSTRIES.map((x) => ({ ...x, questions: Object.fromEntries(Object.keys(S.CATEGORIES).map((c) => [c, S.QUESTION_TEMPLATES[c](x)])) })) } }))

  // Option 2: experience library
  const expView = (e) => ({ ...e, helpfulCount: e.helpful + (db.experienceHelpful.has(e.id) ? 1 : 0), helpedByMe: db.experienceHelpful.has(e.id), reviews: e.reviews.map((r) => ({ ...r, reviewer: r.reviewer || S.EXPERTS.find((x) => x.id === r.expertId) })), avgExpert: e.reviews.length ? Math.round((e.reviews.reduce((n, r) => n + r.rating, 0) / e.reviews.length) * 10) / 10 : null })
  on('GET', '/api/experiences', () => ({ body: { experiences: db.experiences.map(expView), experts: S.EXPERTS } }))
  on('POST', '/api/experiences/parse', async (b) => {
    await sleep(1600)
    if (b.sampleAudio) return { body: { turns: S.SAMPLE_AUDIO_TRANSCRIPT, detected: { industry: 'Communication', round: 'Product sense' }, source: 'audio' } }
    const turns = parseTranscript(String(b.text || ''))
    return turns.length ? { body: { turns, source: 'text' } } : err(422, 'unparseable', 'Could not find turns. Start lines with "Interviewer:" and "Me:".')
  })
  on('POST', '/api/experiences', (b) => {
    const { company, role, industry, round, turns } = b
    if (!company?.trim() || !role?.trim() || !industry || !Array.isArray(turns) || turns.length < 2) return err(400, 'invalid_input', 'Add company, role, industry and at least two turns.')
    const e = { id: 'e' + rid(), company: company.trim().slice(0, 80), role: role.trim().slice(0, 80), industry, round: round || 'General', level: /associate|apm/i.test(role) ? 'APM' : 'PM', outcome: b.outcome || 'Pending', posted: new Date().toISOString(), author: 'You', helpful: 0, summary: String(b.summary || turns[0].text).slice(0, 160), turns: turns.slice(0, 40).map((t) => ({ speaker: t.speaker === 'interviewer' ? 'interviewer' : 'candidate', text: String(t.text).slice(0, 1200), note: t.note })), reviews: [], mine: true }
    db.experiences.unshift(e)
    return { body: { experience: expView(e) } }
  })
  on('POST', '/api/experiences/:id/helpful', (b, id) => { db.experienceHelpful.has(id) ? db.experienceHelpful.delete(id) : db.experienceHelpful.add(id); return { body: { ok: true } } })
  on('POST', '/api/experiences/:id/reviews', (b, id) => {
    const e = db.experiences.find((x) => x.id === id)
    if (!e) return err(404, 'not_found', 'Experience not found.')
    const rating = Number(b.rating)
    if (!b.name?.trim() || !b.role?.trim() || !(Number(b.years) >= 0) || !(rating >= 1 && rating <= 5) || !b.comment?.trim()) return err(400, 'invalid_input', 'Add your name, role, years of experience, a 1 to 5 ranking and a comment.')
    e.reviews.push({ expertId: null, rating, verdict: String(b.verdict || '').slice(0, 60), comment: String(b.comment).slice(0, 800), reviewer: { id: 'self', name: b.name.trim().slice(0, 60), role: b.role.trim().slice(0, 80), years: Number(b.years), verified: false } })
    return { body: { experience: expView(e) } }
  })

  // Option 3: peer mocks
  on('GET', '/api/peers', () => ({ body: { days: days(), hours: S.SLOT_HOURS, mine: [...db.myAvailability], peers: S.PEERS.map(peerView), bookings: db.bookings } }))
  on('PUT', '/api/availability', (b) => {
    const valid = new Set(days().flatMap((d) => S.SLOT_HOURS.map((h) => `${d}@${h}`)))
    db.myAvailability = new Set((b.slots || []).filter((s) => valid.has(s)))
    return { body: { mine: [...db.myAvailability] } }
  })
  on('POST', '/api/bookings', (b) => {
    const p = S.PEERS.find((x) => x.id === b.peerId)
    if (!p) return err(404, 'not_found', 'Peer not found.')
    if (!p.availability.includes(b.slot) || !db.myAvailability.has(b.slot)) return err(409, 'slot_unavailable', 'Both of you need to be free in that slot.')
    if (db.bookings.some((x) => x.slot === b.slot && x.status !== 'cancelled')) return err(409, 'slot_taken', 'You already have a session at that time.')
    const bk = { id: 'b' + rid(), peerId: p.id, peerName: p.name, slot: b.slot, focus: S.CATEGORIES[b.focus] ? b.focus : p.focus[0], status: 'confirmed', feedbackGiven: null }
    db.bookings.push(bk)
    return { body: { booking: bk } }
  })
  on('POST', '/api/bookings/:id/cancel', (b, id) => { const bk = db.bookings.find((x) => x.id === id); if (bk) bk.status = 'cancelled'; return { body: { ok: true } } })
  on('POST', '/api/bookings/:id/feedback', (b, id) => {
    const bk = db.bookings.find((x) => x.id === id)
    if (!bk) return err(404, 'not_found', 'Session not found.')
    const clamp = (v) => Math.max(1, Math.min(5, Number(v) || 3))
    bk.feedbackGiven = { structure: clamp(b.structure), depth: clamp(b.depth), communication: clamp(b.communication), comment: String(b.comment || '').slice(0, 600) }
    bk.status = 'done'
    return { body: { booking: bk } }
  })

  // Option 4: resources + roadmap
  on('GET', '/api/resources', () => ({ body: { resources: resources(), gaps: avgByCategory() } }))
  on('POST', '/api/resources/:id/vote', (b, id) => {
    if (!S.RESOURCES.some((r) => r.id === id)) return err(404, 'not_found', 'Resource not found.')
    const v = b.vote === 1 ? 1 : b.vote === -1 ? -1 : 0
    db.resourceVotes[id] = db.resourceVotes[id] === v ? 0 : v
    return { body: { resources: resources() } }
  })
  on('POST', '/api/roadmap', roadmap)

  // Option 5: AI tools
  on('GET', '/api/ai-tools', () => ({ body: { tools: S.AI_TOOLS.map(toolView), industries: [...new Set(S.AI_TOOLS.flatMap((t) => t.industries))].sort(), categories: [...new Set(S.AI_TOOLS.map((t) => t.category))] } }))
  on('POST', '/api/ai-tools/:id/vote', (b, id) => {
    if (!S.AI_TOOLS.some((t) => t.id === id)) return err(404, 'not_found', 'Tool not found.')
    db.toolVotes[id] = db.toolVotes[id] ? 0 : 1
    return { body: { tool: toolView(S.AI_TOOLS.find((t) => t.id === id)) } }
  })
  on('POST', '/api/ai-tools/:id/reports', (b, id) => {
    const t = S.AI_TOOLS.find((x) => x.id === id)
    if (!t) return err(404, 'not_found', 'Tool not found.')
    const impact = Number(b.impact)
    if (!b.use?.trim() || !b.industry || !(impact >= 1 && impact <= 5)) return err(400, 'invalid_input', 'Say what you use it for, your industry and the impact from 1 to 5.')
    ;(db.toolReports[id] ||= []).unshift({ use: b.use.trim().slice(0, 200), industry: b.industry, impact, role: String(b.role || 'PM').slice(0, 60), when: 'Just now' })
    return { body: { tool: toolView(t) } }
  })

  return async function handle(req, res) {
    const url = new URL(req.url, 'http://x')
    res.setHeader('Content-Type', 'application/json')
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)) }
    const route = routes.find((r) => r.method === req.method && r.re.test(url.pathname))
    if (!route) return send(404, { error: { code: 'not_found', message: 'Unknown endpoint.' } })
    let body = {}
    if (req.method !== 'GET') {
      const chunks = []
      for await (const c of req) chunks.push(c)
      if (chunks.length) { try { body = JSON.parse(Buffer.concat(chunks).toString()) } catch { return send(400, { error: { code: 'bad_json', message: 'Invalid request body.' } }) } }
    }
    // Identity comes from the verified token, never from the request body.
    if (!route.open && (req.headers.authorization !== 'Bearer demo-token' || !db.user)) return send(401, { error: { code: 'unauthorized', message: 'Sign in again.' } })
    try {
      const params = url.pathname.match(route.re).slice(1)
      const out = await route.fn(body, ...params)
      send(out.status || 200, out.body)
    } catch (e) {
      console.error(e)
      send(500, { error: { code: 'server_error', message: 'Something went wrong on our side. Try again.', retryable: true } })
    }
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  http.createServer(createApp()).listen(PORT, () => console.log(`mock api on http://localhost:${PORT}`))
}
