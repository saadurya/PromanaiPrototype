// Smoke test for the mock API. Run: npm run test:api
import http from 'node:http'
import assert from 'node:assert/strict'
import { createApp } from './index.js'
import { createCore } from './app.js'
import { makeGuard } from './guard.js'
import { SECRET_PROMPTS, EVALUATOR_PROMPT } from './prompts.js'

async function serve(opts) {
  const srv = http.createServer(createApp(opts))
  await new Promise((r) => srv.listen(0, r))
  const base = `http://localhost:${srv.address().port}`
  const call = async (method, path, body, token) => {
    const r = await fetch(base + path, { method, headers: { 'content-type': 'application/json', ...(token ? { authorization: `Bearer ${token}` } : {}) }, body: body ? JSON.stringify(body) : undefined })
    return { status: r.status, ...(await r.json()) }
  }
  return { srv, call }
}
const { srv, call } = await serve()
const as = (token) => ({
  call: (m, p, b) => call(m, p, b, token),
  eng: (b) => call('POST', '/api/interview-engine', b, token),
})

assert.equal((await call('GET', '/api/interviews')).status, 401, 'no token is rejected')
assert.equal((await call('GET', '/api/interviews', null, 'demo-token')).status, 401, 'the old shared token no longer works')

// 1. Login cannot be used to skip verification
assert.equal((await call('POST', '/api/auth/login', { email: 'stranger@x.com', password: 'whatever1' })).error.code, 'invalid_credentials', 'unknown email cannot log in')
const su = await call('POST', '/api/auth/signup', { email: 'new@x.com', password: 'longenough1', name: 'New User' })
assert.equal(su.user.verified, false)
assert.equal((await call('POST', '/api/auth/signup', { email: 'NEW@x.com', password: 'longenough1' })).error.code, 'email_taken')
assert.equal((await call('POST', '/api/auth/login', { email: 'new@x.com', password: 'wrong-pass' })).error.code, 'invalid_credentials')
const relog = await call('POST', '/api/auth/login', { email: 'new@x.com', password: 'longenough1' })
assert.equal(relog.user.verified, false, 'logging in again does not verify')
const A = as(su.token)
assert.equal((await A.eng({ action: 'start', level: 'APM', category: 'metrics', difficulty: 'easy' })).error.code, 'email_unverified')
assert.equal((await call('POST', '/api/auth/verify', { token: 'guess' })).error.code, 'invalid_token')
const resent = await A.call('POST', '/api/auth/resend-verification')
const token = new URL(resent.dev_verify_url, 'http://x').searchParams.get('token')
assert.equal((await call('POST', '/api/auth/verify', { token: new URL(su.dev_verify_url, 'http://x').searchParams.get('token') })).error.code, 'invalid_token', 'resending replaces the old link')
assert.equal((await call('POST', '/api/auth/verify', { token })).user.verified, true)
assert.equal((await call('POST', '/api/auth/verify', { token })).error.code, 'invalid_token', 'links are single use')

// full interview path
const s = await A.eng({ action: 'start', level: 'APM', category: 'metrics', difficulty: 'medium', industry: 'fintech' })
assert.match(s.messages[0].content, /Hi New/); assert.match(s.messages[0].content, /Northwind Pay/)
assert.equal((await A.eng({ action: 'start', level: 'APM', category: 'metrics', difficulty: 'easy' })).error.code, 'already_running')
assert.equal((await A.eng({ action: 'submit_answer', text: '   ' })).error.code, 'empty_answer')

// 4. drafts are saved immediately and restored on resume
assert.equal((await A.eng({ action: 'save_draft', id: s.session.id, text: 'First I would define', at: 1 })).saved, true)
assert.equal((await A.eng({ action: 'resume', id: s.session.id })).draft.text, 'First I would define')
const answer = 'First I would define the metric and its denominator because the user segment matters. Then I would break down by cohort and release, and compare the trade-off of rollback versus a fix.'
await A.eng({ action: 'submit_answer', text: answer })
assert.equal((await A.eng({ action: 'resume', id: s.session.id })).draft, null, 'submitting clears the draft')
assert.equal((await A.eng({ action: 'submit_answer', text: 'again' })).error.code, 'duplicate')
assert.equal((await A.eng({ action: 'save_draft', id: s.session.id, text: 'x' })).error.code, 'out_of_order', 'no draft while no question is open')
await A.call('POST', '/api/_dev/flags', { busyNext: true })
const busy = await A.eng({ action: 'next_question' })
assert.equal(busy.error.code, 'ai_busy'); assert.equal(busy.error.retryable, true)
assert.ok((await A.eng({ action: 'next_question' })).message.content)
await A.eng({ action: 'skip' }); await A.eng({ action: 'skip' })
assert.equal((await A.eng({ action: 'skip' })).error.code, 'no_skips', 'skips capped at 2 server-side')

