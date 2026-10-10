// Mock backend for the ProManAI prototype. In-memory, single demo user, no real AI.
// It mirrors the doc: server owns the timer, skips and scores; the browser only displays.
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import * as S from './seed.js'
import * as T from './aiTools.js'

const PORT = process.env.PORT || 8787
const TOTAL_MS = 20 * 60 * 1000
const MAX_SKIPS = 2
const QUESTIONS_PER_AREA = 3 // opening + 2 follow-ups, then the next chosen area
const MAX_GAP_MS = 30_000 // doc: at most ~30s lost per gap
const STORAGE_LIMIT = 5 * 1024 * 1024
const RATE = { engine: 60, feedback: 6 } // per minute; clock checks (status, heartbeat) are not counted
const MAX_CLARIFY = 4 // clarifying questions per interview
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
    toolReviews: structuredClone(T.TOOL_REVIEWS),
    reviewHelpful: new Set(),
    reviewReported: new Set(),
    experienceHelpful: new Set(),
    plan: null, // the saved study plan (demo: in memory only)
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
  const publicSession = (i) => ({ ...i, messages: undefined, feedback: undefined, has_feedback: !!i.feedback, industry_name: S.INDUSTRIES.find((x) => x.id === i.industry)?.name ?? null })
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
  // With several focus areas, it moves to the next area after QUESTIONS_PER_AREA questions or once that area's share of the clock is used.
  function nextQuestion(i, opts = {}) {
    const opening = (cat) => S.QUESTION_TEMPLATES[cat](ctxFor(i.industry)) + S.HARD_SUFFIX[i.difficulty]
    if (opts.opening) return i.opening === 'ai-usage' ? S.AI_USAGE_QUESTION : opening(i.categories[0])
    const questions = i.messages.filter((m) => m.role === 'interviewer' && m.kind !== 'clarify')
    const k = i.categories.indexOf(i.current_category)
    const areaUsed = TOTAL_MS - i.timer_remaining_ms >= (TOTAL_MS / i.categories.length) * (k + 1)
    if (k < i.categories.length - 1 && i.timer_remaining_ms >= 180_000 && (questions.length - i.area_start >= QUESTIONS_PER_AREA || areaUsed)) {
      i.current_category = i.categories[k + 1]
      i.area_start = questions.length
      return `Let's switch to the ${S.CATEGORIES[i.current_category].label} part of the interview. ${opening(i.current_category)}`
    }
    const cat = i.current_category
    const asked = new Set(questions.map((m) => m.content))
    const lastAnswer = [...i.messages].reverse().find((m) => m.role === 'candidate' && m.kind !== 'clarify')?.content || ''
    const words = lastAnswer.trim().split(/\s+/).filter(Boolean).length
    const pool = []
    if (i.timer_remaining_ms < 180_000) pool.push('We are short on time. In two sentences, what is your single most important recommendation?')
    if (words < 25) pool.push(S.GENERIC_FOLLOWUPS.shortAnswer)
    if (!/user|customer|segment/i.test(lastAnswer) && cat === 'product-sense') pool.push(S.GENERIC_FOLLOWUPS.noUser)
    if (!/metric|measure|kpi|rate/i.test(lastAnswer) && cat !== 'behavioral') pool.push(S.GENERIC_FOLLOWUPS.noMetric)
    if (!/trade|instead|cost|versus/i.test(lastAnswer)) pool.push(S.GENERIC_FOLLOWUPS.noTradeoff)
    pool.push(...S.FOLLOWUPS[cat])
    return pool.find((q) => !asked.has(q)) || 'Is there anything you would like to add before we wrap up?'
  }

  // Mock interviewer answers to clarifying questions: give a reasonable assumption, never the answer
  function clarifyReply(text) {
    const t = text.toLowerCase()
    if (/\b(user|who|segment|customer|persona)\b/.test(t)) return 'Good question. Pick the user segment you think matters most, and tell me why you chose it.'
    if (/\b(goal|objective|success|why|aim)\b/.test(t)) return 'Assume the company cares most about long-term engagement. If you would choose a different goal, say so and explain why.'
    if (/\b(data|metric|analytics|numbers?)\b/.test(t)) return 'Assume you have standard product analytics and can run A/B tests, but there is no budget for new research.'
    if (/\b(time|deadline|team|engineers?|resources?|budget)\b/.test(t)) return 'Assume a small team of four engineers and one quarter.'
    if (/\b(market|competitor|country|region)\b/.test(t)) return 'Assume one main market and two well-funded competitors.'
    return 'Good question. Make a reasonable assumption, say it out loud, and carry on.'
  }

  function guardOwner(i) {
    return i ? null : err(404, 'not_found', 'Interview not found.')
  }

  async function engine(body) {
    if (!['status', 'heartbeat'].includes(body.action) && limited('engine')) return err(429, 'rate_limited', 'You are going too quickly. Wait a few seconds and try again.', true)
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
      const { level, difficulty, industry } = body
      const picked = Array.isArray(body.categories) ? body.categories : body.category ? [body.category] : []
      const categories = Object.keys(S.CATEGORIES).filter((c) => picked.includes(c)) // canonical order, no duplicates
      if (!['APM', 'PM'].includes(level) || !categories.length || picked.some((c) => !S.CATEGORIES[c]) || !['easy', 'medium', 'hard'].includes(difficulty)) return err(400, 'invalid_input', 'Choose a level, at least one focus area and a difficulty.')
      if (industry && !S.INDUSTRIES.some((x) => x.id === industry)) return err(400, 'invalid_input', 'Unknown industry.')
      // the "How do you use AI?" opening only applies to a behavioral-only interview
      const openingVariant = body.opening === 'ai-usage' && categories.length === 1 && categories[0] === 'behavioral' ? 'ai-usage' : null
      const i = { id: 'i' + rid(), level, category: categories[0], categories, current_category: categories[0], area_start: 0, opening: openingVariant, clarifications: 0, difficulty, industry: industry || null, status: 'in_progress', feedback_status: 'none', timer_remaining_ms: TOTAL_MS, skips_used: 0, end_reason: null, created_at: new Date().toISOString(), size_bytes: 0, rating: null, feedback_attempts: 0, messages: [], last_tick: Date.now(), feedback: null }
      db.interviews.unshift(i)
      await sleep(700)
      const first = db.user.name.split(' ')[0]
      addMsg(i, 'interviewer', `Hi ${first}, thanks for joining. ${nextQuestion(i, { opening: true })}`, { area: i.current_category })
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
    if (a === 'submit_answer') {
      const text = String(body.text || '').trim()
      if (!text) return err(400, 'empty_answer', 'Say or edit your answer before submitting.')
      if (text.length > 4000) return err(400, 'too_long', 'That answer is too long. Keep it under 4,000 characters.')
      const last = i.messages.at(-1)
      if (last.role === 'candidate') return err(409, 'duplicate', 'Answer already submitted.')
      if (bytes(i) + text.length > 200_000) return err(413, 'session_too_large', 'This interview is too large to continue.')
      // the answer is saved before the clock is charged, so one submitted in the last seconds still counts
      const m = addMsg(i, 'candidate', text)
      charge(i)
      i.size_bytes = bytes(i)
      return { body: { session: publicSession(i), message: m, messages: i.messages, ended: i.status !== 'in_progress' } }
    }
    charge(i)
    if (i.status !== 'in_progress') return { body: { session: publicSession(i), messages: i.messages, ended: true } }
    if (a === 'clarify') {
      const text = String(body.text || '').trim()
      if (!text) return err(400, 'empty_answer', 'Type or say your question first.')
      if (text.length > 600) return err(400, 'too_long', 'Keep your clarifying question short.')
      if (i.messages.at(-1).role !== 'interviewer') return err(409, 'out_of_order', 'Ask while a question is open.')
      if (i.clarifications >= MAX_CLARIFY) return err(409, 'no_clarifications', 'You have used your clarifying questions. Make a reasonable assumption, say it out loud, and answer.')
      i.clarifications += 1
      const q = addMsg(i, 'candidate', text, { kind: 'clarify', submitted: false })
      await sleep(500)
      const m = addMsg(i, 'interviewer', clarifyReply(text), { kind: 'clarify' })
      i.size_bytes = bytes(i)
      return { body: { session: publicSession(i), messages: [q, m] } }
    }
    if (a === 'next_question') {
      if (i.messages.at(-1).role !== 'candidate') return err(409, 'out_of_order', 'Submit an answer first.')
      await sleep(900)
      if (db.flags.busyNext) { db.flags.busyNext = false; return err(429, 'ai_busy', 'The AI is busy or the free limit was reached. Your answer is saved. Try again.', true) }
      const m = addMsg(i, 'interviewer', nextQuestion(i), { area: i.current_category })
      i.size_bytes = bytes(i)
      charge(i)
      return { body: { session: publicSession(i), message: m } }
    }
    if (a === 'skip') {
      if (i.skips_used >= MAX_SKIPS) return err(409, 'no_skips', 'No skips left.')
      if (i.messages.at(-1).role !== 'interviewer') return err(409, 'out_of_order', 'Nothing to skip.')
      const lastQ = [...i.messages].reverse().find((m) => m.role === 'interviewer' && m.kind !== 'clarify')
      lastQ.skipped = true
      i.skips_used += 1
      await sleep(600)
      const m = addMsg(i, 'interviewer', nextQuestion(i), { area: i.current_category })
      return { body: { session: publicSession(i), message: m } }
    }
    if (a === 'end') {
      finish(i, body.reason === 'time_up' ? 'time_up' : 'user_ended')
      return { body: { session: publicSession(i), messages: i.messages } }
    }
    return err(400, 'unknown_action', 'Unknown action.')
  }

  // Per-answer feedback: simple, visible checks, so every point traces back to what was said
  // Quotes are the candidate's own words, verbatim. A quote is only kept if it appears exactly in the answer,
  // so feedback can always be checked against what was said (a real AI scorer must follow the same rule).
  const MAX_QUOTE = 240
  const sentencesOf = (text) => text.split(/(?<=[.!?])\s+/).map((x) => x.trim()).filter(Boolean)
  function quote(answer, sentence) {
    if (!sentence) return null
    let q = sentence.trim(), cut = false
    if (q.length > MAX_QUOTE) { q = q.slice(0, q.lastIndexOf(' ', MAX_QUOTE) > 80 ? q.lastIndexOf(' ', MAX_QUOTE) : MAX_QUOTE); cut = true }
    return answer.includes(q) ? { quote: q, cut } : null
  }

  // Per-answer feedback: simple, visible checks. Every point is tied to a quote: what you said that earned it,
  // or, for something missing, the sentence where it would have belonged.
  function answerFeedback(answer, area) {
    const words = answer.split(/\s+/).filter(Boolean).length
    const sents = sentencesOf(answer)
    const first = sents[0], last = sents[sents.length - 1]
    const decision = sents.find((x) => /\b(I would|I'd|I will|I'll|we would|we should|I (chose|decided|picked|proposed)|my (plan|approach|recommendation))\b/i.test(x)) ?? first
    const weSentence = sents.find((x) => /\bwe\b/i.test(x)) ?? first
    // [key, pattern, good text, missing text, tip, where it was missing, note for that place]
    const structure = ['structure', /\b(first|second|then|finally|because|so that)\b/i, 'You gave the answer a clear structure.', 'The answer had no visible structure.', 'Say your structure up front, for example: "I will cover the user, then options, then how I would measure it."', first, 'You opened with this. Saying your structure here would help the interviewer follow you.']
    const tradeoff = ['tradeoff', /\b(trade|instead|versus|vs|cost|sacrific|downside|risk)/i, 'You named a trade-off or a risk.', 'You did not name a trade-off.', 'Say what you give up with your choice, and why it is worth it.', decision, 'You made this choice without saying what it costs.']
    const user = ['user', /\b(users?|customers?|segments?|persona|owners?|students?|patients?|buyers?|creators?)\b/i, 'You said who you are solving for.', 'You did not say who the user is.', 'Name one specific user segment before proposing anything.', decision, 'You proposed this without saying who it is for.']
    const metric = ['metric', /\b(metrics?|measure|kpi|rate|conversion|retention|success)\b|%/i, 'You said how you would measure success.', 'There was no way to measure success.', 'Close with one success metric and one guardrail metric.', last, 'Your answer ended here, without a way to measure success.']
    const checks = area === 'behavioral'
      ? [structure,
         ['ownership', /\bI (led|owned|decided|drove|built|proposed|chose|ran|pushed)\b/, 'You made your own role clear.', 'Your own role was unclear.', 'Say what you personally did, using "I", not only "we".', weSentence, 'Here it is not clear what you did yourself.'],
         ['result', /\b(result|outcome|shipped|launched|learned|learnt|impact|improved)\b/i, 'You described the result.', 'The story had no clear result.', 'End with the outcome and what you learned.', last, 'The story ended here, without the result.'],
         tradeoff]
      : area === 'ai-product'
        ? [structure, user, ['eval', /\b(eval|accuracy|hallucinat|test set|human review|quality bar|quality)/i, 'You explained how you would judge the AI\'s quality.', 'You did not say how you would judge whether the AI works.', 'Define a quality bar and how you would test against it before launch.', decision, 'You proposed this without saying how you would know the AI works.'], tradeoff]
        : [structure, user, metric, tradeoff]
    // prefer a sentence not quoted yet, so each point shows different evidence when the answer has it
    const used = new Set()
    const pick = (re) => { const all = sents.filter((x) => re.test(x)); const hit = all.find((x) => !used.has(x)) ?? all[0]; if (hit) used.add(hit); return hit }
    const passed = checks.filter((c) => c[1].test(answer))
    const failed = checks.filter((c) => !c[1].test(answer))
    const short = words < 40
    return {
      verdict: !short && passed.length >= 3 ? 'Strong' : words >= 25 && passed.length >= 2 ? 'Solid' : 'Needs work',
      good: passed.slice(0, 3).map((c) => ({ text: c[2], ...quote(answer, pick(c[1])) })),
      missing: [
        ...(short ? [{ text: `At ${words} words, the answer was short for this question.`, note: 'Add a concrete example or a number to go one level deeper.' }] : []),
        ...failed.map((c) => ({ text: c[3], note: c[6], ...quote(answer, c[5]) })),
      ].slice(0, 2),
      tip: short ? 'Go one level deeper: add a concrete example or a number.' : failed[0]?.[4] ?? 'This answer covered the basics. Keep this structure.',
    }
  }

  // Mock evaluator: transparent heuristics so scores respond to what the user said.
  function generateFeedback(i) {
    const answers = i.messages.filter((m) => m.role === 'candidate' && m.submitted).map((m) => m.content)
    const all = answers.join(' ')
    const avgWords = all.split(/\s+/).filter(Boolean).length / Math.max(1, answers.length)
    const cats = i.categories || [i.category]
    const comps = [...new Set(cats.flatMap((c) => S.CATEGORIES[c].competencies))].map((name, idx) => {
      const re = S.KEYWORDS[name.toLowerCase()]
      const hits = re ? (all.match(new RegExp(re.source, 'gi')) || []).length : 0
      const jitter = (((i.id.charCodeAt(1) || 1) * (idx + 3)) % 7) / 10 - 0.3
      const raw = 1.8 + Math.min(1.4, avgWords / 55) + Math.min(1.2, hits * 0.3) + jitter
      const score = Math.max(1, Math.min(5, Math.round(raw * 2) / 2))
      const band = score >= 4 ? 'Strong' : score >= 3 ? 'Solid' : 'Needs work'
      const explanation = { Strong: `You handled ${name.toLowerCase()} with clear reasoning.`, Solid: `Reasonable on ${name.toLowerCase()}, but the reasoning could be more explicit.`, 'Needs work': `${name} was thin. Be more specific and show your reasoning step by step.` }[band]
      return { name, score, explanation, re }
    })
    const overall = Math.round((comps.reduce((n, c) => n + c.score, 0) / comps.length) * 10) / 10
    const sorted = [...comps].sort((a, b) => b.score - a.score)
    const band = overall >= 4 ? 'Strong' : overall >= 3 ? 'Solid' : 'Needs work'
    // question-by-question: each answer (or skip) with the question it answered
    const qa = []
    i.messages.forEach((m, k) => {
      if (m.role === 'interviewer' && m.skipped) qa.push({ seq: m.seq, question: m.content, skipped: true })
      if (m.role !== 'candidate' || !m.submitted) return
      const q = i.messages.slice(0, k).reverse().find((x) => x.role === 'interviewer' && x.kind !== 'clarify')
      const area = q?.area ?? i.category
      qa.push({ seq: m.seq, question: q?.content ?? '', answer: m.content, area, skipped: false, ...answerFeedback(m.content, area) })
    })
    qa.sort((a, b) => a.seq - b.seq)
    // each skill's evidence: the first sentence, in question order, that shows it, with the question number;
    // null means no sentence showed the skill, which the report says plainly
    const scored = qa.map((x, k) => ({ ...x, qn: k + 1 })).filter((x) => !x.skipped)
    comps.forEach((c) => {
      let ev = null
      for (const x of scored) {
        const hit = c.re && sentencesOf(x.answer).find((t) => new RegExp(c.re.source, 'i').test(t))
        const q = hit && quote(x.answer, hit)
        if (q) { ev = { ...q, seq: x.seq, qn: x.qn }; break }
      }
      c.evidence = ev
      delete c.re
    })
    // final guard: drop any quote that is not word-for-word in its answer
    scored.forEach((x) => ['good', 'missing'].forEach((k) => x[k] && x[k].forEach((p) => { if (p.quote && !x.answer.includes(p.quote)) { delete p.quote; delete p.cut } })))
    return {
      overall_score: overall,
      band,
      explanation: `${band}. Your score is the average of ${comps.length} skills. Your strongest was ${sorted[0].name}; work on ${sorted[sorted.length - 1].name} first.`,
      answers: qa,
      competency_scores: comps,
      strengths: sorted.slice(0, 2).map((c) => (c.score >= 4 ? `${c.name}: clear, well-reasoned answers.` : `${c.name}: a solid base to build on (${c.score}/5).`)),
      improvement_areas: sorted.slice(-2).reverse().map((c) => c.name),
      suggestions: [`Spend your first 30 seconds on structure before answering ${cats.map((c) => S.CATEGORIES[c].label.toLowerCase()).join(' and ')} questions.`, 'Name the trade-off you are accepting whenever you pick an option.', 'Close each answer with how you would measure success.'],
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
  const round1 = (n) => Math.round(n * 10) / 10
  // An area's score in one interview: the average of that area's competencies, so mixed interviews count per area
  const areaScore = (i, area) => {
    const xs = i.feedback.competency_scores.filter((c) => S.CATEGORIES[area].competencies.includes(c.name)).map((c) => c.score)
    return round1(xs.reduce((a, b) => a + b, 0) / xs.length)
  }
  // progress, gaps and the study plan count real interviews only: the "How do you use AI?" practice is kept separate
  const scored = () => db.interviews.filter((i) => i.feedback && i.opening !== 'ai-usage').sort((a, b) => a.created_at.localeCompare(b.created_at)) // oldest first
  const areaHistory = () => Object.keys(S.CATEGORIES).map((c) => ({
    area: c, label: S.CATEGORIES[c].label,
    points: scored().filter((i) => (i.categories || [i.category]).includes(c)).map((i) => ({ id: i.id, date: i.created_at, score: areaScore(i, c) })),
  }))
  // gaps use the latest score per area: it reflects where you are now, not your average
  const avgByCategory = () => areaHistory().map((a) => ({ area: a.area, label: a.label, score: a.points.at(-1)?.score ?? null, previous: a.points.at(-2)?.score ?? null }))
  function progress() {
    const comps = {}
    scored().forEach((i) => i.feedback.competency_scores.forEach((c) => {
      const area = (i.categories || [i.category]).find((a) => S.CATEGORIES[a].competencies.includes(c.name))
      ;(comps[c.name] ||= []).push({ score: c.score, area })
    }))
    const focus = Object.entries(comps).map(([name, xs]) => ({ name, score: xs.at(-1).score, previous: xs.at(-2)?.score ?? null, area: xs.at(-1).area, label: S.CATEGORIES[xs.at(-1).area].label }))
      .sort((a, b) => a.score - b.score).slice(0, 3)
    return { body: { scored: scored().length, areas: areaHistory(), focus } }
  }

  // Self-assessed confidence (1 not, 2 somewhat, 3 confident) stands in for a score until the user has real ones
  const CONF_SCORE = { 1: 2, 2: 3, 3: 4 }
  const effScore = (a) => a.score ?? (a.confidence ? CONF_SCORE[a.confidence] : null)
  // lower score = more time; an area with no evidence at all gets little, because a known weakness matters more than an unknown
  const weight = (a) => (effScore(a) == null ? 1.5 : Math.max(0.5, 5.5 - effScore(a)))
  const weeksUntil = (date) => { const t = Date.parse(date); return Number.isFinite(t) ? Math.max(1, Math.min(12, Math.ceil((t - Date.now()) / (7 * 864e5)))) : null }

  function buildPlan(body) {
    const hours = Math.max(1, Math.min(40, Number(body.hoursPerWeek) || 5))
    const weeks = Math.max(1, Math.min(12, weeksUntil(body.interviewDate) ?? (Number(body.weeks) || 3)))
    const areas = (body.areas || []).filter((a) => S.CATEGORIES[a.area])
    if (!areas.length) return { error: err(400, 'invalid_input', 'Pick at least one area to work on.') }
    const budget = hours * weeks * 60
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
    const plan = Array.from({ length: weeks }, (_, w) => ({ week: w + 1, minutes: 0, items: [], mock: null }))
    const spill = []
    order.forEach((r) => {
      const slot = plan.find((p) => p.minutes + r.minutes <= hours * 60)
      slot ? (slot.items.push(r), (slot.minutes += r.minutes)) : spill.push(r)
    })
    // every week has one mock interview on its two weakest areas; a self-assessed plan opens with a baseline instead
    const weakest = (ids) => areas.filter((a) => ids.includes(a.area)).sort((x, y) => weight(y) - weight(x)).slice(0, 2).map((a) => a.area)
    const baseline = areas.every((a) => a.score == null)
    plan.forEach((w, k) => {
      const ids = w.items.map((r) => r.area).filter(Boolean)
      if (k === 0 && baseline) w.mock = { areas: weakest(areas.map((a) => a.area)), baseline: true }
      else if (ids.length) w.mock = { areas: weakest(ids), baseline: false }
    })
    const mustTotal = resources().filter((r) => r.tier === 'must' && areas.some((a) => r.topics.includes(a.area))).length
    const mustCovered = picked.filter((r) => r.tier === 'must').length
    const dedupe = (arr) => arr.filter((r, k) => arr.findIndex((z) => z.id === r.id) === k && !picked.some((p) => p.id === r.id))
    return {
      weeks: plan, budgetMinutes: budget, plannedMinutes: plan.reduce((n, p) => n + p.minutes, 0), mustTotal, mustCovered, notFitted: dedupe([...later, ...spill]).slice(0, 8),
      hoursPerWeek: hours, areas: areas.map((a) => ({ area: a.area, label: S.CATEGORIES[a.area].label, score: a.score ?? null, confidence: a.confidence ?? null })),
    }
  }
  function roadmap(body) {
    const built = buildPlan(body)
    return built.error || { body: built }
  }

  // ---- saved study plan ----
  const latestScores = () => Object.fromEntries(areaHistory().map((a) => [a.area, a.points.at(-1)?.score ?? null]))
  function savePlan(b, keep) {
    const built = buildPlan(b)
    if (built.error) return built.error
    const now = new Date().toISOString()
    db.plan = {
      ...built,
      basis: built.areas.every((a) => a.score == null) ? 'self' : 'reports',
      level: ['APM', 'PM'].includes(b.level) ? b.level : null,
      interview_date: b.interviewDate || null,
      snapshot: latestScores(), // what the scores were when the plan was made, to explain later changes
      created_at: now,
      started_at: keep?.started_at ?? now,
      done: keep?.done ?? [],
    }
    return { body: { plan: planView() } }
  }
  function planView() {
    const p = db.plan
    if (!p) return null
    const latest = latestScores()
    const changes = p.areas.filter((a) => (latest[a.area] ?? null) !== (p.snapshot[a.area] ?? null))
      .map((a) => ({ area: a.area, label: a.label, from: p.snapshot[a.area] ?? null, to: latest[a.area] }))
    // a week's mock counts as done once an interview on one of its areas is scored after the plan started
    const used = new Set()
    const after = scored().filter((i) => i.created_at >= p.started_at)
    const weeks = p.weeks.map((w) => {
      if (!w.mock) return w
      const hit = after.find((i) => !used.has(i.id) && (i.categories || [i.category]).some((c) => w.mock.areas.includes(c)))
      if (hit) used.add(hit.id)
      return { ...w, mock: { ...w.mock, done: !!hit, interviewId: hit?.id ?? null } }
    })
    const steps = weeks.reduce((n, w) => n + w.items.length + (w.mock ? 1 : 0), 0)
    const doneSteps = weeks.reduce((n, w) => n + w.items.filter((r) => p.done.includes(r.id)).length + (w.mock?.done ? 1 : 0), 0)
    const currentWeek = Math.max(1, Math.min(weeks.length, Math.floor((Date.now() - Date.parse(p.started_at)) / (7 * 864e5)) + 1))
    return { ...p, weeks, changes, steps, doneSteps, currentWeek }
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
  // ---- AI tools catalogue: facts come from the data file with sources; ratings and experiences only from users ----
  const STALE_DAYS = 60 // facts older than this are flagged for re-checking
  // counts words that look like words: letters only, 2 to 20 long, with a vowel; keyboard mashing does not count
  const realWords = (text) => String(text).split(/\s+/).map((w) => w.replace(/[^a-z']/gi, '')).filter((w) => w.length >= 2 && w.length <= 20 && /[aeiouy]/i.test(w)).length
  const reviewView = (r) => ({ ...r, helpfulCount: r.helpful + (db.reviewHelpful.has(r.id) ? 1 : 0), helpedByMe: db.reviewHelpful.has(r.id), reportedByMe: db.reviewReported.has(r.id) })
  const toolStats = (t) => {
    const rs = db.toolReviews.filter((r) => r.toolId === t.id)
    const rated = rs.filter((r) => !r.affiliated) // reviews from people who work with the maker are shown, but not counted in the rating
    const taskCount = {}
    rs.forEach((r) => r.tasks.forEach((k) => (taskCount[k] = (taskCount[k] || 0) + 1)))
    return {
      ...t,
      rating: rated.length ? Math.round((rated.reduce((n, r) => n + r.rating, 0) / rated.length) * 10) / 10 : null,
      reviewCount: rs.length,
      ratedCount: rated.length,
      affiliatedCount: rs.length - rated.length,
      sampleCount: rated.filter((r) => r.sample).length,
      topTasks: Object.entries(taskCount).sort((a, b) => b[1] - a[1]).map(([task, count]) => ({ task, label: T.TOOL_TASKS[task], count })),
      breakdown: [5, 4, 3, 2, 1].map((stars) => ({ stars, count: rated.filter((r) => r.rating === stars).length })),
      reviewIndustries: [...new Set(rs.map((r) => r.industry))],
      stale: (Date.now() - Date.parse(t.checked)) / 864e5 > STALE_DAYS,
      myReviewId: rs.find((r) => r.mine)?.id ?? null,
    }
  }
  const toolLists = () => ({ tasks: T.TOOL_TASKS, roles: T.TOOL_ROLES, frequency: T.TOOL_FREQUENCY, industries: S.INDUSTRIES.map((x) => x.name) })

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
  on('GET', '/api/plan', () => ({ body: { plan: planView() } }))
  on('POST', '/api/plan', (b) => savePlan(b))
  // rebuild with the latest scores, keeping ticked items and the start date
  on('POST', '/api/plan/update', () => {
    const p = db.plan
    if (!p) return err(404, 'not_found', 'You do not have a study plan yet.')
    const latest = latestScores()
    const areas = p.areas.map((a) => (latest[a.area] != null ? { area: a.area, score: latest[a.area] } : { area: a.area, confidence: a.confidence }))
    return savePlan({ areas, hoursPerWeek: p.hoursPerWeek, interviewDate: p.interview_date, weeks: p.weeks.length, level: p.level }, p)
  })
  on('POST', '/api/plan/items/:id', (b, id) => {
    const p = db.plan
    if (!p) return err(404, 'not_found', 'You do not have a study plan yet.')
    p.done = p.done.includes(id) ? p.done.filter((x) => x !== id) : [...p.done, id]
    return { body: { plan: planView() } }
  })
  on('POST', '/api/plan/reset', () => { db.plan = null; return { body: { plan: null } } })
  on('GET', '/api/progress', progress)

  // Option 5: AI tools
  on('GET', '/api/ai-tools', () => ({ body: { tools: T.AI_TOOLS.map(toolStats), ...toolLists() } }))
  on('GET', '/api/ai-tools/:id', (b, id) => {
    const t = T.AI_TOOLS.find((x) => x.id === id)
    if (!t) return err(404, 'not_found', 'Tool not found.')
    return { body: { tool: toolStats(t), reviews: db.toolReviews.filter((r) => r.toolId === id).map(reviewView), ...toolLists() } }
  })
  // one review per user per tool: posting again edits it
  on('POST', '/api/ai-tools/:id/reviews', (b, id) => {
    if (!T.AI_TOOLS.some((x) => x.id === id)) return err(404, 'not_found', 'Tool not found.')
    const rating = Number(b.rating)
    const tasks = Array.isArray(b.tasks) ? [...new Set(b.tasks)].filter((k) => T.TOOL_TASKS[k]) : []
    const text = String(b.text || '').trim()
    if (!T.TOOL_FREQUENCY[b.frequency]) return err(400, 'invalid_input', 'Say how often you use it.')
    if (!Number.isInteger(rating) || rating < 1 || rating > 5) return err(400, 'invalid_input', 'Choose a rating from 1 to 5 stars.')
    if (!tasks.length) return err(400, 'invalid_input', 'Pick at least one thing you use it for.')
    if (text.length < 50 || realWords(text) < 10) return err(400, 'invalid_input', 'Write at least 10 words about your experience.')
    if (text.length > 1500) return err(400, 'invalid_input', 'Keep your review under 1,500 characters.')
    if (!T.TOOL_ROLES.includes(b.role)) return err(400, 'invalid_input', 'Choose your role.')
    if (!S.INDUSTRIES.some((x) => x.name === b.industry)) return err(400, 'invalid_input', 'Choose your industry.')
    const data = { rating, frequency: b.frequency, tasks, text, role: b.role, industry: b.industry, affiliated: !!b.affiliated }
    let r = db.toolReviews.find((x) => x.toolId === id && x.mine)
    if (r) Object.assign(r, data, { edited: new Date().toISOString() })
    else db.toolReviews.unshift((r = { id: 'v' + rid(), toolId: id, helpful: 0, created: new Date().toISOString(), sample: false, mine: true, ...data }))
    return { body: { review: reviewView(r) } }
  })
  on('POST', '/api/ai-reviews/:id/helpful', (b, id) => {
    const r = db.toolReviews.find((x) => x.id === id)
    if (!r) return err(404, 'not_found', 'Review not found.')
    if (r.mine) return err(409, 'own_review', 'You cannot mark your own review as helpful.')
    db.reviewHelpful.has(id) ? db.reviewHelpful.delete(id) : db.reviewHelpful.add(id)
    return { body: { review: reviewView(r) } }
  })
  on('POST', '/api/ai-reviews/:id/report', (b, id) => {
    const r = db.toolReviews.find((x) => x.id === id)
    if (!r) return err(404, 'not_found', 'Review not found.')
    db.reviewReported.add(id) // demo: a real backend would queue it for moderation
    return { body: { review: reviewView(r) } }
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
