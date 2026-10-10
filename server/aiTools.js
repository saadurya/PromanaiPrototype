// AI tools catalogue for the demo.
// Facts (maker, free plan, platforms) were checked against the sources listed on each tool, on the date in `checked`.
// Official = the maker's own page. Secondary = an independent write-up, used only where the official page could not be read.
// Descriptions are our own words. Reviews marked `sample` were written for this demo and are not from real users.

const CHECKED = '2026-10-10'
const official = (url) => ({ kind: 'official', label: 'Official pricing page', url })
const secondary = (label, url) => ({ kind: 'secondary', label, url })

export const TOOL_TASKS = {
  prd: 'Writing PRDs and specs',
  research: 'Research synthesis',
  competitors: 'Competitor research',
  data: 'Data analysis',
  proto: 'Prototyping',
  meetings: 'Meeting notes',
  comms: 'Stakeholder updates',
  ideas: 'Brainstorming',
}
export const TOOL_ROLES = ['APM', 'PM', 'Senior PM', 'Group PM or Lead', 'Other']
export const TOOL_FREQUENCY = { daily: 'Daily', weekly: 'Weekly', tried: 'Tried it a few times' }

export const AI_TOOLS = [
  {
    id: 'chatgpt', name: 'ChatGPT', maker: 'OpenAI', category: 'General assistant', site: 'https://chatgpt.com',
    summary: 'A general-purpose AI chat assistant for writing, analysis, files and images.',
    freePlan: 'yes', freeNote: 'Free plan with limits on the newest models. Paid plans for individuals (Plus, Pro) and organisations (Business, Enterprise).',
    platforms: null, checked: CHECKED,
    sources: [secondary('IntuitionLabs plan comparison (2026)', 'https://intuitionlabs.ai/articles/chatgpt-plans-comparison')],
    sourceNote: 'The official pricing page (chatgpt.com/pricing) could not be read automatically, so these facts come from an independent source. Confirm on the official page.',
  },
  {
    id: 'claude', name: 'Claude', maker: 'Anthropic', category: 'General assistant', site: 'https://claude.com',
    summary: 'A general-purpose AI assistant, often used for long documents, writing and analysis.',
    freePlan: 'yes', freeNote: 'Free plan for everyone. Paid plans: Pro, Max, Team and Enterprise.',
    platforms: ['Web', 'iOS', 'Android', 'Desktop'], checked: CHECKED,
    sources: [official('https://claude.com/pricing')],
  },
  {
    id: 'gemini', name: 'Gemini', maker: 'Google', category: 'General assistant', site: 'https://gemini.google',
    summary: "Google's AI assistant, available with a Google account.",
    freePlan: 'yes', freeNote: 'Free with a Google account. Paid plans: Google AI Plus, Pro and Ultra.',
    platforms: ['Web', 'Android', 'iOS'], checked: CHECKED,
    sources: [official('https://gemini.google/subscriptions/')],
  },
  {
    id: 'perplexity', name: 'Perplexity', maker: 'Perplexity AI', category: 'Research', site: 'https://www.perplexity.ai',
    summary: 'An AI search engine that answers questions with cited web sources.',
    freePlan: 'yes', freeNote: 'Free plan with unlimited quick searches and a small daily number of Pro searches. Paid plans: Pro, Max and Enterprise.',
    platforms: null, checked: CHECKED,
    sources: [secondary('Finout pricing overview (2026)', 'https://www.finout.io/blog/perplexity-pricing-in-2026')],
    sourceNote: 'The official pricing page could not be read automatically, so these facts come from an independent source. Confirm on the official page.',
  },
  {
    id: 'notion-ai', name: 'Notion AI', maker: 'Notion Labs', category: 'Docs and knowledge', site: 'https://www.notion.com',
    summary: 'AI features inside Notion docs and databases: drafting, summarising and filling in tables.',
    freePlan: 'trial', freeNote: "Notion's free plan includes a trial of Notion AI. Paid plans (Plus, Business, Enterprise) include Notion AI.",
    platforms: null, checked: CHECKED,
    sources: [official('https://www.notion.com/pricing')],
  },
  {
    id: 'figma-make', name: 'Figma Make', maker: 'Figma', category: 'Prototyping', site: 'https://www.figma.com',
    summary: 'Turns written prompts into interactive prototypes inside Figma.',
    freePlan: 'no', freeNote: "Figma's free Starter plan includes some AI credits, but Figma Make itself needs a paid plan (Professional, Organization or Enterprise).",
    platforms: null, checked: CHECKED,
    sources: [official('https://www.figma.com/pricing/')],
  },
  {
    id: 'miro-ai', name: 'Miro AI', maker: 'Miro', category: 'Whiteboarding', site: 'https://miro.com',
    summary: 'AI on Miro whiteboards: generating diagrams, tables and summaries from sticky notes.',
    freePlan: 'yes', freeNote: "Miro's free plan includes a small number of AI credits per month. Paid plans: Starter, Business and Enterprise.",
    platforms: null, checked: CHECKED,
    sources: [official('https://miro.com/pricing/')],
  },
  {
    id: 'dovetail', name: 'Dovetail', maker: 'Dovetail', category: 'User research', site: 'https://dovetail.com',
    summary: 'A customer research repository that analyses calls, documents and surveys.',
    freePlan: 'yes', freeNote: 'Free plan for individuals. Enterprise plan for organisations.',
    platforms: null, checked: CHECKED,
    sources: [official('https://dovetail.com/pricing/')],
  },
  {
    id: 'granola', name: 'Granola', maker: 'Granola', category: 'Meeting notes', site: 'https://www.granola.ai',
    summary: 'An AI notepad that turns your meetings into structured notes.',
    freePlan: 'yes', freeNote: 'Free Basic plan with 30 days of meeting history. Paid plans: Business and Enterprise.',
    platforms: ['Desktop', 'iOS', 'Android'], checked: CHECKED,
    sources: [official('https://www.granola.ai/pricing')],
  },
  {
    id: 'lovable', name: 'Lovable', maker: 'Lovable', category: 'Prototyping', site: 'https://lovable.dev',
    summary: 'Builds working web apps and websites from a chat conversation.',
    freePlan: 'yes', freeNote: 'Free plan with a small daily allowance of build credits. Paid plans: Pro and Business.',
    platforms: null, checked: CHECKED,
    sources: [official('https://lovable.dev/pricing')],
  },
]

