# Implementation notes for the real product

The demo is a prototype for validating the idea: an in-memory mock server, hard-coded questions, rule-based scoring and sample content. These notes record how each part should work when the real product is built. The API contract is in `backend-api.md`.

## Principles that carry over from the demo

- **The server owns the truth.** Timer, skips, clarifications, scores and plans are decided on the server; the browser only displays them.
- **Feedback quotes are verbatim.** Every feedback point quotes the candidate's own words exactly. The server drops any quote that is not word-for-word in the answer. This is the main source of trust in the report.
- **Facts carry sources.** Any factual claim about a real product (AI tools catalogue) shows its source and the date it was checked.
- **AI never invents content.** AI may select, explain and score, but resources, links, tool facts and quotes come from stored data or the candidate's own words.
- **Practice is not assessment.** Scores are practice estimates, never hiring predictions (see the Disclaimer page).

## 1. Natural interview flow

The demo starts straight with the case question from a hard-coded list, which feels artificial. The real AI interviewer should follow the arc of a real PM interview:

1. **Opening** (about 30 s): greet the candidate by name, introduce the interviewer and explain the format. Not scored.
2. **Candidate introduction** (about 2 min): "Walk me through your background and what brings you to PM", with a natural acknowledgment and at most one short follow-up. Scored lightly (clarity, structure, length) in its own "Introduction" section of the report.
3. **Bridge** (about 30 s): a short transition that uses what the candidate said ("You mentioned fintech, so let's stay close to that…"). Not scored.
4. **Core** (about 14 min): the case and follow-ups grounded in the candidate's answers. Most of the score comes from here.
5. **Close** (about 2 min): "What questions do you have for me?", then a natural wrap-up. Scored lightly on the quality of the candidate's questions.

Guardrails:
- Time-box the early phases so a long introduction is gently moved on and the core keeps its time. Show the current phase next to the clock.
- Use the candidate's introduction to personalise the bridge and the core.
- Sound conversational: short acknowledgments, the candidate's name now and then, varied phrasing.
- Let users skip the introduction ("Jump straight to the case") for quick or repeat practice.
- Keep introduction and closing feedback out of the core skill scores and progress trends.

## 2. AI interviewer and evaluator

**Interviewer**
- Follow-ups driven by the rubric and grounded in the candidate's actual answer.
- Fast replies, so it feels like a conversation.
- Safety rules: no personal, illegal or discriminatory questions.
- Clarifying questions get a reasonable assumption, never the answer.

**Adaptive follow-ups and pushback**

The interview must progress from the candidate's answers, like a real interviewer: follow-ups and pushback are generated from what the candidate just said. (The demo only adapts with simple rules: short answer, no user, no metric, no trade-off, little time left. It never quotes the candidate or challenges a claim.)

- On every turn the interviewer considers the transcript, the area's rubric, which skills are still untested, the time left and the difficulty, then picks one move:

  | Move | When | Example |
  |---|---|---|
  | Probe deeper | The answer is vague or generic | "You said 'improve engagement'. Which metric exactly, and why that one?" |
  | Push back | A claim is risky or unsupported | "You chose new users. Power users drive most revenue. Why not them?" |
  | Point out a contradiction | Two answers conflict | "Earlier you said speed matters most; now you're adding a review step. Which wins?" |
  | Change a constraint (harder levels) | The answer is solid; stress-test it | "Engineering capacity was just cut in half. What changes?" |
  | Move on | The point is covered well enough | Next part of the case, or the next focus area |
  | Encourage or nudge | The candidate seems stuck or tense (see below) | "Take your time, it's fine to think out loud. Maybe start with who this is for." |