// 7. another user cannot see or touch this interview
const B = as((await call('POST', '/api/auth/signup', { email: 'other@x.com', password: 'longenough2' })).token)
assert.equal((await B.call('GET', `/api/interviews/${s.session.id}`)).status, 404)
assert.equal((await B.eng({ action: 'resume', id: s.session.id })).status, 404)
assert.equal((await B.eng({ action: 'save_draft', id: s.session.id, text: 'hijack' })).status, 404)
assert.equal((await B.call('DELETE', `/api/interviews/${s.session.id}`)).status, 404)
assert.equal((await B.call('GET', '/api/interviews')).interviews.length, 0)

// ending keeps the unsent draft in the transcript, marked unsubmitted
const ended = await A.eng({ action: 'end', reason: 'user_ended', draft: 'Half-finished thought about guardrails', at: Date.now() })
assert.equal(ended.session.status, 'completed')
const unsent = ended.messages.find((m) => m.content === 'Half-finished thought about guardrails')
assert.equal(unsent.submitted, false)
assert.equal((await A.call('DELETE', '/api/interviews/nope')).status, 404)

// 5. feedback: guarded, server-computed, deterministic
await A.call('POST', '/api/interview-feedback', { id: s.session.id })
await new Promise((r) => setTimeout(r, 3200))
const f = (await A.call('GET', `/api/interviews/${s.session.id}`)).feedback
assert.equal(f.competency_scores.length, 5)
assert.ok(f.competency_scores.every((c) => c.score >= 1 && c.score <= 5 && Number.isInteger(c.score * 2)))
assert.equal(f.overall_score, Math.round((f.competency_scores.reduce((n, c) => n + c.score, 0) / 5) * 10) / 10)
assert.ok(!JSON.stringify(f).includes('guardrails'), 'unsubmitted text is never scored or quoted')
assert.equal((await A.call('POST', `/api/interviews/${s.session.id}/rating`, { rating: 9 })).error.code, 'invalid_input')

// 5. the guard itself
const g = makeGuard(SECRET_PROMPTS)
const comps = ['Metric selection', 'Diagnosis', 'Experiment design', 'Interpretation', 'Communication']
const raw = (over = {}) => ({ competency_scores: comps.map((name) => ({ name, score: 3, explanation: 'Fine.' })), strengths: ['a'], improvement_areas: ['b'], suggestions: ['c'], ...over })
const ok = g.checkFeedback(raw({ overall_score: 5, competency_scores: comps.map((name, k) => ({ name, score: [9, -2, '3.3', 2.24, 4][k], explanation: 'x' })) }), { competencies: comps, answers: [] })
assert.deepEqual(ok.feedback.competency_scores.map((c) => c.score), [5, 1, 3.5, 2, 4], 'scores clamped to 1-5 in half steps')
assert.equal(ok.feedback.overall_score, 3.1, 'overall recomputed, model value ignored')
assert.equal(g.checkFeedback(raw({ competency_scores: comps.slice(1).map((name) => ({ name, score: 3 })) }), { competencies: comps, answers: [] }).ok, false, 'missing competency rejected')
const leak = EVALUATOR_PROMPT.split('\n')[1]
assert.equal(g.checkFeedback(raw({ suggestions: [`Note: ${leak}`] }), { competencies: comps, answers: [] }).reason, 'prompt_leak')
assert.equal(g.checkFeedback(raw({ strengths: ['Per my system prompt, you did well'] }), { competencies: comps, answers: [] }).reason, 'prompt_leak')
assert.equal(g.checkFeedback(raw({ suggestions: ['Here is the model answer: start with users...'] }), { competencies: comps, answers: [] }).reason, 'model_answer')
const quoted = g.checkFeedback(raw({ competency_scores: comps.map((name) => ({ name, score: 3, explanation: 'Good. Evidence: "I would compare cohorts before and after the release"' })) }), { competencies: comps, answers: ['I said nothing like that.'] })
assert.ok(!quoted.feedback.competency_scores[0].explanation.includes('Evidence'), 'invented quotes are removed')
assert.equal(g.checkQuestion(`Sure. ${SECRET_PROMPTS[0].split('\n')[2]}`).ok, false, 'questions are checked too')
assert.equal(g.checkQuestion('How would you tell a real drop from noise?').ok, true)

