# Backend API

The API the demo server (`server/index.js`) exposes today. It is the contract for the real backend: the frontend already calls exactly these endpoints, so a real backend that keeps these shapes needs almost no frontend changes.

Each section says what the demo does and what the real backend must do differently.

## Conventions

- **Base path:** `/api`. JSON in, JSON out.
- **Auth:** `Authorization: Bearer <token>` on every endpoint except login, signup and `/_dev/reset`.
  - Demo: one fixed token (`demo-token`) and a single in-memory user.
  - Real: per-user tokens (or sessions) from a real identity provider. **Identity always comes from the token, never from the request body.**
- **Errors:** always `{ "error": { "code": string, "message": string, "retryable": boolean } }` with a matching HTTP status. `message` is user-facing and already written in plain language; the frontend shows it as is. `retryable: true` makes the frontend offer a Retry button.
- **Rate limits (per user, per minute):**
  - interview engine: 60 calls, **not counting** `status` and `heartbeat` (clock checks).
  - report generation (`/interview-feedback`): 6 calls.
  - Over the limit: `429 rate_limited`, `retryable: true`.
- **IDs:** opaque strings (`i…` interviews, `v…` tool reviews, `e…` experiences, `b…` bookings).
- **Dates:** ISO 8601 strings.

## Data types

```ts
User     = { id, name, email, verified: boolean }

Session  = {                       // an interview, without its messages
  id, level: 'APM' | 'PM',
  category: string,                // first focus area (kept for older records)
  categories: string[],            // all focus areas, in canonical order
  current_category: string,        // area being covered now
  difficulty: 'easy' | 'medium' | 'hard',
  industry: string | null, industry_name: string | null,
  opening: 'ai-usage' | null,      // "How do you use AI?" practice
  status: 'in_progress' | 'completed',
  feedback_status: 'none' | 'pending' | 'ready' | 'failed' | 'not_available',
  timer_remaining_ms: number, skips_used: number, clarifications: number,
  end_reason: 'user_ended' | 'time_up' | null,
  created_at, size_bytes, rating: { rating, comment } | null, has_feedback: boolean
}

Msg      = { seq, role: 'interviewer' | 'candidate', content, skipped: boolean,
             kind?: 'clarify',     // clarifying exchange: shown, never scored
             area?: string }       // focus area of an interviewer question

Feedback = {
  overall_score: number, band: 'Strong' | 'Solid' | 'Needs work', explanation,
  answers: AnswerFeedback[],       // question by question, in order
  competency_scores: { name, score, explanation,
                       evidence: { quote, cut?, seq, qn } | null }[],   // null = no sentence showed this skill
  strengths: string[], improvement_areas: string[], suggestions: string[], model: string
}
AnswerFeedback = { seq, question, answer?, area?, skipped: boolean,
                   verdict?: 'Strong' | 'Solid' | 'Needs work',
                   good?: FeedbackPoint[], missing?: FeedbackPoint[], tip? }
FeedbackPoint  = { text, quote?, cut?, note? }   // quote = candidate's own words, verbatim
```

## Account

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | `/auth/login` | `{ email, password }` | `{ token, user }` | Demo: any email and password works and returns a verified user. |
| POST | `/auth/signup` | `{ name, email, password }` (password 8+ chars) | `{ token, user }` | New users start **unverified**. Demo: signup wipes all demo data. |
| GET | `/me` | | `{ user }` | `401 unauthorized` if the token is invalid; the frontend then signs out. |
| PATCH | `/me` | `{ name }` | `{ user }` | Name trimmed to 60 chars. |
| POST | `/auth/verify` | | `{ user }` | Demo shortcut. Real: email verification link. |
| POST | `/delete-account` | `{ confirm: "DELETE" }` | `{ deleted: true }` | Deletes the account and all its data. `400 confirm_required` otherwise. |

## Interview engine

One endpoint, `POST /interview-engine`, with an `action` field. The server owns the clock, skips, clarifications and scoring; the browser only displays.

