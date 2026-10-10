import { Link } from 'react-router-dom'
import { PageHead } from '../ui'

const IDEAS = [
  { to: '/ideas/experiences', n: 1, title: 'Real interview experiences', body: 'A library of real interview conversations shared by candidates, ranked by senior PMs whose name, role and experience are visible.', who: 'Candidates who want to see how real interviews run' },
  { to: '/ideas/peer-mocks', n: 2, title: 'Peer mock interviews', body: 'Share when you are free, match with another candidate, run a live mock and swap feedback.', who: 'Candidates who want practice with real people' },
]
export default function Hub() {
  return (
    <>
      <PageHead title="Ideas to compare" sub="Each idea is its own page with working mock data. Open them one at a time and decide which one to build first." sample />
      <p className="muted" style={{ marginBottom: 16 }}>Three ideas are now part of the core product: industry selection is step 2 of <Link to="/interview/setup">interview setup</Link>, the resources roadmap is the <Link to="/study-plan">Study plan</Link>, and the AI tools catalogue is <Link to="/ai-tools">AI tools</Link>.</p>
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
