# ProManAI dropped and parked ideas (SCRUM-13)

Decision history from the Sep-Oct 2026 team calls, kept visible so the team does not re-litigate settled calls. Status: draft for team review.

## Dropped

| Idea | Where it came from | Why it was dropped |
| --- | --- | --- |
| Per-question 2-minute time gates with on-screen feedback after each question | Mitul's initial technical vision (Oct 1 call) | The MVP became one continuous 20-minute dynamic interview with a single end-of-interview report; per-question gates broke the interview flow. |
| A separate LLM dedicated to per-question feedback | Oct 1 call | Dropped together with per-question feedback; one evaluation pass at the end replaced it. |
| Standalone voice-agent architecture | Oct 1 call | Mentor guidance: do not default to a voice agent; an STT + LLM + TTS pipeline is cheaper and easier to control. |
| Industry selection as its own menu item | Early prototype | Merged into the interview setup flow in the Oct 10 three-pillar direction; industry is part of the interview journey, not a separate destination. |
| Voice-test and AI-test pages in the main UI | Early prototype | Mentor UI feedback (Oct 10): prototype checks do not belong in the main navigation; functionality must not block concept review. Moved under "Prototype checks". |

## Parked (not decided, not forgotten)

| Idea | Status |
| --- | --- |
| Cross-session memory (per-user gap context carried between interviews, count- or time-based retention) | Floated Oct 1; absent from the later MVP but never explicitly closed. Belongs to the backend phase. |
| Interviewer tone selection | Floated Oct 1; unresolved. |
| Open-source STT/TTS models | Mentor feedback (Oct 2): validate quality and latency before locking; decision deferred to the real build. |
| Backend, storage and login/auth | Deliberately deferred: the current phase is a frontend-only prototype with sample data. See docs/storage-options.md and docs/login-decision.md. |
| Cross-browser voice support | Prototype targets desktop Chrome/Edge; a cross-browser answer is owed in the real build. |

## Nearly dropped, then kept

| Idea | What happened |
| --- | --- |
| Real interview experiences library and peer mock interviews | The team excluded both on the evening of Oct 10; Mitul re-merged them the same call as pillar 2, arguing users should read real experiences and then practise with peers inside the same product. |