| Action | Body | Response | Errors |
|---|---|---|---|
| `status` | | `{ active: Session \| null, storage: { used, limit } }` | |
| `start` | `{ level, categories: string[], difficulty, industry?, opening?: 'ai-usage' }` | `{ session, messages }` (first question included) | `403 email_unverified`, `409 already_running`, `409 storage_full`, `400 invalid_input` |
| `resume` | `{ id }` | `{ session, messages }` | `404 not_found` |
| `heartbeat` | `{ id }` | `{ session }` | `409 not_running` |
| `submit_answer` | `{ id, text }` | `{ session, message, messages, ended }` | `400 empty_answer`, `400 too_long` (over 4,000 chars), `409 duplicate`, `413 session_too_large` |
| `next_question` | `{ id }` | `{ session, message }`, or `{ session, messages, ended: true }` | `409 out_of_order`, `429 ai_busy` (retryable; the answer is already saved) |
| `clarify` | `{ id, text }` | `{ session, messages: [question, reply] }` | `400 empty_answer`, `400 too_long` (over 600 chars), `409 out_of_order`, `409 no_clarifications` |
| `skip` | `{ id }` | `{ session, message }` | `409 no_skips`, `409 out_of_order` |
| `end` | `{ id, reason: 'user_ended' \| 'time_up' }` | `{ session, messages }` | |

Any action on an interview that has ended returns `409 not_running`, or `ended: true` with the final messages; the frontend then opens the report.

**Rules the real backend must keep:**
- **Clock:** 20 minutes, charged on the server from the time since the last request, with **at most 30 seconds charged per gap**, so closing the tab or losing connection does not burn the clock. At zero the interview ends with `time_up`.
- **One interview in progress per user.**
- **A submitted answer is saved before the clock is charged,** so an answer sent in the last seconds is never lost. The response then says `ended: true`.
- **Skips:** at most 2 per interview, counted on the server.
- **Clarifying questions:** at most 4 per interview. They are stored with `kind: 'clarify'`, shown in the transcript, and never scored or treated as answers.
- **Several focus areas:** covered in canonical order. The interviewer moves to the next area after 3 questions in an area, or once that area's share of the clock is used, but never in the last 3 minutes.
- **`opening: 'ai-usage'`** only applies when the only focus area is `behavioral`; it replaces the opening question with the "How do you use AI in your work?" question.
- **Limits:** an interview's text is capped at 200 KB; a user's total storage at 5 MB.

**Demo vs real:** the demo picks questions from fixed templates and simple rules (`nextQuestion`), and `clarify` replies with canned assumptions. The real backend replaces both with an AI interviewer that follows the natural interview flow in `implementation-notes.md`.

## Reports and history

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| POST | `/interview-feedback` | `{ id }` | `{ session }` | Starts writing the report: `feedback_status` becomes `pending`, then `ready` or `failed`. No submitted answers gives `not_available`. Errors: `409 not_finished`, `429 too_many_attempts` (5 per interview), `429 rate_limited`. |
| GET | `/interviews` | | `{ interviews: Session[], storage }` | Newest first. |
| GET | `/interviews/:id` | | `{ session, messages, feedback }` | The frontend polls this every 1.5 s while the report is `pending`. |
| POST | `/interviews/:id/rating` | `{ rating: 1–5, comment? }` | `{ rating }` | `409 not_finished` while in progress. Comment trimmed to 500 chars. |

**Rules the real backend must keep:**
- **Every quote in a report is the candidate's own words, verbatim.** The server drops any quote that does not appear exactly in the answer it cites. A real AI scorer must keep this guard.
- **Clarifying exchanges are never scored.**
- **The overall score is computed by the server** (average of the skill scores), never by the AI or the browser.

**Demo vs real:** the demo scores with keyword rules (`generateFeedback`, `answerFeedback`). The real backend uses an AI evaluator calibrated against human PM graders (see `implementation-notes.md`).

## Progress

| Method | Path | Response |
|---|---|---|
| GET | `/progress` | `{ scored: number, areas: [{ area, label, points: [{ id, date, score }] }], focus: [{ name, score, previous, area, label }] }` |

- `points` are oldest first. An area's score in one interview is the average of that area's skills, so an interview covering several areas counts for each of them.
- `focus` is the 3 weakest skills, using each skill's latest score.
- **The "How do you use AI?" practice (`opening: 'ai-usage'`) is excluded** from progress, study plan gaps and plan tracking.

## Study plan and resources

| Method | Path | Body | Response | Notes |
|---|---|---|---|---|
| GET | `/resources` | | `{ resources, gaps: [{ area, label, score, previous }] }` | `gaps` = latest score per area, the same numbers as Progress. |
| POST | `/resources/:id/vote` | `{ vote: 1 \| -1 }` | `{ resources }` | Voting the same way twice removes the vote. |
| GET | `/plan` | | `{ plan: Plan \| null }` | The saved plan, with live progress. |
| POST | `/plan` | `{ areas: [{ area, score? , confidence? }], hoursPerWeek, interviewDate?, weeks?, level? }` | `{ plan }` | Replaces any saved plan. `confidence` (1–3) is used when there is no score (new users). |
| POST | `/plan/update` | | `{ plan }` | Rebuilds with the latest scores; keeps ticked items and the start date. |
| POST | `/plan/items/:resourceId` | | `{ plan }` | Toggles a resource as done. |
| POST | `/plan/reset` | | `{ plan: null }` | |
| POST | `/roadmap` | same as `POST /plan` | plan without saving | Stateless builder, used by tests. |

