// Output guard: every AI response (interviewer questions and feedback reports) passes through here
// before it is stored or shown. It never trusts the model's numbers or wording.
const SHINGLE = 6 // words in a row that count as an echo of a hidden prompt
const MAX_QUESTION = 500
const MAX_EXPLANATION = 400
const MAX_ITEM = 240
const MAX_ITEMS = 5

const words = (s) => String(s).toLowerCase().replace(/[^a-z0-9' ]+/g, ' ').split(/\s+/).filter(Boolean)
const norm = (s) => words(s).join(' ')

const LEAK = [
  /system prompt|my (?:hidden )?instructions|i (?:was|am) instructed|scoring rubric|as an ai(?: language)? model/i,
  /<\/?(?:system|instructions?|prompt)>/i,
]
const MODEL_ANSWER = [
  /\b(?:model|ideal|sample|perfect|reference|example) answer\b/i,
  /\bhere(?:'s| is) (?:how|what) (?:i|you) (?:would|should) (?:answer|say)\b/i,
  /\ba (?:strong|great|good|perfect|full[- ]marks?) (?:answer|response) would\b/i,
]

export function makeGuard(secrets) {
  const shingles = new Set()
  secrets.forEach((s) => { const w = words(s); for (let k = 0; k + SHINGLE <= w.length; k++) shingles.add(w.slice(k, k + SHINGLE).join(' ')) })
  const echoesSecret = (text) => { const w = words(text); for (let k = 0; k + SHINGLE <= w.length; k++) if (shingles.has(w.slice(k, k + SHINGLE).join(' '))) return true; return false }
  // Returns a reason string when the text must not be shown, otherwise null.
  const problem = (text) => {
    if (LEAK.some((re) => re.test(text)) || echoesSecret(text)) return 'prompt_leak'
    if (MODEL_ANSWER.some((re) => re.test(text))) return 'model_answer'
    return null
  }
  const clip = (s, n) => { const t = String(s ?? '').replace(/\s+/g, ' ').trim(); return t.length > n ? t.slice(0, n - 1).trimEnd() + '…' : t }

  function checkQuestion(raw) {
    if (typeof raw !== 'string') return { ok: false, reason: 'not_text' }
    const text = raw.replace(/\s+/g, ' ').trim()
    if (text.length < 10 || text.length > MAX_QUESTION) return { ok: false, reason: 'bad_length' }
    const p = problem(text)
    return p ? { ok: false, reason: p } : { ok: true, text }
  }

  // competencies: the exact rubric names expected, in order. answers: the candidate's submitted text.
  function checkFeedback(raw, { competencies, answers }) {
    if (!raw || typeof raw !== 'object' || !Array.isArray(raw.competency_scores)) return { ok: false, reason: 'bad_shape' }
    const said = norm(answers.join(' '))
    // Quotes presented as evidence must really be the candidate's words; drop any that are not.
    const realQuotes = (s) => s.replace(/\s*(?:Evidence:\s*)?"([^"]{12,})"/g, (m, q) => (said.includes(norm(q.replace(/…$/, ''))) ? m : ''))
    const comps = []
    for (const name of competencies) {
      const c = raw.competency_scores.find((x) => x && x.name === name)
      const n = Number(c?.score)
      if (!c || !Number.isFinite(n)) return { ok: false, reason: `missing_score:${name}` }
      comps.push({ name, score: Math.max(1, Math.min(5, Math.round(n * 2) / 2)), explanation: realQuotes(clip(c.explanation, MAX_EXPLANATION)) })
    }
    const list = (a) => (Array.isArray(a) ? a : []).map((x) => clip(x, MAX_ITEM)).filter(Boolean).slice(0, MAX_ITEMS)
    // The overall score is always recomputed here, never taken from the model.
    const overall = Math.round((comps.reduce((n, c) => n + c.score, 0) / comps.length) * 10) / 10
    const out = {
      overall_score: overall,
      explanation: `Overall ${overall}/5 across ${comps.length} competencies, computed by the server as the average of competency scores.`,
      competency_scores: comps,
      strengths: list(raw.strengths),
      improvement_areas: list(raw.improvement_areas),
      suggestions: list(raw.suggestions),
      model: clip(raw.model || 'unknown', 60),
    }
    const texts = [...comps.map((c) => c.explanation), ...out.strengths, ...out.improvement_areas, ...out.suggestions]
    for (const t of texts) { const p = problem(t); if (p) return { ok: false, reason: p } }
    return { ok: true, feedback: out }
  }

  return { checkQuestion, checkFeedback }
}
