import { Link } from 'react-router-dom'
import { PageHead } from '../ui'

const IDEAS = [
  { to: '/ideas/industry', n: 1, title: 'Industry selection', body: 'Pick FinTech, EdTech, Travel and more before the interview. Questions and scenarios adapt to that industry.', who: 'Candidates targeting a specific sector' },
  { to: '/ideas/experiences', n: 2, title: 'Real interview experiences', body: 'A library of real interview conversations shared by candidates, ranked by senior PMs whose name, role and experience are visible.', who: 'Candidates who want to see how real interviews run' },
  { to: '/ideas/peer-mocks', n: 3, title: 'Peer mock interviews', body: 'Share when you are free, match with another candidate, run a live mock and swap feedback.', who: 'Candidates who want practice with real people' },
  { to: '/ideas/roadmap', n: 4, title: 'Resources and learning roadmap', body: 'A voted directory of free resources tiered Must, Should and Could know, plus an AI plan built around your gaps and your time.', who: 'Candidates short on prep time' },
  { to: '/ideas/ai-tools', n: 5, title: 'PM AI tools and intelligence', body: 'Which AI tools PMs really use, where, for what, and how much they change the work, voted on by PMs.', who: 'APMs and PMs learning the AI toolkit' },
]
export default function Hub() {
  return (
    <>
      <PageHead title="Ideas to compare" sub="Each idea is its own page with working mock data. Open them one at a time and decide which one to build first." sample />
      <div className="grid2">
        {IDEAS.map((i) => (
          <Link key={i.to} to={i.to} className="opt-card">
            <span className="n">{i.n}</span>
            <h3>{i.title}</h3>
            <p className="muted">{i.body}</p>
            <p className="small"><b>For:</b> {i.who}</p>
          </Link>
        ))}
      </div>
    </>
  )
}