`Plan` adds to the built weeks: `basis: 'self' | 'reports'`, `snapshot` (scores when it was made), `changes` (scores that moved since), `done`, `steps`, `doneSteps`, `currentWeek`, and per week a `mock: { areas, baseline, done, interviewId }`.

**Rules:** weaker areas get more time; an area with no evidence gets little time until it has a score; weeks come from the interview date (1–12); each week ends with a mock on its 2 weakest areas (a self-assessed plan opens with a baseline mock); a week's mock is marked done when an interview on one of its areas is scored after the plan started.

**Demo vs real:** the demo plans from 18 sample resources with placeholder links, at area level. The real version plans at skill level from a curated catalogue plus ProManAI drills (see `implementation-notes.md`).

## AI tools catalogue

| Method | Path | Body | Response |
|---|---|---|---|
| GET | `/ai-tools` | | `{ tools, tasks, roles, frequency, industries }` |
| GET | `/ai-tools/:id` | | `{ tool, reviews, tasks, roles, frequency, industries }` |
| POST | `/ai-tools/:id/reviews` | `{ frequency, rating: 1–5, tasks: string[], text, role, industry, affiliated? }` | `{ review }` |
| POST | `/ai-reviews/:id/helpful` | | `{ review }` (toggles) |
| POST | `/ai-reviews/:id/report` | | `{ review }` |

A tool carries its facts (`maker`, `freePlan`, `freeNote`, `platforms`, `site`), its `sources` (`kind: 'official' | 'secondary'`, `label`, `url`), the `checked` date, a `stale` flag (older than 60 days), and review statistics (`rating`, `reviewCount`, `ratedCount`, `affiliatedCount`, `sampleCount`, `breakdown`, `topTasks`, `myReviewId`).

**Rules the real backend must keep:**
- **One review per user per tool.** Posting again edits it.
- **Reviews need at least 10 real words** (letters only, 2–20 long, with a vowel), so keyboard mashing is rejected. Max 1,500 characters.
- **Reviews from people who work with the maker are shown but not counted** in the rating or breakdown.
- **Users cannot mark their own review as helpful** (`409 own_review`).
- Reviews show role and industry only, never the reviewer's name.

**Demo vs real:** facts live in `server/aiTools.js`, checked on 10 Oct 2026. Reports are only stored; the real backend needs a moderation queue. In the demo every account shares one data set; in the real product every user sees every review.

## Setup data

| Method | Path | Response |
|---|---|---|
| GET | `/industries` | `{ industries: [{ id, name, company, ctx, user, metric, tension, questions }] }` |

## Ideas still being compared (not core)

These back the remaining idea pages. Build them in the real backend only if the ideas are chosen.

| Method | Path | Purpose |
|---|---|---|
| GET | `/experiences` | Library of interview experiences and experts |
| POST | `/experiences/parse` | Turn a pasted transcript (or sample audio) into turns. `422 unparseable` if no turns found |
| POST | `/experiences` | Publish an experience |
| POST | `/experiences/:id/helpful` | Toggle helpful |
| POST | `/experiences/:id/reviews` | Add an expert ranking |
| GET | `/peers` | Availability grid, peers and bookings |
| PUT | `/availability` | Save your free slots |
| POST | `/bookings` | Book a peer mock (`409 slot_unavailable`, `409 slot_taken`) |
| POST | `/bookings/:id/cancel` | Cancel a booking |
| POST | `/bookings/:id/feedback` | Leave feedback after a session |

## Demo-only endpoints (do not build)

| Method | Path | Purpose |
|---|---|---|
| POST | `/_dev/flags` | `{ busyNext?, feedbackFailNext? }`: make the next AI question or report fail, to show the fallback screens |
| POST | `/_dev/reset` | Reset all demo data |
| POST | `/interview-ai` | Stateless sandbox behind the "AI test" page (`opening`, `followup`, `evaluate`) |

## Keeping this file current

Update this file whenever an endpoint, a body or response shape, an error code, or a server rule changes. `server/smoke.test.js` exercises most of these rules; run it with `npm run test:api`.