- **Pushback is situational, not a quota.** Real interviewers mostly listen, probe and move on. Push back only when the answer warrants it: an unsupported or risky claim, a contradiction, a one-sided answer that ignores an obvious trade-off, or rushing past something important. A strong, well-reasoned answer simply gets "Move on", and many interviews will have no pushback at all.
- **Never push back** in the opening, the candidate introduction or the close. Behavioral stories are probed ("what did you do?"), not challenged.
- **Quote the candidate's words** in follow-ups ("You said '…'"), with the same verbatim guard as the report.
- **Difficulty changes the questions, never the tone.** "Hard" means harder questions, never a harsher tone. When pushback is warranted: lighter probes and fuller hints on Easy; more and deeper challenges on Hard, plus an occasional changed constraint to stress-test a solid answer. The tone is equally warm and respectful at every level.
- **Professional, never hostile:** one question at a time, no teaching mid-interview, no scores revealed.
- **No loops:** at most 2 follow-ups on one thread, then move on, so every rubric skill gets tested in the time.
- **Structured decisions:** the interviewer returns the move type, the question, the skill it tests and any quote, so its behaviour can be tested and logged.
- **Encouragement when the candidate struggles.** A practice tool should help a tense candidate recover, not watch them freeze. (The demo only shows "Still there? Take your time." after 90 seconds of silence.)
  - **React to observable behaviour, not guessed emotions:** long silence, very short or off-track answers, "I'm not sure" or "sorry, I'm nervous", asking for the question again, many restarts.
  - **Support moves, lightest first:** reassure ("Take your time, it's fine to think out loud") → acknowledge what's good → rephrase or narrow the question → offer a structure ("some people start with the user, then the problem") → offer to come back to it later.
  - **Rules:** warm but never patronising; never give the answer; never comment on feelings ("you seem anxious"), respond to the behaviour instead.
  - **Fair scoring:** reassurance and acknowledgment never affect the score. Hints (rephrasing, structure) are noted transparently in the report ("You got a hint on question 2") and only the hinted part counts slightly less.
  - **Difficulty:** Easy supports sooner and more fully; Hard still reassures but gives fewer hints.
  - **No emotion detection from voice tone or face:** intrusive, often inaccurate, and legally restricted in some regions (for example under the EU AI Act).
  - **Let the candidate ask for a moment:** a "Give me a minute to structure" option, as real candidates do.
- **Report section "How you handled pushback", only when pushback happened:** did the candidate defend a reasoned position, update their view with new facts, or fold? The evaluator scores it using the logged move types. An interview without pushback is never marked down for it.
- **Test before launch** with simulated candidates (strong, vague, rambling, stubborn) plus human review of real transcripts.

**Evaluator**
- A published rubric per focus area and skill.
- A **calibration set**: real transcripts graded by 3 experienced PMs. Ship scoring only when it agrees with them within about ±0.5 on most skills, and re-run the set before every model or prompt change, as a regression test.
- Show uncertainty honestly ("Low confidence: only one answer touched this skill").
- Prefer bands (Strong / Solid / Needs work) over decimal scores in the UI.
- Keep the verbatim-quote guard from the demo.
- Report sections for Introduction and Your questions, separate from the core skills (see section 1).

