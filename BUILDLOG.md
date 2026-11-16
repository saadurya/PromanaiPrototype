# ProManAI build log

What was actually changed, tested and decided, per working session. Jira tracks planned work; this log records what happened. Newest entry on top.

---

## 2026-11-16 — Three-pillar prototype rework (SCRUM-11, SCRUM-14, SCRUM-15, SCRUM-24, SCRUM-25)

**What changed**
- Navigation grouped by pillar: Practice (dashboard / new interview / history), Experiences (interview experiences / peer mocks), Learn (roadmap / PM AI tools), Account, Prototype checks. Old `/ideas/*` routes redirect.
- Opening page (/home) is interview-only: one headline ("Practice your PM interview with AI."), honest prototype copy (sample questions, follow-ups, scored feedback report - no duration/voice claims), and one "Start an interview" button going straight to the "Set up your interview" steps. Past sessions and learning progress moved to the Dashboard page (/dashboard). Interview experiences and Roadmap & resources moved into the top bar; the three-line menu keeps the full navigation and opens as an overlay panel. (Revised three times on owner feedback: Raise-copy layout, three-topic layout, then interview-first split from the dashboard.)
- Interview setup is now five steps: Level → Industry → Focus → Microphone → Confirm. Industry step offers 10 sample industries plus "No specific industry", with the industry's fictional company/user/metric/tension card on selection.
- Practice screen labelled "Sample interview"; simulated mic available in prototype builds so the full flow is clickable end to end.
- Report page: each improvement area links up to two matching sample resources with "Open in roadmap" deep links (`/roadmap?topic=…` pre-filters the directory).
- Experience detail: "Practise a <round> interview in <industry>" button opens setup pre-filled.
- Live interview and report headers show the industry name instead of the raw id.
- Deleted `src/options/Hub.tsx` and `src/options/Industry.tsx`. README updated.

**Tested**
- `npx tsc --noEmit` clean; `npm run build` clean; `npm run test:api` (mock backend smoke) passed.
- Scripted headless-Chrome end-to-end run of the full flow (login → setup → live → report → connectors) with zero JS errors; screenshots of every screen visually inspected, desktop and mobile.

**Decisions**
- Voice capture and the feedback engine stay simulated and clearly labelled as prototype; no external AI or voice service added.
- Auth (SCRUM-22) and storage (SCRUM-21) designs left unchanged — open product decisions, not for the prototype to settle.
- Simple opening page and hidden menu kept under SCRUM-11 (dashboard/navigation scope) rather than a new ticket.

**Blockers / open**
- Branch `three-pillar-rework` is local only; push to GitHub and the Vercel branch preview await owner's approval and a repo-scoped token.
- Login and storage product decisions remain open.

**Review**
- Walkthrough videos and screenshots shared on WhatsApp (Nov 16). Branch preview link pending push approval.
