# ProManAI build log

What was actually changed, tested and decided, per working session. Jira tracks planned work; this log records what happened. Newest entry on top.

---

## 2026-11-18 — Remaining prototype tickets (SCRUM-16, SCRUM-17, SCRUM-18, SCRUM-19, SCRUM-20) + docs (SCRUM-12, SCRUM-13, SCRUM-21, SCRUM-22)

**What changed**
- Daily practice page (/daily) for SCRUM-20: five daily topics across the interview categories, streak/XP/XP-today sample state, bonus "PM AI tools explorer" topic that unlocks after the daily five (Oct 10 call direction), "Practise this topic" deep links into interview setup. Navigation: under the Practice group in the menu. Dashboard shows a compact daily-practice card (streak, XP, topics done) linking to /daily. Sample state lives in the mock backend per user, labelled sample.
- Peer mock interviews (SCRUM-17): the mock backend now serves a sample question bank per category; suggested questions for whoever plays interviewer show in the booking modal and on each booked session (expandable).
- Interview experiences (SCRUM-16): company/role search box added next to the industry and round filters.
- Roadmap (SCRUM-18): plan weeks now show real date ranges computed from today ("Week 1 · 18 Nov – 24 Nov") and each week gets a milestone line naming the areas to cover by the week's end date.
- PM AI tools in the journey (SCRUM-19): sample tools are tagged to roadmap topics in the seed data; the roadmap plan shows "AI tools for your plan topics", the directory shows matching tools when a topic filter is selected, and each AI tool card links back to its roadmap topic.
- New docs/ folder: personas-jtbd.md (SCRUM-12), dropped-ideas.md (SCRUM-13), storage-options.md (SCRUM-21, comparison only, no selection), login-decision.md (SCRUM-22, options framed, decision pending).

**Tested**
- `npx tsc --noEmit` clean; `npm run build` clean; `npm run test:api` (mock backend smoke) passed.
- Scripted headless-Chrome run over the changed pages (daily practice, peer mocks, experiences, roadmap, AI tools, dashboard) with zero JS errors; screenshots visually inspected.

**Decisions**
- Gamification state is sample/demo state in the mock backend, not tied to real accounts - matches SCRUM-20's "sample state only" scope.
- SCRUM-22 (login) and SCRUM-21 (storage) documented as options/comparison only; the product decisions themselves stay with the owner and team.

**Blockers / open**
- SCRUM-22 needs the owner's decision recorded; SCRUM-23 (team Jira access) is team-side.

**Review**
- Branch preview updates after push; link is the stable branch URL shared on WhatsApp.

---

## 2026-11-16 — Three-pillar prototype rework (SCRUM-11, SCRUM-14, SCRUM-15, SCRUM-24, SCRUM-25)

**What changed**
- Navigation grouped by pillar: Practice (dashboard / new interview / history), Experiences (interview experiences / peer mocks), Learn (roadmap / PM AI tools), Account, Prototype checks. Old `/ideas/*` routes redirect.
- Opening page (/home) is interview-only: a centered headline ("Practice your PM interview with AI."), honest prototype copy (sample questions, follow-ups, scored feedback report - no duration/voice claims), one "Start an interview" button going straight to the "Set up your interview" steps, and a 1-2-3 Set up / Interview / Review strip (owner picked this centered layout over a plainer left-aligned one). Past sessions and learning progress moved to the Dashboard page (/dashboard). Interview experiences and Roadmap & resources moved into the top bar; the three-line menu keeps the full navigation and opens as an overlay panel. (Revised three times on owner feedback: Raise-copy layout, three-topic layout, then interview-first split from the dashboard.)
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

- The Option B homepage is an approved starting layout, not the final page: the owner plans streaks or other gamification and tighter interconnection between the non-interview pillars, which will reshape it later.

**Blockers / open**
- Branch `three-pillar-rework` is local only; push to GitHub and the Vercel branch preview await owner's approval and a repo-scoped token.
- Login and storage product decisions remain open.

**Review**
- Walkthrough videos and screenshots shared on WhatsApp (Nov 16). Branch preview link pending push approval.

## Nov 16 (later): landing demo entry (owner-approved)

- Landing page keeps its existing design, but the signed-out call-to-action is now a single "Login" button (header and hero). Clicking it signs into the sample account (demo@promanai.dev) and opens the refined home page directly - a demo entry for reviewers, not real authentication. The real /login and /signup pages are unchanged.
- Replaced the old "Start free" and "I already have an account" buttons per owner direction.
- `npx tsc --noEmit` clean; `npm run build` clean.

**Review**
- Branch pushed to GitHub (`three-pillar-rework`); Vercel preview verified live at the branch preview URL. Production/main unchanged.
