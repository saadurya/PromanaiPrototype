# ProManAI prototype (frontend + mock backend)

    npm install
    npm run dev          # web on http://localhost:5173, mock API (Node) on :8787
    npm run dev:static   # web only: the mock API runs inside the page, like the static build
    npm run build        # static site; the mock API runs in the browser and saves to localStorage
    npm run test:api     # API smoke test

Log in with demo@promanai.dev / demo-pass (or "Continue with Google (prototype)") for a verified demo user with sample history,
or sign up to see the unverified state. There is no email service: the verification link appears on the dashboard instead.
Settings > Prototype tools triggers the AI-busy and report-failed screens. All data is fictional.

## Three-pillar layout (sample data)

The app is organized around three pillars, all reachable from the sidebar and the dashboard:

1. **Practice** - dashboard, interview setup (level, industry, focus, mic check, confirm), the live
   interview with controls (timer, skip, replay, end), and the feedback report. Industry selection is a
   step inside interview setup, not a separate menu. Each gap on the feedback report links to matching
   sample resources on the roadmap.
2. **Experiences** - the real-interview-experience library (/experiences) and peer mock interviews
   (/peer-mocks). An experience can be turned straight into a practice interview with the same round
   and industry.
3. **Learn** - the dated learning roadmap and voted resource directory (/roadmap) plus PM AI tools
   (/ai-tools). Average competency progress feeds back to the dashboard.

The old `/ideas/*` comparison routes redirect to the new pillar routes.

- `server/app.js` mock backend core (runs under Node and in the browser): accounts, interview engine, feedback, storage, the pillar APIs
- `server/guard.js` checks every AI question and report before it is shown (scores, prompt leaks, model answers, invented quotes)
- `server/index.js` Node HTTP wrapper  ·  `src/mockServer.ts` in-browser wrapper
- `src/pages/` core practice flow  ·  `src/options/` the experiences and learning pillar pages
