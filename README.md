# ProManAI prototype (frontend + mock backend)

    npm install
    npm run dev        # web on http://localhost:5173, mock API on :8787
    npm run test:api   # API smoke test

Sign in with "Continue with Google (prototype)" for a verified demo user, or sign up to see the unverified state.
Settings > Prototype tools triggers the AI-busy and report-failed screens. All data is in memory and fictional.

- `server/` mock backend (zero dependencies): interview-engine actions, feedback, ratings, and the 5 idea APIs
- `src/pages/` core MVP flow  ·  `src/options/` the 5 idea pages (/ideas/*)
