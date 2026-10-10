// Smoke test for the mock API. Run: npm run test:api
import http from 'node:http'
import assert from 'node:assert/strict'
import { createApp } from './index.js'

const srv = http.createServer(createApp())
await new Promise((r) => srv.listen(0, r))
const base = `http://localhost:${srv.address().port}`
const call = async (method, path, body, auth = true) => {
  const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(auth ? { authorization: 'Bearer demo-token' } : {}) }, body: body ? JSON.stringify(body) : undefined })
  return { status: r.status, ...(await r.json()) }
}
const eng = (b) => call('POST', '/api/interview-engine', b)

assert.equal((await call('GET', '/api/interviews', null, false)).status, 401, 'no token is rejected')

// unverified users cannot start
await call('POST', '/api/auth/signup', { email: 'new@x.com', password: 'longenough1', name: 'New User' }, false)
assert.equal((await eng({ action: 'start', level: 'APM', category: 'metrics', difficulty: 'easy' })).error.code, 'email_unverified')
await call('POST', '/api/auth/verify')

// full interview path
const s = await eng({ action: 'start', level: 'APM', category: 'metrics', difficulty: 'medium', industry: 'fintech' })
assert.match(s.messages[0].content, /Hi New/); assert.match(s.messages[0].content, /Northwind Pay/)
assert.equal((await eng({ action: 'start', level: 'APM', category: 'metrics', difficulty: 'easy' })).error.code, 'already_running')
assert.equal((await eng({ action: 'submit_answer', text: '   ' })).error.code, 'empty_answer')
await eng({ action: 'submit_answer', text: 'First I would define the metric and its denominator because the user segment matters. Then I would break down by cohort and release, and compare the trade-off of rollback versus a fix.' })
assert.equal((await eng({ action: 'submit_answer', text: 'again' })).error.code, 'duplicate')
await call('POST', '/api/_dev/flags', { busyNext: true })
const busy = await eng({ action: 'next_question' })
assert.equal(busy.error.code, 'ai_busy'); assert.equal(busy.error.retryable, true)
assert.ok((await eng({ action: 'next_question' })).message.content)
await eng({ action: 'skip' }); await eng({ action: 'skip' })
assert.equal((await eng({ action: 'skip' })).error.code, 'no_skips', 'skips capped at 2 server-side')
const ended = await eng({ action: 'end', reason: 'user_ended' })
assert.equal(ended.session.status, 'completed')

// feedback: server computes the overall score as the average
await call('POST', '/api/interview-feedback', { id: s.session.id })
await new Promise((r) => setTimeout(r, 3200))
const rep = await call('GET', `/api/interviews/${s.session.id}`)
const f = rep.feedback
assert.equal(f.competency_scores.length, 5)
assert.equal(f.overall_score, Math.round((f.competency_scores.reduce((n, c) => n + c.score, 0) / 5) * 10) / 10)
assert.equal((await call('POST', `/api/interviews/${s.session.id}/rating`, { rating: 9 })).error.code, 'invalid_input')

// delete needs the typed word
assert.equal((await call('POST', '/api/delete-account', { confirm: 'nope' })).error.code, 'confirm_required')

// options
await call('POST', '/api/auth/login', { email: 'demo@promanai.dev', password: 'x' }, false)
assert.ok((await call('GET', '/api/industries')).industries.length >= 10)
const rm = await call('POST', '/api/roadmap', { areas: [{ area: 'metrics', score: 2.5 }, { area: 'behavioral', score: 3.6 }], hoursPerWeek: 3, weeks: 2 })
assert.ok(rm.weeks.every((w) => w.minutes <= 180), 'weekly time budget respected')
const peers = await call('GET', '/api/peers')
const slot = peers.peers[0].availability[0]
await call('PUT', '/api/availability', { slots: [slot] })
assert.equal((await call('POST', '/api/bookings', { peerId: 'p1', slot })).booking.status, 'confirmed')
assert.equal((await call('POST', '/api/bookings', { peerId: 'p1', slot })).error.code, 'slot_taken')
const parsed = await call('POST', '/api/experiences/parse', { text: 'Interviewer: Why PM?\nMe: I like users.' })
assert.equal(parsed.turns.length, 2)

