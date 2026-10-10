# Interview flow, start to end

The reference flow for the real product: everything that happens from the moment a candidate decides to practise until they know what to do next. It brings together the decisions in `implementation-notes.md` and `product-decisions.md`. Section 9 shows what the demo already does.

```
 BEFORE                 DURING (20 min, server-owned clock)                          AFTER
┌──────────┐   ┌─────────┬──────────────┬────────┬──────────────────────┬─────────┐   ┌──────────────┐
│ Entry    │   │ 1.      │ 2. Candidate │ 3.     │ 4. Core              │ 5.      │   │ Report       │
│ Setup    │──►│ Opening │ introduction │ Bridge │ turn loop: ask →     │ Close   │──►│ Progress     │
│ Checks   │   │ ~0:30   │ ~2:00        │ ~0:30  │ answer → next move   │ ~2:00   │   │ Study plan   │
│ Start    │   │         │              │        │ ~14:00               │         │   │ Next action  │
└──────────┘   └─────────┴──────────────┴────────┴──────────────────────┴─────────┘   └──────────────┘
```

## 0. Before the interview

**Entry points**
- "New interview" (menu or Dashboard).
- "Same as last time?" for returning users: settings and mic check remembered.
- "Practise this again" from a report; "Start" on a study-plan week's mock; "Practise this question" from the AI tools prep.

**Setup** (5 steps, skippable for returning users)
1. Role: Associate PM or Product Manager.
2. Industry: optional, "General" by default.
3. Focus areas (one or more) and difficulty.
4. Microphone check, remembered on this device for 7 days.
5. Review and start: every setting labelled with a Change button, plus the practice disclaimer.

**Checks before the clock starts**
- Email verified (or, if decided, allow the first interview before verification).
- No other interview in progress; if there is one, offer Resume or End it.
- Voice support in this browser (warn early if voice answers are not available and offer text mode).
- Interviewer voice available (cloud text-to-speech, browser voice as fallback).

**Start**
- The server creates the interview and starts the 20-minute clock.
- The screen switches to focus mode: no menu, only "Leave for now".

## 1. Opening (about 30 s, not scored)

The interviewer greets the candidate by name, introduces themselves and explains the format.

> "Hi Asha, thanks for joining. I'm Sam, a product lead here. We have about 20 minutes: I'd love to hear a bit about you, then we'll work through a product question together, and you'll have time for your questions at the end. Sound good?"

## 2. Candidate introduction (about 2 min, scored lightly)

> "To start, walk me through your background and what brings you to product management."

- One natural acknowledgment, at most one short follow-up ("What drew you to fintech?").
- If the intro runs long, the interviewer gently moves on ("Thanks, that's really helpful. Let's dive in.").
- Scored lightly (clarity, structure, length) in its own report section; never counted in core skills or progress.
- Users can skip this phase ("Jump straight to the case") for quick or repeat practice.

## 3. Bridge (about 30 s, not scored)

A short transition that uses what the candidate said, then the case.

> "You mentioned payments, so let's stay close to that. Northwind Pay is a mobile payments app for small shop owners…"

## 4. Core (about 14 min, most of the score)

### The turn loop

```
 Interviewer asks ──► Candidate responds ──► Interviewer chooses the next move ──┐
        ▲              (answer, clarifying                                      │
        │               question, silence,                                      │
        │               or skip)                                                │
        └───────────────────────────────────────────────────────────────────────┘
```

**How the candidate can respond**
- **Answer** by voice (editable transcript) or by typing, then submit. Nothing auto-submits.
- **Ask a clarifying question:** the interviewer gives a reasonable assumption, never the answer. Max 4 per interview, never scored.
- **Skip** the question: max 2 per interview, shown in the report.
- **Ask for a moment** ("Give me a minute to structure").
- **Say nothing:** after a long silence the interviewer checks in kindly.

**How the interviewer chooses the next move**

| Signal in the candidate's response | Move | Example |
|---|---|---|
| Vague or generic | Probe deeper | "You said 'improve engagement'. Which metric exactly?" |
| Unsupported or risky claim (only then) | Push back | "You chose new users. Power users drive most revenue. Why not them?" |
| Conflicts with an earlier answer | Point out the contradiction | "Earlier you said speed matters most; now you're adding a review step. Which wins?" |
| Solid answer, Hard difficulty, occasionally | Change a constraint | "Engineering capacity was just cut in half. What changes?" |
| Off-topic: does not answer the question asked | Redirect once, restating the question | "Let me bring us back. I asked how you'd measure success. Which metric would you pick?" |
| Confident but hollow: framework named, not applied | Drill down | "You mentioned RICE. Walk me through how you'd score this feature with it." |
| A number with no reasoning | Ask for the reasoning | "Where does the 30% come from?" |
| An invented case fact presented as known | Turn it into an assumption | "We don't actually have that data. What would you assume, and how would you check it?" |
| Generic, could apply to any product | Make it concrete | "How would that work for a shop owner taking 40 payments a day?" |
| Stuck, very short, "I'm not sure", silence | Encourage or nudge | "Take your time. Maybe start with who this is for." / "That's fine. How would you find out?" |
| Point covered well enough | Move on | Next part of the case |
| Area's share of time used, or 3 questions in it | Switch focus area | "Let's switch to the Metrics part of the interview." |

