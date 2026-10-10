# ProManAI prototype (frontend + mock backend)

    npm install
    npm run dev          # web on http://localhost:5173, mock API (Node) on :8787
    npm run dev:static   # web only: the mock API runs inside the page, like the static build
    npm run build        # static site; the mock API runs in the browser and saves to localStorage
    npm run test:api     # API smoke test

Log in with demo@promanai.dev / demo-pass (or "Continue with Google (prototype)") for a verified demo user with sample history,
or sign up to see the unverified state. There is no email service: the verification link appears on the dashboard instead.
Settings > Prototype tools triggers the AI-busy and report-failed screens. All data is fictional.

- `server/app.js` mock backend core (runs under Node and in the browser): accounts, interview engine, feedback, storage, the 5 idea APIs
- `server/guard.js` checks every AI question and report before it is shown (scores, prompt leaks, model answers, invented quotes)
- `server/index.js` Node HTTP wrapper  ·  `src/mockServer.ts` in-browser wrapper
- `src/pages/` core MVP flow  ·  `src/options/` the 5 idea pages (/ideas/*)