**Model strategy and fallback**
- **Separate AIs for separate jobs.** The interviewer must be fast and conversational (live, spoken); the evaluator must be careful, consistent and structured (asynchronous). An evaluator that did not run the conversation is also more independent.
- **Different fallbacks per role:**

  | Role | If the primary AI fails |
  |---|---|
  | Interviewer | Switch instantly to a backup model, ideally from another provider. Last resort: a scripted follow-up from the question bank (the demo's rule-based `nextQuestion`), so the interview never stalls. |
  | Evaluator | Wait and retry first; the report is already asynchronous. Fall back only to a model that passed the same calibration test against human PM graders. Always record which model scored the report (`Feedback.model`). Never let an uncalibrated model score silently: it would create fake jumps or drops in the candidate's progress trend. |

- **Starting points (Anthropic, prices per million tokens input / output, as of September 2026):**
  - Evaluator: Claude Opus 5.5 (`claude-opus-5-5`, $4 / $20) at high effort, with structured outputs for the report shape and prompt caching for the rubric.
  - Interviewer: compare Claude Opus 5.5 at low effort with Claude Sonnet 5.5 (`claude-sonnet-5-5`, $2 / $10); Claude Haiku 4.5 ($1 / $5) if quality holds. Stream replies so text-to-speech starts early.
  - Clarifying replies: same as the interviewer. Study-plan explanations and catalogue upkeep: a smaller model.
- **Choose by measurement, not reputation.** Run every candidate model (including other providers such as OpenAI or Google Gemini as backups) on the calibration set and measure interviewer reply latency. Repeat when providers release new models.
- **Build it behind a thin internal AI gateway:** each role configured with a primary, a backup and timeouts; product code never calls a provider directly. Tune prompts per provider, log which model handled each turn and report, and sign data-processing agreements with every provider that sees transcripts (mention them in the disclaimer).
- Provider outages need this gateway. Separately, Anthropic's API has a built-in fallback for the rare request a model declines on safety grounds.

**Cost control**
- Track cost per interview from day one (speech-to-text, interviewer, scoring).
- Cap free usage; use a cheaper model where quality allows.

## 3. Voice

- **Text-to-speech:** the demo uses the browser's built-in voices (the most natural installed English voice is chosen automatically, with a fallback to device voices when online voices fail, for example in private windows). Quality differs between browsers and machines. The real product should use a **cloud neural text-to-speech service** (for example Azure Neural TTS, Google Cloud TTS, OpenAI TTS or ElevenLabs) so every user hears the same human-sounding voice. Keep the browser voice as a fallback.
- **Speech-to-text:** the demo uses the browser's recognition, which only works in desktop Chrome and Edge. The real product should use a cloud speech-to-text service so it works in every browser and on mobile.
- **Text mode** should be a first-class option, not a fallback (accessibility, quiet places), and the report should note when answers were typed.
- **Privacy:** store text only, never audio; tell users that speech is processed by the speech provider.

## 4. Study plan

The demo plans by focus area from 18 sample resources with placeholder links. The real version:

**Content catalogue**
- One skill list shared by scoring and content, so a weak score finds the right material.
- Three kinds of content: **ProManAI's own skill drills** (short cases with model answers, scored by the evaluator; the backbone), **curated external resources** (linked, never copied, each with a source and a "checked on" date), and **mock interviews** as weekly checkpoints.
- Editors and experienced PM reviewers approve items; user suggestions go to a review queue; votes only affect ranking; a weekly job flags broken and stale links.

**Learner model**
- A score per skill over time, weighted to recent results, with a trend and a confidence level.
- Goals: interview date, role level, target industry, hours per week.
- Activity: items finished, skipped or marked helpful; drill scores.

**Planning engine (rules first, explainable)**
1. Prioritise skills: weakness × importance for the role × uncertainty. An unknown skill gets a baseline drill, not guessed study time.
2. Split time by priority, with a minimum and maximum per skill, so the weakest skill reliably gets the largest share. When content runs out, fill the time with drills and mocks for the weakest skills instead of leaving it unplanned.
3. Pick content: Must-know first, highest-rated, matching level and format, no repeats.
4. Schedule: study and drills mixed through each week, a mock every week, the final week mocks only, shorter as the interview gets closer.
5. Explain every decision ("Product Sense gets 40% of your time because it's your weakest skill").

AI comes later and only selects from the catalogue: it writes explanations, scores drills and suggests the next item.

**Feedback loop**
- Re-plan automatically after every scored interview or drill, and show what changed and why.
- Measure which items raise skill scores, rank those higher, and A/B test planning strategies.
- Key metric: skill improvement per hour studied.

## 5. AI tools catalogue

- **Facts:** maker, free plan, platforms, official site, each with a source and a "checked on" date. Official vendor pages win over secondary sources; facts older than 60 days are flagged. Re-check on a schedule; prices change often.
- **Reviews:** visible to all users; one review per user per tool; role and industry shown, never names; affiliated reviewers shown but not counted; real moderation queue behind the Report button.
- **Role in the product:** a traffic channel (searchable pages) and a bridge into practice through the "How do you use AI?" prep. Not part of the core skill loop.

## 6. Accounts, privacy and legal

- Real sign-in and email verification; consider letting the first interview start before verification.
- Consent for voice processing, a data-retention policy, export and delete (delete already exists).
- Comply with applicable data-protection law (for example GDPR, or India's DPDP Act, depending on the market).
- Have the disclaimer and terms reviewed by a lawyer.
- Get legal advice before building Interview experiences (confidentiality agreements, naming companies, moderation).

## 7. Measurement

- Funnel events: sign up → setup finished → interview started → 3 or more answers → report viewed → second interview → plan created → paid.
- North star: share of new users who complete a second scored interview within 7 days.
- Weekly signals: report usefulness rating, agreement between product scores and human graders, cost per interview.

## 8. Phasing, with go/no-go gates

| Phase | What | Move on only if |
|---|---|---|
| 0. Validate (2–4 weeks) | Run the current prototype with 15–20 target users; human grading comparison; fake-door pricing; one course partner conversation | 70% or more finish an interview; the report is rated useful; someone clicks "Buy" |
| 1. MVP (about 8 weeks) | Real AI interviewer and scorer for 3 areas, natural interview flow, report, progress, text mode, analytics, a paid pass | 30% or more do a second interview within 7 days; scores agree with human graders |
| 2. Improve the loop (about 8 weeks) | Study plan with drills, AI Product Sense, industry scenarios, reminders, a B2B pilot | Plan users improve faster than non-plan users |
| 3. Grow | AI tools catalogue for search traffic, referrals, cohort dashboard for partners; then reconsider Experiences and Peer mocks | Acquisition cost per paying user is below their lifetime value |
