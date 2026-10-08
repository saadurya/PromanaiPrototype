// Sample data for the mock backend. Every company, person and tool-usage claim here is fictional/illustrative.

export const CATEGORIES = {
  'product-sense': { label: 'Product Sense', competencies: ['User empathy', 'Problem framing', 'Solution creativity', 'Prioritization', 'Communication'] },
  execution: { label: 'Execution', competencies: ['Goal setting', 'Trade-offs', 'Stakeholder management', 'Risk handling', 'Communication'] },
  metrics: { label: 'Metrics', competencies: ['Metric selection', 'Diagnosis', 'Experiment design', 'Interpretation', 'Communication'] },
  strategy: { label: 'Strategy', competencies: ['Market understanding', 'Positioning', 'Long-term thinking', 'Trade-offs', 'Communication'] },
  behavioral: { label: 'Behavioral', competencies: ['Ownership', 'Collaboration', 'Conflict handling', 'Self-awareness', 'Communication'] },
}

export const INDUSTRIES = [
  { id: 'fintech', name: 'FinTech', company: 'Northwind Pay', ctx: 'a mobile payments app for small shop owners', user: 'a shop owner who takes 40 payments a day', metric: 'payment success rate', tension: 'fraud checks vs. checkout speed' },
  { id: 'ecommerce', name: 'E-commerce', company: 'Cartly', ctx: 'a marketplace for home goods', user: 'a first-time buyer comparing sellers', metric: 'checkout conversion', tension: 'seller choice vs. delivery reliability' },
  { id: 'edtech', name: 'EdTech', company: 'Lumina Learn', ctx: 'a test-prep app for college entrance exams', user: 'a student studying 45 minutes a night', metric: 'weekly active learners', tension: 'engagement vs. learning outcomes' },
  { id: 'healthtech', name: 'HealthTech', company: 'Pulse Clinic', ctx: 'a telemedicine service for routine check-ups', user: 'a patient booking a follow-up visit', metric: 'completed consultations', tension: 'access vs. clinical quality' },
  { id: 'saas', name: 'SaaS', company: 'Tasklane', ctx: 'a project-management tool for 10 to 50 person teams', user: 'a team lead onboarding a new team', metric: 'week-4 team retention', tension: 'power features vs. simplicity' },
  { id: 'consumer', name: 'Consumer Tech', company: 'Orbit Home', ctx: 'a smart-home hub with a companion app', user: 'a new owner setting up their first device', metric: 'setup completion', tension: 'hardware cost vs. software polish' },
  { id: 'social', name: 'Social Media', company: 'Chirpwave', ctx: 'a short-video app for hobbyists', user: 'a creator posting twice a week', metric: 'creator weekly posts', tension: 'creator growth vs. viewer experience' },
  { id: 'entertainment', name: 'Entertainment', company: 'Reelhouse', ctx: 'a streaming service for regional cinema', user: 'a household choosing what to watch on Friday night', metric: 'minutes watched per subscriber', tension: 'catalogue breadth vs. discovery' },
  { id: 'travel', name: 'Travel', company: 'Wayfound', ctx: 'a trip-planning and booking app', user: 'a traveller planning a 5-day trip with friends', metric: 'bookings per planner', tension: 'inspiration vs. booking intent' },
  { id: 'communication', name: 'Communication', company: 'Hushline', ctx: 'a team messaging app', user: 'a manager reading 200 unread messages after leave', metric: 'daily active teams', tension: 'notifications vs. focus' },
]

const DEFAULT_CTX = { company: 'Lumen', ctx: 'a photo-sharing app', user: 'a casual user', metric: 'weekly active users', tension: 'growth vs. quality' }