// several focus areas: covered in canonical order, scored on all their competencies
await call('POST', '/api/_dev/reset', {}, false)
await call('POST', '/api/auth/login', { email: 'demo@promanai.dev', password: 'x' }, false)
const prog = await call('GET', '/api/progress')
assert.deepEqual(prog.areas.find((a) => a.area === 'metrics').points.map((p) => p.score), [2.5, 3.1], 'per-area trend, oldest first')
assert.equal(prog.focus.length, 3)
assert.equal((await eng({ action: 'start', level: 'PM', categories: ['metrics', 'nope'], difficulty: 'easy' })).error.code, 'invalid_input')
const multi = await eng({ action: 'start', level: 'PM', categories: ['metrics', 'product-sense'], difficulty: 'easy' })
assert.deepEqual(multi.session.categories, ['product-sense', 'metrics'])
assert.match(multi.messages[0].content, /How would you improve the experience/)
let q
for (let n = 0; n < 3; n++) { await eng({ action: 'submit_answer', text: 'I would focus on the user segment, pick one metric, and accept the trade-off of speed versus quality.' }); q = await eng({ action: 'next_question' }) }
assert.match(q.message.content, /switch to the Metrics part/)
assert.equal(q.session.current_category, 'metrics')
await eng({ action: 'end', reason: 'user_ended' })
await call('POST', '/api/interview-feedback', { id: multi.session.id })
await new Promise((r) => setTimeout(r, 3200))
const names = (await call('GET', `/api/interviews/${multi.session.id}`)).feedback.competency_scores.map((c) => c.name)
assert.equal(names.length, 9, 'union of both areas, Communication once')
assert.ok(names.includes('User empathy') && names.includes('Diagnosis'))

// study plan for a new user: self-assessed starter plan, baseline mock first, then it learns from a real score
await call('POST', '/api/auth/signup', { email: 'fresh@x.com', password: 'longenough1', name: 'Fresh User' }, false)
await call('POST', '/api/auth/verify')
assert.equal((await call('GET', '/api/plan')).plan, null)
const in3weeks = new Date(Date.now() + 20 * 864e5).toISOString().slice(0, 10)
let plan = (await call('POST', '/api/plan', { areas: [{ area: 'metrics', confidence: 1 }, { area: 'strategy', confidence: 2 }], hoursPerWeek: 3, interviewDate: in3weeks, level: 'APM' })).plan
assert.equal(plan.basis, 'self')
assert.equal(plan.weeks.length, 3, 'weeks come from the interview date')
assert.deepEqual(plan.weeks[0].mock, { areas: ['metrics', 'strategy'], baseline: true, done: false, interviewId: null }, 'least confident first')
const firstItem = plan.weeks[0].items[0].id
plan = (await call('POST', `/api/plan/items/${firstItem}`)).plan
assert.equal(plan.doneSteps, 1)
const baseline = await eng({ action: 'start', level: 'APM', categories: ['metrics'], difficulty: 'easy' })
await eng({ action: 'submit_answer', text: 'I would define the metric, segment by cohort and release, and compare the trade-off of a rollback.' })
await eng({ action: 'end', reason: 'user_ended' })
await call('POST', '/api/interview-feedback', { id: baseline.session.id })
await new Promise((r) => setTimeout(r, 3200))
plan = (await call('GET', '/api/plan')).plan
assert.equal(plan.weeks[0].mock.done, true, 'baseline counted once its report is ready')
assert.equal(plan.changes.length, 1); assert.equal(plan.changes[0].area, 'metrics'); assert.equal(plan.changes[0].from, null)
plan = (await call('POST', '/api/plan/update')).plan
assert.equal(plan.basis, 'reports'); assert.equal(plan.changes.length, 0)
assert.ok(plan.done.includes(firstItem), 'ticked items survive an update')
// AI tools: facts carry sources, one review per user per tool
const cat = await call('GET', '/api/ai-tools')
assert.ok(cat.tools.length >= 10 && cat.tools.every((t) => t.sources.length && t.checked))
const before = (await call('GET', '/api/ai-tools/granola')).tool
assert.equal((await call('POST', '/api/ai-tools/granola/reviews', { frequency: 'daily', rating: 5, tasks: ['meetings'], text: 'Too short', role: 'PM', industry: 'FinTech' })).error.code, 'invalid_input')
assert.equal((await call('POST', '/api/ai-tools/granola/reviews', { frequency: 'daily', rating: 5, tasks: ['meetings'], text: 'ghjkyl.bjuyawzrhegvjbk/nlhjxfgjestuirtlugkbm vbxfrdtfylg.vhgchdtkf', role: 'PM', industry: 'FinTech' })).error.code, 'invalid_input', 'keyboard mashing is rejected')
const review = { frequency: 'daily', rating: 2, tasks: ['meetings', 'nope'], text: 'I use it after every customer call, but the summaries miss the details I care about most.', role: 'PM', industry: 'FinTech' }
const mine = (await call('POST', '/api/ai-tools/granola/reviews', review)).review
assert.deepEqual(mine.tasks, ['meetings'], 'unknown tasks dropped')
await call('POST', '/api/ai-tools/granola/reviews', { ...review, rating: 3 })
const after = (await call('GET', '/api/ai-tools/granola')).tool
assert.equal(after.reviewCount, before.reviewCount + 1, 'posting again edits, it does not add')
assert.equal(after.myReviewId, mine.id)
assert.equal((await call('POST', `/api/ai-reviews/${mine.id}/helpful`)).error.code, 'own_review')
await call('POST', '/api/ai-tools/granola/reviews', { ...review, rating: 1, affiliated: true })
const aff = (await call('GET', '/api/ai-tools/granola')).tool
assert.equal(aff.affiliatedCount, 1); assert.equal(aff.rating, before.rating, 'an affiliated review does not move the rating')
assert.equal((await call('POST', '/api/ai-reviews/v17/helpful')).review.helpedByMe, true)

