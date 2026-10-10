// Browser voice helpers. Real Web Speech APIs where the browser has them (Chrome/Edge); otherwise callers offer the prototype fallback.
import { useCallback, useEffect, useRef, useState } from 'react'

const SR: any = typeof window !== 'undefined' ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition : null
export const recognitionSupported = !!SR

// A passed mic check is remembered on this device for a week, so returning users can skip it
const MIC_KEY = 'pm_mic_ok'
const WEEK_MS = 7 * 24 * 3600 * 1000
export const rememberMic = () => { try { localStorage.setItem(MIC_KEY, String(Date.now())) } catch { /* private mode */ } }
export const micPassedRecently = () => { try { return Date.now() - Number(localStorage.getItem(MIC_KEY) || 0) < WEEK_MS } catch { return false } }

// ---- Interviewer voice ----
// Browsers ship several voices; the default is usually the most robotic. We rank English voices so the natural ones win:
// Edge's "Microsoft … Online (Natural)" and Chrome's "Google …" online voices sound far more human than local ones.
const VOICE_KEY = 'pm_voice'
const synth = typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null
let voices: SpeechSynthesisVoice[] = []
const loadVoices = () => { try { voices = synth?.getVoices() ?? [] } catch { voices = [] } }
loadVoices()
synth?.addEventListener?.('voiceschanged', loadVoices)

const voiceScore = (v: SpeechSynthesisVoice) => {
  const n = v.name.toLowerCase()
  let s = 0
  if (/natural|neural/.test(n)) s += 50
  if (/google/.test(n)) s += 30
  if (/premium|enhanced/.test(n)) s += 25 // macOS / iOS higher-quality voices
  if (!v.localService) s += 5
  if (/^en-(us|gb)$/i.test(v.lang)) s += 5
  return s
}
export const isNaturalVoice = (v: SpeechSynthesisVoice) => voiceScore(v) >= 25
export const englishVoices = () => voices.filter((v) => /^en\b|^en-/i.test(v.lang)).sort((a, b) => voiceScore(b) - voiceScore(a) || a.name.localeCompare(b.name))
export const savedVoiceName = () => { try { return localStorage.getItem(VOICE_KEY) || '' } catch { return '' } }
export const saveVoiceName = (name: string) => { try { if (name) localStorage.setItem(VOICE_KEY, name); else localStorage.removeItem(VOICE_KEY) } catch { /* private mode */ } }
// Online voices (Edge "Online (Natural)", Chrome "Google …") stream from the vendor and can fail silently:
// offline, blocked, or in private windows. A voice that fails is skipped for the rest of the session.
const failed = new Set<string>()
const usable = () => englishVoices().filter((v) => !failed.has(v.name))
const pickVoice = () => usable().find((v) => v.name === savedVoiceName()) ?? usable()[0]
const deviceVoice = () => usable().find((v) => v.localService)
const fallbackListeners = new Set<(message: string) => void>()
export const onVoiceFallback = (f: (message: string) => void) => { fallbackListeners.add(f); return () => { fallbackListeners.delete(f) } }

let token = 0 // the latest request wins; stopSpeaking() and new questions invalidate older ones
let queued: SpeechSynthesisUtterance[] = [] // keep references: Chrome can drop utterances that get garbage-collected

// voice: a chosen voice, or null for the browser default (the last resort)
function say(text: string, voice: SpeechSynthesisVoice | null | undefined) {
  if (!synth) return
  const my = ++token
  synth.cancel()
  // a short gap after cancel(): Chrome and Edge can silently drop a speak() issued in the same tick
  setTimeout(() => {
    if (my !== token) return
    let started = false
    const fail = () => {
      if (my !== token || started) return
      if (!voice) return // already on the browser default: nothing else to try
      failed.add(voice.name)
      const next = deviceVoice() ?? null
      fallbackListeners.forEach((f) => f(`“${voice.name}” did not play in this browser, so the interviewer now uses ${next ? `“${next.name}”` : 'the browser default voice'}.`))
      say(text, next)
    }
    // one utterance per sentence: natural pauses, and Chrome's online voices cut off long single utterances after ~15 seconds
    queued = text.split(/(?<=[.!?])\s+/).filter(Boolean).map((part) => {
      const u = new SpeechSynthesisUtterance(part)
      if (voice) { u.voice = voice; u.lang = voice.lang }
      u.rate = 0.97
      u.pitch = 1
      u.onstart = () => { started = true }
      u.onerror = (e) => { if (e.error !== 'interrupted' && e.error !== 'canceled') fail() }
      return u
    })
    synth.resume() // Chrome can be left paused, which silences everything after it
    queued.forEach((u) => synth.speak(u))
    setTimeout(fail, 4000) // nothing started: treat the voice as failed
  }, 80)
}
export function speak(text: string) {
  try {
    if (!synth) return
    // voices load asynchronously; wait briefly for them so the first question is not read in the default voice
    if (voices.length) { say(text, pickVoice()); return }
    let done = false
    const go = () => { if (!done) { done = true; loadVoices(); say(text, pickVoice()) } }
    synth.addEventListener?.('voiceschanged', go, { once: true })
    setTimeout(go, 800)
  } catch { /* silent: Replay stays available */ }
}
export const stopSpeaking = () => { try { token++; synth?.cancel() } catch { /* noop */ } }