export const QUESTION_TEMPLATES = {
  'product-sense': (c) => `You are the PM at ${c.company}, ${c.ctx}. How would you improve the experience for ${c.user}? Start by telling me who you would focus on and why.`,
  execution: (c) => `${c.company}, ${c.ctx}, plans to launch a major feature in six weeks and engineering says it will take eight. Walk me through what you do.`,
  metrics: (c) => `${c.metric.charAt(0).toUpperCase() + c.metric.slice(1)} at ${c.company} dropped 8% week over week. How do you figure out what happened?`,
  strategy: (c) => `${c.company}, ${c.ctx}, is considering a new market segment. The tension is ${c.tension}. Would you enter it, and why?`,
  behavioral: (c) => `Tell me about a time you had to push a product decision forward without full agreement. (Think of it in the context of ${c.ctx}.)`,
}

export const HARD_SUFFIX = {
  easy: '',
  medium: ' Assume you have a small team and one quarter.',
  hard: ' Assume engineering capacity was just cut by a third and leadership wants visible results this quarter.',
}

export const FOLLOWUPS = {
  'product-sense': ['Who is the user you are NOT building for, and why?', 'You listed several ideas. Which one would you cut first, and what does that cost you?', 'How would you test your riskiest assumption before building anything?', 'Imagine the user hates your solution on day one. What was the most likely reason?'],
  execution: ['Who disagrees with your plan, and how do you bring them along?', 'What is the first thing you would cut from scope, and who needs to hear that?', 'What is the biggest risk you have not mentioned yet?', 'How do you decide whether to slip the date or cut the feature?'],
  metrics: ['Which single metric would you look at first, and why that one?', 'How would you tell a real drop from noise?', 'You find two plausible causes. How do you separate them?', 'What guardrail metric would you watch while you fix it?'],
  strategy: ['What would a competitor do in response in the first six months?', 'What would have to be true for this to be a bad idea?', 'What are you choosing NOT to do, and who loses out?', 'How does this decision look in three years?'],
  behavioral: ['What did the other person say, and how did you respond?', 'What would you do differently now?', 'How did you know the decision was right?', 'What was your specific role versus the team’s?'],
}

export const GENERIC_FOLLOWUPS = {
  shortAnswer: 'That was brief. Can you go one level deeper on your reasoning?',
  noUser: 'Who specifically is the user in your answer?',
  noMetric: 'How would you measure whether that worked?',
  noTradeoff: 'What is the trade-off you are accepting with that choice?',
}

export const CLOSING = 'Thank you, that is all the time we have. I will prepare your feedback report now.'

export const KEYWORDS = {
  'user empathy': /user|customer|pain|need|persona|segment/gi,
  'problem framing': /problem|goal|why|root|assum|constraint/gi,
  'solution creativity': /idea|option|alternative|solution|prototype/gi,
  prioritization: /priorit|impact|effort|rice|first|cut|trade/gi,
  communication: /because|first|second|finally|so that|in summary|therefore/gi,
  'goal setting': /goal|okr|target|success|outcome/gi,
  'trade-offs': /trade|versus|instead|cost|sacrifice|cut/gi,
  'stakeholder management': /stakeholder|align|engineering|design|legal|leadership|team/gi,
  'risk handling': /risk|mitigat|fallback|contingen|unknown/gi,
  'metric selection': /metric|kpi|rate|conversion|retention|north star/gi,
  diagnosis: /segment|cohort|funnel|breakdown|release|seasonal|bug/gi,
  'experiment design': /experiment|a\/b|control|hypothes|sample|variant/gi,
  interpretation: /significan|noise|correlat|causal|baseline|trend/gi,
  'market understanding': /market|competitor|segment|tam|trend|customer/gi,
  positioning: /position|differentiat|moat|brand|wedge/gi,
  'long-term thinking': /year|long.term|platform|ecosystem|compound|roadmap/gi,
  ownership: /i (led|owned|drove|decided)|my role|responsib/gi,
  collaboration: /we |together|partner|aligned|feedback/gi,
  'conflict handling': /disagree|conflict|pushback|concern|compromise/gi,
  'self-awareness': /learn|mistake|differently|realis|reflect/gi,
  'market understanding ': /market/gi,
}

const day = 86400000
const iso = (d) => new Date(Date.now() - d * day).toISOString()

