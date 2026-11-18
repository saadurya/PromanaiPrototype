import { Link } from 'react-router-dom'
import { get, post } from '../api'
import { ErrorBox, PageHead, Spinner, useAction, useLoad } from '../ui'

type Topic = { id: string; category: string; label: string; xp: number; done: boolean }
type Daily = {
  date: string
  topics: Topic[]
  doneCount: number
  bonus: { id: string; title: string; text: string; unlocked: boolean }
  streakDays: number
  xp: number
  xpToday: number
}

export default function Daily() {
  const { data, setData, loading, error, reload } = useLoad(() => get<Daily>('/daily'))
  const complete = useAction(async (id: string) => { const r = await post<Daily>(`/daily/topics/${id}/complete`); setData(r) })
  if (loading && !data) return <Spinner />
  if (!data) return <ErrorBox error={error} onRetry={reload} />
  return (
    <>
      <PageHead title="Daily practice" sub="Five topics a day across the interview categories. Finish all five to keep your streak going and unlock today's bonus topic." sample />
      <div className="stack lg">
        <section className="card row" style={{ justifyContent: 'space-around', textAlign: 'center' }}>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{data.streakDays}</div><div className="small muted">day streak</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{data.xp}</div><div className="small muted">total XP</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{data.xpToday}</div><div className="small muted">XP today</div></div>
          <div><div style={{ fontSize: 28, fontWeight: 700 }}>{data.doneCount}/{data.topics.length}</div><div className="small muted">today's topics</div></div>
        </section>
        <section className="stack">
          <h2>Today's five</h2>
          <ErrorBox error={complete.error} />
          <div className="grid2">
            {data.topics.map((t) => (
              <div key={t.id} className="card stack">
                <div className="row between"><h3>{t.label}</h3>{t.done ? <span className="pill ok">Done · +{t.xp} XP</span> : <span className="pill">+{t.xp} XP</span>}</div>
                <div className="row">
                  <Link className="btn sm lime" to={`/interview/setup?category=${t.category}`}>Practise this topic</Link>
                  {!t.done && <button className="btn sm ghost" disabled={complete.busy} onClick={() => complete.run(t.id)}>Mark done</button>}
                </div>
              </div>
            ))}
          </div>
          <p className="small muted">Streaks and XP are sample state in this prototype; nothing is tied to a real account yet.</p>
        </section>
        <section className="card stack">
          <div className="row between"><h2>{data.bonus.title}</h2>{data.bonus.unlocked ? <span className="pill lime">Unlocked</span> : <span className="pill line">Locked</span>}</div>
          <p className="small muted">{data.bonus.unlocked ? data.bonus.text : "Finish today's five topics to unlock the bonus topic."}</p>
          {data.bonus.unlocked && <Link className="btn" style={{ justifySelf: 'start' }} to="/ai-tools">Open the bonus topic</Link>}
        </section>
      </div>
    </>
  )
}
