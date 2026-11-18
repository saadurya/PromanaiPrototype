import { Link } from 'react-router-dom'
import { CATEGORY_LABELS, engine, get, type Session, type Storage } from '../api'
import { useAuth } from '../auth'
import { useLoad } from '../ui'

export default function Home() {
  const { user } = useAuth()
  const list = useLoad(() => get<{ interviews: Session[]; storage: Storage }>('/interviews'))
  const act = useLoad(() => engine<{ active: Session | null }>({ action: 'status' }))
  return (
    <div className="stack lg">
      {act.data?.active && (
        <div className="banner info"><span><b>Interview in progress:</b> {CATEGORY_LABELS[act.data.active.category]}, {act.data.active.difficulty}.</span><Link className="btn sm" to="/interview/live">Resume</Link></div>
      )}
      {list.data?.storage.full && <div className="err" role="alert"><span>Storage is full, so you cannot start a new interview.</span><Link className="btn sm ghost" to="/history">Free up space</Link></div>}
      <div className="open center">
        <p className="open-hi">Hi {user?.name.split(' ')[0]}</p>
        <h1>Practice your PM interview with AI.</h1>
        <p className="open-sub">A spoken AI interview with follow-up questions and a scored feedback report.</p>
        <Link className="btn lime lg" to="/interview/setup">Start an interview</Link>
        <div className="steps">
          <div className="step"><b>1 · Set up</b><span className="muted small">Pick your level, industry and focus</span></div>
          <div className="step"><b>2 · Interview</b><span className="muted small">Questions and follow-ups from the practice engine</span></div>
          <div className="step"><b>3 · Review</b><span className="muted small">A scored report and what to learn next</span></div>
        </div>
      </div>
    </div>
  )
}