const daysAgo = (n) => new Date(Date.now() - n * 864e5).toISOString()
const R = (id, toolId, rating, frequency, tasks, role, industry, helpful, days, text) => ({ id, toolId, rating, frequency, tasks, role, industry, helpful, created: daysAgo(days), text, affiliated: false, sample: true, mine: false })

// Sample reviews: fictional reviewers, written for the demo. Balanced on purpose, so the page shows what real reviews would look like.
export const TOOL_REVIEWS = [
  R('v1', 'chatgpt', 4, 'daily', ['prd', 'ideas', 'comms'], 'PM', 'SaaS', 14, 12, 'I use it for first drafts of PRDs and for turning messy notes into a stakeholder update. It saves me about an hour a day. It still makes things up when I ask about our own product, so I paste the context in every time.'),
  R('v2', 'chatgpt', 3, 'weekly', ['data', 'competitors'], 'Senior PM', 'E-commerce', 6, 30, 'Good for a quick read of a CSV export, but I double-check every number before it goes into a deck. Competitor summaries are a starting point, not an answer.'),
  R('v3', 'chatgpt', 5, 'daily', ['ideas', 'prd'], 'APM', 'EdTech', 4, 5, 'As a new APM it helps me structure my thinking before I talk to my manager. I ask it to argue against my idea, which is more useful than asking it to agree.'),
  R('v4', 'claude', 5, 'daily', ['prd', 'research'], 'Senior PM', 'FinTech', 11, 8, 'My go-to for reviewing long specs and research transcripts. I paste in a 30-page doc and ask what is missing or contradictory. The writing sounds less generic than what I got from other tools.'),
  R('v5', 'claude', 4, 'weekly', ['research', 'comms'], 'PM', 'HealthTech', 3, 21, 'Great at summarising interview notes into themes. I still read the raw notes for anything that will change the roadmap.'),
  R('v6', 'gemini', 4, 'weekly', ['research', 'comms'], 'PM', 'Consumer Tech', 5, 15, 'Handy because our team already lives in Google Docs and Gmail. Good for summarising long email threads before a meeting.'),
  R('v7', 'gemini', 3, 'tried', ['ideas'], 'APM', 'Travel', 1, 40, 'Tried it for brainstorming feature ideas. The ideas were fine but generic until I gave it a lot of context about our users.'),
  R('v8', 'perplexity', 5, 'daily', ['competitors', 'research'], 'PM', 'SaaS', 9, 10, 'The best tool I have found for competitor research because every answer comes with sources I can click and check. I use it before every positioning discussion.'),
  R('v9', 'perplexity', 4, 'weekly', ['competitors'], 'Group PM or Lead', 'FinTech', 4, 26, 'Fast way to get up to speed on a market. Sources are sometimes blog posts rather than primary data, so I treat it as a map, not the territory.'),
  R('v10', 'notion-ai', 4, 'daily', ['meetings', 'prd'], 'PM', 'Communication', 7, 9, 'Our specs and meeting notes already live in Notion, so having AI in the same place is the real win. Auto-filling database fields saved our team a lot of manual tagging.'),
  R('v11', 'notion-ai', 3, 'weekly', ['prd'], 'Senior PM', 'SaaS', 2, 33, 'Useful for rewriting and summarising, less useful for writing a spec from scratch. Works best when the workspace is well organised.'),
  R('v12', 'figma-make', 4, 'weekly', ['proto'], 'PM', 'Consumer Tech', 6, 7, 'Lets me show a clickable idea in a review instead of describing it. Designers still rebuild it properly, but the conversation is much faster.'),
  R('v13', 'figma-make', 3, 'tried', ['proto'], 'APM', 'E-commerce', 1, 18, 'Impressive demo, but my prototypes looked off-brand until I spent time on the prompt. Needs a paid plan, which my team did not have at first.'),
  R('v14', 'miro-ai', 4, 'weekly', ['ideas', 'research'], 'PM', 'EdTech', 3, 14, 'After a workshop, I ask it to cluster 200 sticky notes into themes. It gets most of the way and the team fixes the rest together.'),
  R('v15', 'dovetail', 5, 'weekly', ['research'], 'Senior PM', 'HealthTech', 8, 11, 'Our research repository. Tagging and highlighting interviews with AI help means insights do not get lost in someone else\'s folder.'),
  R('v16', 'dovetail', 4, 'weekly', ['research'], 'PM', 'SaaS', 2, 35, 'Good for finding patterns across many customer calls. Only as good as what the team puts in, so we had to build the habit first.'),
  R('v17', 'granola', 5, 'daily', ['meetings'], 'PM', 'FinTech', 10, 4, 'I stopped taking notes in meetings and actually listen now. I add a few words of my own during the call and it fills in the rest afterwards.'),
  R('v18', 'granola', 4, 'daily', ['meetings', 'comms'], 'Group PM or Lead', 'Communication', 3, 19, 'Saves time after customer calls. I always tell people the call is being transcribed, and some customers prefer that I do not use it.'),
  R('v19', 'lovable', 4, 'weekly', ['proto'], 'APM', 'Travel', 5, 6, 'I built a working prototype of an onboarding flow in an afternoon to test with five users. Not production code, but perfect for learning fast.'),
  R('v20', 'lovable', 3, 'tried', ['proto'], 'PM', 'Entertainment', 1, 24, 'Great for a quick demo. Once the app got bigger, small changes started breaking other parts, so I kept it to throwaway prototypes.'),
]
