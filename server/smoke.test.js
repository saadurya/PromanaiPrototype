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
console.log('api smoke test passed')
srv.close()