export const EXPERTS = [
  { id: 'x1', name: 'Meera Iyer', role: 'Senior PM, Payments', company: 'Northwind Pay (sample)', years: 9, verified: true },
  { id: 'x2', name: 'Daniel Okafor', role: 'Group PM, Growth', company: 'Cartly (sample)', years: 12, verified: true },
  { id: 'x3', name: 'Sana Rahman', role: 'Director of Product', company: 'Lumina Learn (sample)', years: 14, verified: true },
  { id: 'x4', name: 'Tomás Beltrán', role: 'Product Lead, AI', company: 'Tasklane (sample)', years: 7, verified: true },
]

export const EXPERIENCES = [
  {
    id: 'e1', company: 'Northwind Pay (sample)', role: 'Associate Product Manager', industry: 'FinTech', round: 'Product sense', level: 'APM', outcome: 'Offer', posted: iso(12), author: 'Anonymous candidate', helpful: 41,
    summary: 'Interviewer pushed hard on who the user is before letting me jump to solutions.',
    turns: [
      { speaker: 'interviewer', text: 'How would you improve the payment experience for small shop owners?' },
      { speaker: 'candidate', text: 'I would start by segmenting shop owners: tea stalls with cash-heavy customers, versus boutique shops with card-first customers.', note: 'Segmented first' },
      { speaker: 'interviewer', text: 'Which segment do you pick, and what makes you confident?' },
      { speaker: 'candidate', text: 'The cash-heavy stalls, because failed payments cost them a sale on the spot, and they have the highest daily volume.' },
      { speaker: 'interviewer', text: 'What if those stalls do not trust QR codes at all?', note: 'Follow-up constraint' },
      { speaker: 'candidate', text: 'Then I would test an assisted flow with a printed code and a confirmation sound, and measure repeat use before building more.' },
    ],
    reviews: [
      { expertId: 'x1', rating: 4, verdict: 'Strong structure', comment: 'Segmenting before solving is exactly right. You could have named the metric you would use to pick the segment.' },
      { expertId: 'x2', rating: 3, verdict: 'Good, slightly safe', comment: 'Solid but conventional. The follow-up answer was the best part; start there next time.' },
    ],
  },
  {
    id: 'e2', company: 'Cartly (sample)', role: 'Product Manager', industry: 'E-commerce', round: 'Metrics', level: 'PM', outcome: 'Rejected', posted: iso(27), author: 'Anonymous candidate', helpful: 66,
    summary: 'Checkout conversion fell 6%. I jumped to causes and skipped defining the metric.',
    turns: [
      { speaker: 'interviewer', text: 'Checkout conversion dropped 6% last week. What do you do?' },
      { speaker: 'candidate', text: 'I would check whether there was a release or a payment gateway issue.', note: 'Jumped to causes' },
      { speaker: 'interviewer', text: 'Before that, how are we defining conversion here?', note: 'Redirect' },
      { speaker: 'candidate', text: 'Sessions that reach checkout divided by orders placed, I think.' },
      { speaker: 'interviewer', text: 'Is that the denominator you want if traffic mix changed?' },
      { speaker: 'candidate', text: 'Probably not. I would segment by channel and new versus returning users.' },
    ],
    reviews: [{ expertId: 'x2', rating: 2, verdict: 'Definition gap', comment: 'Always define the metric and its denominator out loud first. The recovery at the end was decent but late.' }],
  },
  {
    id: 'e3', company: 'Lumina Learn (sample)', role: 'Associate Product Manager', industry: 'EdTech', round: 'Behavioral', level: 'APM', outcome: 'Offer', posted: iso(41), author: 'Anonymous candidate', helpful: 29,
    summary: 'A conflict story. The interviewer kept asking what I personally did versus the team.',
    turns: [
      { speaker: 'interviewer', text: 'Tell me about a time you disagreed with an engineer on scope.' },
      { speaker: 'candidate', text: 'In my college project, our developer wanted to cut the onboarding quiz. I thought it was core to retention.' },
      { speaker: 'interviewer', text: 'What was your specific contribution to resolving it?', note: 'Probing ownership' },
      { speaker: 'candidate', text: 'I ran a five-user test of both versions and showed the completion difference. We kept a shorter quiz.' },
    ],
    reviews: [{ expertId: 'x3', rating: 4, verdict: 'Clear ownership', comment: 'Good use of evidence to resolve disagreement. Quantify the completion difference next time.' }],
  },
  {
    id: 'e4', company: 'Tasklane (sample)', role: 'Product Manager', industry: 'SaaS', round: 'Strategy', level: 'PM', outcome: 'Pending', posted: iso(5), author: 'Anonymous candidate', helpful: 12,
    summary: 'Asked whether to add an AI assistant. The interviewer wanted a "no" argued as well.',
    turns: [
      { speaker: 'interviewer', text: 'Should Tasklane build an AI assistant?' },
      { speaker: 'candidate', text: 'Yes. Competitors are shipping them and customers expect it.' },
      { speaker: 'interviewer', text: 'Now argue the opposite.', note: 'Challenge' },
      { speaker: 'candidate', text: 'It could dilute our simplicity advantage, and quality bars for AI features are high, so a weak launch hurts trust.' },
    ],
    reviews: [],
  },
]