// the voice list for pickers; updates when the browser finishes loading voices
export function useVoices() {
  const [list, setList] = useState(englishVoices)
  const [selected, setSelected] = useState(() => pickVoice()?.name ?? '')
  useEffect(() => {
    const f = () => { loadVoices(); setList(englishVoices()); setSelected((s) => s || pickVoice()?.name || '') }
    f()
    synth?.addEventListener?.('voiceschanged', f)
    return () => synth?.removeEventListener?.('voiceschanged', f)
  }, [])
  const choose = useCallback((name: string) => { saveVoiceName(name); setSelected(name) }, [])
  return { voices: list, selected, choose, supported: !!synth }
}

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
  'ai-product': ['First I would check whether AI is needed at all: if a simple rule solves it, I would use the rule. For this product I would focus on one user segment and one painful task, and launch an assistant for that task only. Before launch I would build a test set of real cases and agree a quality bar with a human review. The main risk is a confident wrong answer, so the feature shows its sources and hands over to a person when it is unsure. The trade-off is speed versus accuracy.', 'I would measure answer quality with a weekly human-reviewed sample, plus the rate of users who accept or correct the suggestion. A guardrail metric would be complaints or support tickets about wrong answers. If cost per request grows faster than value, I would switch to a smaller model for the easy cases.'],
  'product-sense': ['I would start by choosing one user segment instead of trying to serve everyone. For this product, the goal is to help casual users get value in their first week, so I would focus on new users. Their biggest pain is not knowing what to do first. I would explore three options: a guided first task, templates, and social prompts, and prioritise by impact and effort. I would pick the guided first task because it is cheap to test, and measure week-one activation.', 'The riskiest assumption is that users want guidance at all. Instead of building, I would run a five-user prototype test and compare completion with a control. The trade-off is that guidance can feel patronising to experienced users, so I would let them skip it.'],
  execution: ['First I would clarify the goal of the launch and who is waiting on it. Then I would ask engineering what drives the extra two weeks and which parts are the risk. I would propose cutting scope to a thin version that still delivers the outcome, align with design and leadership on what is out, and share a risk plan. The trade-off is polish versus date, and I would keep the date if the core outcome holds.', 'The biggest risk is an unknown integration. I would ask for a spike this week and set a checkpoint so we decide to slip or cut with data, not hope.'],
  metrics: ['First I would define the metric and its denominator, then check whether the drop is real by comparing to the usual weekly noise. Next I would break it down by cohort, channel, platform and release version to find where it concentrated. If it lines up with a release, I would check the release notes and error rates. My guardrail metric would be revenue per visitor so a fix does not trade quality for volume.', 'To separate two causes, I would look at the funnel step where users drop and compare affected and unaffected segments, then run a quick rollback test on a small slice.'],
  strategy: ['I would look at the size and growth of the segment, how well-served it is today, and whether our strengths transfer. The market looks attractive but crowded, so I would position on one clear wedge instead of competing broadly. The trade-off is that focusing means we say no to adjacent customers for a year. Over three years this could become a platform if we win the wedge.', 'A competitor would likely respond with price in six months, so our advantage must be something they cannot copy quickly, like data or distribution.'],
  behavioral: ['In a recent project, my team disagreed on scope. I owned the decision, so I listened to the concerns, gathered usage evidence, and proposed a smaller first release. We aligned together on a plan and shipped on time. I learned that bringing data early reduces conflict, and I would involve the sceptic sooner next time.', 'My specific role was to frame the options and run a quick test; the team built it. The decision felt right because adoption beat our target.'],
}
