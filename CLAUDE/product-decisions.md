# Product decisions

What has been decided, what is still open, and what is deferred. Add new decisions at the top of the log, with the reason, so ideas do not creep back in without new evidence.

## Decision log

| Date | Decision | Why |
|---|---|---|
| 2026-10-10 | The AI interviewer must always be respectful and never offensive, enforced in layers: conduct rules, code checks on every question before it is spoken, the same rules for reports, a red-team test set (zero violations to launch) and "Report this question" monitoring. | Candidates are often nervous; one offensive line would destroy trust. A prompt alone is not a guardrail. |
| 2026-10-10 | The "How do you use AI?" practice is kept separate: it gets a report but does not touch progress, focus areas or the study plan. Labelled "AI question practice". | It is mostly one question, scored like a full behavioral round; counting it would pull the Behavioral trend down for no real reason. |
| 2026-10-10 | AI tools catalogue moved from "Ideas to compare" into the core product (Practice menu), visible to all users, with ratings and Share your experience. | Users should see and contribute to it; it also brings in search traffic and leads into practice. |
| 2026-10-10 | AI tools facts come from official sources (secondary only when the official page cannot be read), each with a source and a "checked on" date. Ratings come only from user reviews. | Facts about real products must be checkable; mixing facts and opinions hurts trust. |
| 2026-10-10 | Reviews from people who work with a tool's maker are shown but not counted in its rating. One review per user per tool; at least 10 real words. | Protects the rating from vendors and low-quality posts. |
| 2026-10-10 | Feedback quotes the candidate's own words, verbatim, for every point; the server drops any quote not found exactly in the answer. | Transparency: the candidate can check every point, which builds trust in the score. |
| 2026-10-10 | Study plan moved from "Ideas to compare" into the core product, built from interview reports, with a weekly mock interview. New users get a baseline interview first, or a labelled starter plan. | It completes the loop: report → plan → practise → new scores. |
| 2026-10-10 | Industry selection moved into interview setup as step 2 (optional, "General" by default); the scenario card was removed. | Industry shapes every question, so it belongs in setup; the card added little. |
| 2026-10-10 | Setup has 5 steps (Level, Industry, Focus, Microphone, Confirm); focus areas are multi-select, difficulty single-select. Returning users get "Same as last time?" with remembered settings and mic check. | Faster repeat practice; realistic mixed rounds. |
| 2026-10-10 | AI Product Sense added as a sixth focus area. | AI product rounds are increasingly common in PM interviews. |
| 2026-10-10 | Candidates can ask the interviewer clarifying questions (max 4 per interview, never scored). | Real case interviews start with clarifying questions. |
| 2026-10-10 | Distraction-free interview screen (no menu, "Leave for now"). | Focus, and fewer accidental exits. |
| 2026-10-10 | Peer mock interviews deferred to a later version (see below). | Two-sided marketplace, high build cost, does not strengthen the core. |
| 2026-10-10 | The demo has no real backend: an in-memory mock server stands in until the idea is validated. | Validate the concept and UX cheaply first. |

## Open questions

- **How many focus areas per interview?** Setup lets users pick several, and they share one 20-minute interview. With 4–5 areas, each gets only about 4–5 minutes, which may be too thin for a realistic round. Options: cap the selection at 2–3 areas, or warn when more than 3 are picked.
- **A 5-minute quick-practice format** (one question plus 2 follow-ups), for first-time users and single-question practice such as "How do you use AI?". Needs variable interview length on the server.
- **Start the first interview before email verification?** Faster time to value; verification would move to saving the first report.
- **Text mode as a first-class option**, not only a fallback for unsupported browsers.
- **Pricing:** a 30- or 60-day pass or interview packs, rather than an open-ended subscription, because preparation is episodic. To validate with a fake-door test.
- **Delete `src/options/Industry.tsx`?** Unused since industry moved into setup. Kept until someone confirms, because the folder is not under version control.

## Later versions

- **Peer mock interviews (idea 2):** deferred, not dropped. The page stays in the prototype for now.
  - **Why it waits:**
    - It needs enough active users on both sides: two candidates free at the same time with the same focus. Early on, most people would find no one free.
    - A real version needs much more than booking a slot: a live call, reminders, time zones, handling no-shows, and reporting and blocking, since strangers would be meeting.
    - It doesn't strengthen the core product, a solo AI interview with a scored report.
    - Bugs in the core interview flow affect every user and come first.
  - **Why keep it:** it's the only idea that offers practice with a real person, which AI can't fully replace.
  - **Possible cheap step:** label the page "Coming later" with a "Notify me" button, to see how many people want it.
- **Interview experiences (idea 1):** high interest, but needs legal advice first (confidentiality agreements, naming companies) and a moderation process.