const hash = (s) => [...s].reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
const HOURS = [7, 9, 12, 17, 19, 21]
export const SLOT_HOURS = HOURS
export function dayKeys(n = 7) {
  return Array.from({ length: n }, (_, i) => new Date(Date.now() + (i + 1) * day).toISOString().slice(0, 10))
}
function peerSlots(seed) {
  const out = []
  dayKeys().forEach((d) => HOURS.forEach((h) => { if (hash(seed + d + h) % 100 < 28) out.push(`${d}@${h}`) }))
  return out
}
export const PEERS = [
  { id: 'p1', name: 'Aarav S.', level: 'APM aspirant', focus: ['product-sense', 'metrics'], bio: 'Final-year student, prepping for APM roles.' },
  { id: 'p2', name: 'Lina M.', level: 'Career switcher', focus: ['behavioral', 'strategy'], bio: 'Six years in design, moving to product.' },
  { id: 'p3', name: 'Rohit K.', level: 'PM, 2 yrs', focus: ['execution', 'metrics'], bio: 'Preparing for senior PM loops.' },
  { id: 'p4', name: 'Chen W.', level: 'APM aspirant', focus: ['product-sense', 'execution'], bio: 'Engineer interested in B2B products.' },
  { id: 'p5', name: 'Fatima Z.', level: 'PM, 4 yrs', focus: ['strategy', 'behavioral'], bio: 'Happy to swap feedback on strategy answers.' },
].map((p) => ({ ...p, availability: peerSlots(p.id) }))

const R = (id, title, type, tier, minutes, topics, up, expertUp, source) => ({ id, title, type, tier, minutes, topics, up, expertUp, source, url: '#' })
export const RESOURCES = [
  R('r1', 'Product sense in 20 minutes: a repeatable answer structure', 'video', 'must', 20, ['product-sense'], 212, 9, 'Sample channel'),
  R('r2', 'Worked examples: improving a payments flow', 'video', 'should', 35, ['product-sense'], 98, 4, 'Sample channel'),
  R('r3', 'Open-source question bank with annotated answers', 'github', 'should', 60, ['product-sense', 'execution', 'metrics'], 143, 6, 'Sample repo'),
  R('r4', 'Prioritisation frameworks cheat sheet (RICE, Kano, MoSCoW)', 'diagram', 'must', 15, ['product-sense', 'execution'], 175, 8, 'Sample diagram'),
  R('r5', 'Execution: scoping and cutting under a deadline', 'article', 'must', 25, ['execution'], 120, 7, 'Sample blog'),
  R('r6', 'Stakeholder mapping templates', 'diagram', 'could', 10, ['execution', 'behavioral'], 41, 2, 'Sample diagram'),
  R('r7', 'Metrics 101: choosing a north star and guardrails', 'video', 'must', 30, ['metrics'], 230, 11, 'Sample channel'),
  R('r8', 'Debugging a metric drop: a step-by-step checklist', 'article', 'must', 20, ['metrics'], 188, 10, 'Sample blog'),
  R('r9', 'A/B testing for PMs, without the maths headache', 'video', 'should', 40, ['metrics'], 101, 5, 'Sample channel'),
  R('r10', 'Statistics refresher: significance and power', 'article', 'could', 45, ['metrics'], 37, 3, 'Sample blog'),
  R('r11', 'Strategy frameworks: where to play, how to win', 'article', 'must', 30, ['strategy'], 134, 8, 'Sample blog'),
  R('r12', 'Competitor teardown template (GitHub)', 'github', 'should', 25, ['strategy'], 66, 3, 'Sample repo'),
  R('r13', 'Behavioral stories: building a story bank with STAR', 'video', 'must', 25, ['behavioral'], 160, 9, 'Sample channel'),
  R('r14', 'Handling conflict questions without sounding scripted', 'article', 'should', 15, ['behavioral'], 84, 4, 'Sample blog'),
  R('r15', 'How PMs use AI day to day: a practical overview', 'video', 'should', 30, ['ai-for-pm'], 77, 4, 'Sample channel'),
  R('r16', 'Estimation and back-of-envelope sizing drills', 'github', 'could', 30, ['strategy', 'metrics'], 52, 2, 'Sample repo'),
]