// AI product sense, clarifying questions, per-answer feedback and the "How do you use AI?" opening
await call('POST', '/api/_dev/reset', {}, false)
await call('POST', '/api/auth/login', { email: 'demo@promanai.dev', password: 'x' }, false)
const ai = await eng({ action: 'start', level: 'PM', categories: ['ai-product'], difficulty: 'medium', industry: 'fintech' })
assert.equal(ai.session.industry_name, 'FinTech')
assert.match(ai.messages[0].content, /AI feature/)
const cl = await eng({ action: 'clarify', text: 'Who is the main user here?' })
assert.equal(cl.messages[1].kind, 'clarify'); assert.match(cl.messages[1].content, /user segment/)
await eng({ action: 'submit_answer', text: 'First I would focus on shop owners because reconciling failed payments is their biggest pain. I would launch an assistant that explains each failed payment, with a quality bar from a test set reviewed by humans. The trade-off is speed versus accuracy, so it hands over to a person when it is unsure.' })
assert.ok((await eng({ action: 'next_question' })).message.content)
await eng({ action: 'end', reason: 'user_ended' })
await call('POST', '/api/interview-feedback', { id: ai.session.id })
await new Promise((r) => setTimeout(r, 3200))
const aiRep = (await call('GET', `/api/interviews/${ai.session.id}`)).feedback
assert.equal(aiRep.answers.filter((x) => !x.skipped).length, 1, 'the clarifying exchange is not scored')
assert.equal(aiRep.answers[0].verdict, 'Strong')
assert.ok(aiRep.competency_scores.some((c) => c.name === 'Evaluation and metrics'))
for (const a of aiRep.answers.filter((x) => !x.skipped)) for (const p of [...a.good, ...a.missing]) if (p.quote) assert.ok(a.answer.includes(p.quote), 'quotes are verbatim')
assert.ok(aiRep.answers[0].good.every((p) => p.quote), 'every strength is backed by a quote')
for (const c of aiRep.competency_scores.filter((x) => x.evidence)) assert.ok(aiRep.answers.find((a) => a.seq === c.evidence.seq).answer.includes(c.evidence.quote), 'skill evidence is verbatim')
const usage = await eng({ action: 'start', level: 'PM', categories: ['behavioral'], difficulty: 'easy', opening: 'ai-usage' })
assert.match(usage.messages[0].content, /how you use AI tools/)
const behavioralBefore = (await call('GET', '/api/progress')).areas.find((a) => a.area === 'behavioral').points.length
await eng({ action: 'submit_answer', text: 'I use an AI assistant to draft specs, then I check every number myself.' })
await eng({ action: 'end', reason: 'user_ended' })
await call('POST', '/api/interview-feedback', { id: usage.session.id })
await new Promise((r) => setTimeout(r, 3200))
assert.ok((await call('GET', `/api/interviews/${usage.session.id}`)).feedback, 'the practice still gets a report')
assert.equal((await call('GET', '/api/progress')).areas.find((a) => a.area === 'behavioral').points.length, behavioralBefore, 'but it does not touch progress')
console.log('api smoke test passed')
srv.close()
