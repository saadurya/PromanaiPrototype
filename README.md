# ProManAI prototype (frontend + mock backend)

    npm install
    npm run dev        # web on http://localhost:5173, mock API on :8787
    npm run test:api   # API smoke test

Sign in with "Continue with Google (prototype)" for a verified demo user, or sign up to see the unverified state.
Settings > Prototype tools triggers the AI-busy and report-failed screens, and has a **Candidate view** switch that hides "Ideas to compare" and the AI test for user-testing sessions. All data is in memory; sample data is fictional except the AI tools catalogue facts.

- `server/` mock backend (zero dependencies): interview-engine actions, feedback, ratings, progress, the study plan, the industry list used by setup, the AI tools catalogue, and the 2 idea APIs
- `src/pages/` core product (including Study plan, AI tools and Disclaimer)  ·  `src/options/` the 2 idea pages (/ideas/*)

## Demo only: no real backend yet

`server/` is a zero-dependency, in-memory mock. Interviews, scores, saved study plans and everything else reset when it restarts, and there is no real AI: questions come from fixed templates and scores from simple rules. A real backend will be built once the idea is validated.

Before each demo:

- **Re-check the AI tools facts** in `server/aiTools.js` (checked 10 Oct 2026). The page flags facts older than 60 days.
- **Pick an interviewer voice** in Voice test. Edge's "(Natural)" voices sound best, but they stream online and may not play in InPrivate windows.

## Building the real product

See the [CLAUDE](CLAUDE/README.md) folder:

- [backend-api.md](CLAUDE/backend-api.md): the API contract and server rules
- [implementation-notes.md](CLAUDE/implementation-notes.md): how each part should work for real
- [product-decisions.md](CLAUDE/product-decisions.md): decisions, open questions, later versions