export const AI_TOOLS = [
  { id: 't1', name: 'ChatGPT', category: 'General assistant', uses: ['Drafting PRDs', 'Brainstorming options', 'Summarising research'], industries: ['SaaS', 'E-commerce', 'Consumer Tech', 'EdTech'], companies: ['Tasklane (sample)', 'Cartly (sample)'], influence: 4.3, adoption: 'Widely used', updates: [{ when: 'This week', text: 'Sample update: longer context for document analysis.' }], up: 188, expert: [{ name: 'Tomás Beltrán', role: 'Product Lead, AI', vote: 1 }, { name: 'Daniel Okafor', role: 'Group PM, Growth', vote: 1 }] },
  { id: 't2', name: 'Claude', category: 'General assistant', uses: ['Long-document synthesis', 'Spec review', 'Competitor research'], industries: ['SaaS', 'FinTech', 'HealthTech'], companies: ['Northwind Pay (sample)', 'Pulse Clinic (sample)'], influence: 4.2, adoption: 'Widely used', updates: [{ when: 'Last week', text: 'Sample update: improved handling of large files.' }], up: 164, expert: [{ name: 'Meera Iyer', role: 'Senior PM, Payments', vote: 1 }] },
  { id: 't3', name: 'Notion AI', category: 'Docs and specs', uses: ['Meeting notes to action items', 'Spec first drafts', 'Wiki Q&A'], industries: ['SaaS', 'Communication'], companies: ['Hushline (sample)'], influence: 3.4, adoption: 'Growing', updates: [{ when: 'This month', text: 'Sample update: Q&A across workspace pages.' }], up: 92, expert: [{ name: 'Sana Rahman', role: 'Director of Product', vote: 1 }] },
  { id: 't4', name: 'Dovetail', category: 'Research synthesis', uses: ['Tagging interview transcripts', 'Theme clustering', 'Insight reports'], industries: ['EdTech', 'HealthTech', 'Consumer Tech'], companies: ['Lumina Learn (sample)'], influence: 3.6, adoption: 'Growing', updates: [{ when: 'This month', text: 'Sample update: auto-generated highlight reels.' }], up: 71, expert: [{ name: 'Sana Rahman', role: 'Director of Product', vote: 1 }] },
  { id: 't5', name: 'Amplitude', category: 'Analytics', uses: ['Natural-language chart questions', 'Anomaly alerts', 'Funnel diagnosis'], industries: ['E-commerce', 'FinTech', 'Social Media'], companies: ['Cartly (sample)', 'Chirpwave (sample)'], influence: 3.8, adoption: 'Growing', updates: [{ when: 'Last month', text: 'Sample update: AI-suggested follow-up analyses.' }], up: 84, expert: [{ name: 'Daniel Okafor', role: 'Group PM, Growth', vote: 1 }] },
  { id: 't6', name: 'Figma', category: 'Design and prototyping', uses: ['Rapid wireframes', 'Prototype from prompt', 'Copy variants'], industries: ['Consumer Tech', 'Travel', 'Entertainment'], companies: ['Wayfound (sample)', 'Reelhouse (sample)'], influence: 3.1, adoption: 'Growing', updates: [{ when: 'This month', text: 'Sample update: prompt-to-prototype for simple flows.' }], up: 58, expert: [] },
  { id: 't7', name: 'Perplexity', category: 'Research', uses: ['Market scans', 'Competitor facts with sources', 'Quick due diligence'], industries: ['FinTech', 'Travel', 'SaaS'], companies: ['Wayfound (sample)'], influence: 3.0, adoption: 'Growing', updates: [{ when: 'Last week', text: 'Sample update: deeper multi-step research mode.' }], up: 63, expert: [{ name: 'Tomás Beltrán', role: 'Product Lead, AI', vote: 1 }] },
  { id: 't8', name: 'Jira AI features', category: 'Delivery', uses: ['Ticket drafting', 'Backlog dedupe', 'Sprint summaries'], industries: ['SaaS', 'FinTech', 'Communication'], companies: ['Tasklane (sample)', 'Hushline (sample)'], influence: 2.7, adoption: 'Early', updates: [{ when: 'This month', text: 'Sample update: ticket breakdown suggestions.' }], up: 39, expert: [] },
]