// 6. storage: full blocks start, deleting the oldest frees space
{
  const small = await serve({ storageLimit: 27_000 })
  const D = { call: (m, p, b) => small.call(m, p, b, demo), eng: (b) => small.call('POST', '/api/interview-engine', b, demo) }
  const demo = (await small.call('POST', '/api/auth/login', { email: 'demo@promanai.dev', password: 'demo-pass' })).token
  const before = await D.call('GET', '/api/interviews')
  assert.equal(before.storage.full, true)
  assert.equal((await D.eng({ action: 'start', level: 'PM', category: 'strategy', difficulty: 'easy' })).error.code, 'storage_full')
  const oldest = [...before.interviews].sort((a, b) => a.created_at.localeCompare(b.created_at))[0]
  const gone = await D.call('DELETE', `/api/interviews/${oldest.id}`)
  assert.equal(gone.storage.full, false)
  assert.equal((await D.call('GET', `/api/interviews/${oldest.id}`)).status, 404)
  assert.ok((await D.eng({ action: 'start', level: 'PM', category: 'strategy', difficulty: 'easy' })).session)
  assert.equal((await D.call('DELETE', `/api/interviews/${(await D.eng({ action: 'status' })).active.id}`)).error.code, 'in_progress')
  small.srv.close()
}

// 7. delete needs the typed word, and wipes only this user
assert.equal((await A.call('POST', '/api/delete-account', { confirm: 'nope' })).error.code, 'confirm_required')
assert.equal((await A.call('POST', '/api/delete-account', { confirm: 'DELETE' })).deleted, true)
assert.equal((await A.call('GET', '/api/me')).status, 401, 'token revoked')
assert.equal((await call('POST', '/api/auth/login', { email: 'new@x.com', password: 'longenough1' })).status, 401, 'account gone')
assert.equal((await B.call('GET', '/api/me')).user.email, 'other@x.com', 'other users untouched')

// options
const demoTok = (await call('POST', '/api/auth/google')).token
const Demo = as(demoTok)
assert.equal((await Demo.call('GET', '/api/interviews')).interviews.length, 3, 'demo keeps its sample history')
assert.ok((await Demo.call('GET', '/api/industries')).industries.length >= 10)
const rm = await Demo.call('POST', '/api/roadmap', { areas: [{ area: 'metrics', score: 2.5 }, { area: 'behavioral', score: 3.6 }], hoursPerWeek: 3, weeks: 2 })
assert.ok(rm.weeks.every((w) => w.minutes <= 180), 'weekly time budget respected')
const peers = await Demo.call('GET', '/api/peers')
const slot = peers.peers[0].availability[0]
await Demo.call('PUT', '/api/availability', { slots: [slot] })
assert.equal((await Demo.call('POST', '/api/bookings', { peerId: 'p1', slot })).booking.status, 'confirmed')
assert.equal((await Demo.call('POST', '/api/bookings', { peerId: 'p1', slot })).error.code, 'slot_taken')
assert.equal((await B.call('GET', '/api/peers')).bookings.length, 0, 'bookings are per user')
const parsed = await Demo.call('POST', '/api/experiences/parse', { text: 'Interviewer: Why PM?\nMe: I like users.' })
assert.equal(parsed.turns.length, 2)
await Demo.call('POST', '/api/auth/logout')
assert.equal((await Demo.call('GET', '/api/me')).status, 401, 'logout revokes the token')
// browser build: the database survives a reload through load/save (localStorage there)
{
  let saved = null
  const save = (d) => { saved = JSON.parse(JSON.stringify(d)) }
  const one = createCore({ devTools: true, save })
  const up = await one({ method: 'POST', path: '/api/auth/signup', body: { email: 'keep@x.com', password: 'longenough3' } })
  await one({ method: 'POST', path: '/api/auth/verify', body: { token: new URL(up.body.dev_verify_url, 'http://x').searchParams.get('token') } })
  const st = await one({ method: 'POST', path: '/api/interview-engine', token: up.body.token, body: { action: 'start', level: 'PM', category: 'execution', difficulty: 'hard' } })
  await one({ method: 'POST', path: '/api/interview-engine', token: up.body.token, body: { action: 'save_draft', id: st.body.session.id, text: 'kept across reloads', at: 5 } })
  await one({ method: 'PUT', path: '/api/availability', token: up.body.token, body: { slots: [] } })
  const two = createCore({ devTools: true, load: () => saved, save })
  const back = await two({ method: 'POST', path: '/api/interview-engine', token: up.body.token, body: { action: 'resume', id: st.body.session.id } })
  assert.equal(back.body.draft.text, 'kept across reloads', 'session, token and draft restored')
  assert.equal((await two({ method: 'POST', path: '/api/auth/login', body: { email: 'keep@x.com', password: 'longenough3' } })).status, 200)
  assert.equal((await two({ method: 'GET', path: '/api/peers', token: up.body.token })).body.mine.length, 0)
}

console.log('api smoke test passed')
srv.close()
