// Plain-text export of an interview, shared by the report page and the storage clean-up flow.
import { CATEGORY_LABELS, fmtDate, get, type Feedback, type Msg, type Session } from './api'

export type ReportData = { session: Session; messages: Msg[]; feedback: Feedback | null }

const speaker = (m: Msg) => (m.role === 'interviewer' ? 'Interviewer' : m.submitted === false ? 'You (not submitted)' : 'You')

export function reportText(d: ReportData) {
  const { session: s, feedback: f, messages } = d
  const lines = [`ProManAI interview report`, `${CATEGORY_LABELS[s.category]} · ${s.level} · ${s.difficulty} · ${fmtDate(s.created_at)}`, '']
  if (f) {
    lines.push(`Overall score: ${f.overall_score}/5`, f.explanation, '', 'Competencies')
    f.competency_scores.forEach((c) => lines.push(`- ${c.name}: ${c.score}/5. ${c.explanation}`))
    lines.push('', 'Strengths', ...f.strengths.map((x) => `- ${x}`), '', 'Areas to improve', ...f.improvement_areas.map((x) => `- ${x}`), '', 'Suggestions', ...f.suggestions.map((x) => `- ${x}`))
  }
  lines.push('', 'Transcript', ...messages.map((m) => `${speaker(m)}: ${m.content}`))
  return lines.join('\n')
}

export function downloadReport(d: ReportData) {
  const a = document.createElement('a')
  a.href = URL.createObjectURL(new Blob([reportText(d)], { type: 'text/plain' }))
  a.download = `promanai-${d.session.category}-${d.session.id}.txt`
  a.click()
  URL.revokeObjectURL(a.href)
}

export const downloadReportById = async (id: string) => downloadReport(await get<ReportData>(`/interviews/${id}`))