**Rules for every move**
- Always respectful, never offensive: challenge the idea, never the person; no sarcasm, mockery or condescension; never about personal characteristics. Every question is checked before it is spoken (see `ai-pipeline.md` → Respect guardrails).
- Follow-ups quote the candidate's own words ("You said '…'"), verbatim.
- Pushback is situational, never a quota; strong answers simply move on. Never in the opening, introduction or close; behavioral stories are probed, not challenged.
- Encouragement responds to behaviour, never comments on feelings, never gives the answer. Hints are noted in the report.
- At most 2 follow-ups on one thread, then move on, so every rubric skill is tested.
- Drill-downs on bluffs or off-topic answers are never accusatory ("you're bluffing" is never said); they are normal requests for specifics. Honesty is rewarded: "I don't know, here's how I'd find out" beats a confident wrong claim. Stating an assumption is good practice, not bluffing.
- One question at a time; no teaching and no scores during the interview.
- Difficulty changes the questions, never the tone: lighter probes and fuller hints on Easy; more and deeper challenges on Hard. "Hard" means harder questions, never a harsher tone.
- The interviewer returns a structured decision (move, question, skill tested, quote) so behaviour can be logged and tested.

**Several focus areas** are covered in a fixed order, each with its share of the core time.

### Time management

| When | What happens |
|---|---|
| Any early phase runs long | Gently moved on so the core keeps its time; the current phase shows next to the clock |
| 3 minutes left in the core | "We're short on time. In two sentences, what's your single most important recommendation?" |
| 1 minute left overall | Visible warning: submit now, unsubmitted text is not scored |
| Time up | The interview ends. An answer submitted in the last seconds is saved; an unsubmitted draft is not scored |

## 5. Close (about 2 min, scored lightly)

> "That's all from me. What questions do you have for me?"

- The interviewer answers briefly and in character, then wraps up warmly: "Thanks, Asha, I enjoyed this. I'll put together your feedback now."
- The quality of the candidate's questions is scored lightly, in its own report section.

## 6. Candidate controls during the interview

| Control | Effect |
|---|---|
| Replay question | Reads the current question again |
| Ask a clarifying question | See section 4 |
| Skip question | Max 2; marked as skipped in the report |
| Give me a minute | Signals thinking time; the interviewer waits |
| End interview | Confirmation, then straight to the report |
| Leave for now | Leaves focus mode; the interview stays open and can be resumed from the Dashboard |

## 7. Interruptions and failures

| What happens | Behaviour |
|---|---|
| Refresh or "Leave for now" | Resume prompt with time left; unsubmitted draft restored on this device |
| Offline or server unreachable | Banner, timer paused; at most 30 seconds charged per gap |
| AI interviewer fails | Instant switch to the backup model; last resort, a scripted follow-up from the question bank |
| Text-to-speech fails | Fall back to the browser voice; the question is always shown as text too |
| Speech-to-text fails | Offer typing; the transcript box stays editable |
| End request fails | Clear error with Try again; never a silent retry loop |

## 8. After the interview

**Report** (generated asynchronously, "Preparing your report…", with Retry on failure)
1. Overall band (Strong / Solid / Needs work) with a one-line summary: strongest skill, skill to work on first. Practice estimate, not a hiring prediction.
2. Introduction: clarity, structure, length.
3. Answer by answer: verdict per question; what worked and what was missing, each with the candidate's own words quoted verbatim and "See in transcript"; hints received; "Try next time".
4. How you handled pushback: only if pushback happened.
5. Skills: score per skill with its evidence quote and question number, or "No sentence showed this skill".
6. Your questions: quality of the questions asked at the end.
7. Next steps: "Practise this again" and "Build a study plan".
8. Rating ("How was this interview?") and the full transcript.

The evaluator is a calibrated model, separate from the interviewer. If it fails, the report waits and retries rather than being scored by an uncalibrated backup.

**Progress and study plan**
- Core skill scores update the Dashboard progress and Focus next. Introduction, closing and pushback sections never do; the "How do you use AI?" practice is excluded entirely.
- A saved study plan shows "Your scores changed" with an Update button, and marks that week's mock as done.

**Next action**
- The report ends with one clear next step: practise the weakest skill again, or follow the study plan.

## 9. Demo vs real

| Part of the flow | Demo today | Real product |
|---|---|---|
| Setup, checks, focus mode | Built | Same |
| Opening, introduction, bridge, close | Not built: starts straight with the case | AI interviewer, as above |
| Follow-ups | Simple rules (short answer, no user, no metric, no trade-off) | Adaptive moves from the candidate's words |
| Pushback, contradictions, changed constraints | Not built | Situational, as above |
| Encouragement | "Still there?" after 90 s of silence | Support moves from observable behaviour |
| Clarifying questions, skips, multi-area switching, time warnings | Built (canned clarification replies) | Same, with AI replies |
| "Give me a minute" | Not built | Planned |
| Interruptions and resume | Built | Same, plus AI backup model |
| Report with verbatim quotes | Built, scored by keyword rules | Calibrated AI evaluator, plus Introduction, pushback and Your questions sections |
| Progress, study plan updates | Built | Same, at skill level |