export const SAMPLE_AUDIO_TRANSCRIPT = [
  { speaker: 'interviewer', text: 'Walk me through how you would improve onboarding for a team messaging app.' },
  { speaker: 'candidate', text: 'I would first find where new teams drop off. My guess is the invite step, since a lone user gets no value from messaging.', note: 'Named the likely drop-off' },
  { speaker: 'interviewer', text: 'Say you confirm that. What do you build?' },
  { speaker: 'candidate', text: 'A one-click invite link with a pre-filled welcome channel, and I would track how many teammates join within 24 hours.' },
  { speaker: 'interviewer', text: 'What if admins block invite links for security reasons?', note: 'Constraint follow-up' },
  { speaker: 'candidate', text: 'Then I would offer a domain-based auto-join the admin can approve once.' },
]

export function seedInterviews() {
  const mk = (id, category, difficulty, level, days, scores, overall, industry) => ({
    id, level, category, difficulty, industry: industry || null, status: 'completed', feedback_status: 'ready', timer_remaining_ms: 0, skips_used: 0,
    end_reason: 'time_up', created_at: iso(days), size_bytes: 3100 + id.length * 90, rating: null, feedback_attempts: 1,
    messages: [
      { seq: 1, role: 'interviewer', content: QUESTION_TEMPLATES[category](DEFAULT_CTX), submitted: true, skipped: false },
      { seq: 2, role: 'candidate', content: 'I would start with the user and the goal, then list options and pick one based on impact.', submitted: true, skipped: false },
    ],
    feedback: {
      overall_score: overall,
      explanation: 'Sample report generated for the prototype history.',
      competency_scores: CATEGORIES[category].competencies.map((name, i) => ({ name, score: scores[i], explanation: 'Sample explanation.' })),
      strengths: ['Clear structure', 'Good use of examples'],
      improvement_areas: ['Quantify impact', 'State trade-offs earlier'],
      suggestions: ['Practise defining the metric before diagnosing.'],
      model: 'mock-evaluator-1',
    },
  })
  return [ // newest first
    mk('s3', 'behavioral', 'easy', 'APM', 6, [4, 3.5, 3, 3.5, 4], 3.6),
    mk('s2', 'metrics', 'medium', 'APM', 14, [2.5, 2, 2, 2.5, 3.5], 2.5),
    mk('s1', 'product-sense', 'medium', 'APM', 21, [3.5, 3, 3.5, 3, 4], 3.4),
  ]
}
