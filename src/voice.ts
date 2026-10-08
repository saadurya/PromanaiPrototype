// Browser voice helpers. Real Web Speech APIs where the browser has them (Chrome/Edge); otherwise callers offer the prototype fallback.
import { useCallback, useEffect, useRef, useState } from 'react'

const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null
export const recognitionSupported = !!SR

export function speak(text: string) {
  try { window.speechSynthesis.cancel(); window.speechSynthesis.speak(new SpeechSynthesisUtterance(text)) } catch { /* silent: Replay stays available */ }
}
export const stopSpeaking = () => { try { window.speechSynthesis.cancel() } catch { /* noop */ } }

const ERRORS: Record<string, string> = {
  'no-speech': 'We did not hear anything. Move closer to the mic and try again.',
  'audio-capture': 'No microphone was found. Check that one is connected.',
  'not-allowed': 'Microphone access is blocked. Allow it in your browser settings and try again.',
  network: 'Speech recognition lost its connection. Try again.',
}

export function useRecognizer(onText: (t: string) => void, getBase: () => string) {
  const [listening, setListening] = useState(false)
  const [error, setError] = useState('')
  const ref = useRef<any>(null)
  useEffect(() => () => { try { ref.current?.abort() } catch { /* noop */ } }, [])
  const stop = useCallback(() => { try { ref.current?.stop() } catch { /* noop */ } setListening(false) }, [])
  const start = useCallback(() => {
    if (!SR) { setError('Speech recognition is not supported here. Use desktop Chrome or Edge.'); return }
    setError('')
    const base = getBase()
    const r = new SR()
    r.continuous = true; r.interimResults = true; r.lang = 'en-US'
    r.onresult = (e: any) => { let t = ''; for (let i = 0; i < e.results.length; i++) t += e.results[i][0].transcript; onText((base ? base.trimEnd() + ' ' : '') + t.trim()) }
    r.onerror = (e: any) => { setError(ERRORS[e.error] || 'Speech recognition failed. Try again.'); setListening(false) }
    r.onend = () => setListening(false)
    ref.current = r
    try { r.start(); setListening(true) } catch { setError('Could not start the microphone. Try again.') }
  }, [onText, getBase])
  return { listening, error, start, stop, supported: !!SR }
}

export const SAMPLE_ANSWERS: Record<string, string[]> = {
  'product-sense': ['I would start by choosing one user segment instead of trying to serve everyone. For this product, the goal is to help casual users get value in their first week, so I would focus on new users. Their biggest pain is not knowing what to do first. I would explore three options: a guided first task, templates, and social prompts, and prioritise by impact and effort. I would pick the guided first task because it is cheap to test, and measure week-one activation.', 'The riskiest assumption is that users want guidance at all. Instead of building, I would run a five-user prototype test and compare completion with a control. The trade-off is that guidance can feel patronising to experienced users, so I would let them skip it.'],
  execution: ['First I would clarify the goal of the launch and who is waiting on it. Then I would ask engineering what drives the extra two weeks and which parts are the risk. I would propose cutting scope to a thin version that still delivers the outcome, align with design and leadership on what is out, and share a risk plan. The trade-off is polish versus date, and I would keep the date if the core outcome holds.', 'The biggest risk is an unknown integration. I would ask for a spike this week and set a checkpoint so we decide to slip or cut with data, not hope.'],
  metrics: ['First I would define the metric and its denominator, then check whether the drop is real by comparing to the usual weekly noise. Next I would break it down by cohort, channel, platform and release version to find where it concentrated. If it lines up with a release, I would check the release notes and error rates. My guardrail metric would be revenue per visitor so a fix does not trade quality for volume.', 'To separate two causes, I would look at the funnel step where users drop and compare affected and unaffected segments, then run a quick rollback test on a small slice.'],
  strategy: ['I would look at the size and growth of the segment, how well-served it is today, and whether our strengths transfer. The market looks attractive but crowded, so I would position on one clear wedge instead of competing broadly. The trade-off is that focusing means we say no to adjacent customers for a year. Over three years this could become a platform if we win the wedge.', 'A competitor would likely respond with price in six months, so our advantage must be something they cannot copy quickly, like data or distribution.'],
  behavioral: ['In a recent project, my team disagreed on scope. I owned the decision, so I listened to the concerns, gathered usage evidence, and proposed a smaller first release. We aligned together on a plan and shipped on time. I learned that bringing data early reduces conflict, and I would involve the sceptic sooner next time.', 'My specific role was to frame the options and run a quick test; the team built it. The decision felt right because adoption beat our target.'],
}
