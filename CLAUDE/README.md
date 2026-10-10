# CLAUDE: implementation knowledge for ProManAI

The prototype in this repository is a demo for validating the idea. This folder records what we know about building the real product, so it does not get lost in conversations.

| File | What it holds |
|---|---|
| [interview-flow.md](interview-flow.md) | The complete interview flow from setup to next steps: phases, the turn-by-turn loop (probes, pushback, encouragement), candidate controls, time management, failures, and the report. Marks what the demo already does. |
| [ai-pipeline.md](ai-pipeline.md) | How AI is used and optimised: seeded question generation, the per-turn interviewer call (caching, structured decisions, code checks, latency), the two-step feedback pipeline with verbatim-quote guards, safety, cost and monitoring. |
| [backend-api.md](backend-api.md) | Every API endpoint, its request and response shapes, error codes, and the server rules a real backend must keep. The contract for building the backend. |
| [implementation-notes.md](implementation-notes.md) | How each part should work in the real product: natural interview flow, AI interviewer and evaluator, voice, study plan, AI tools catalogue, privacy, measurement and phasing. |
| [product-decisions.md](product-decisions.md) | Decisions made so far (with reasons), open questions, and features deferred to later versions. |

**Keep these files current.** When an endpoint or server rule changes, update `backend-api.md`. When a product decision is made or reversed, add it to the top of the log in `product-decisions.md`.
