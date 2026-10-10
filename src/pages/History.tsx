import { Link } from 'react-router-dom'
import { fmtBytes, interviewTitle, fmtDate, get, type Session } from '../api'
import { Empty, ErrorBox, Meter, PageHead, Spinner, Stars, useLoad } from '../ui'

export default function History() {
  const { data, loading, error, reload } = useLoad(() => get<{ interviews: Session[]; storage: { used: number; limit: number } }>('/interviews'))
  return (
    <>
      <PageHead title="History" sub="Every finished interview and its report. Only text is stored, never audio." />
      {loading && <Spinner />}
      <ErrorBox error={error} onRetry={reload} />
      {data && (
        <div className="stack lg">
          <div className="card"><div className="row between small"><b>Storage</b><span className="muted">{fmtBytes(data.storage.used)} of {fmtBytes(data.storage.limit)}</span></div><Meter pct={(data.storage.used / data.storage.limit) * 100} /></div>
          {data.interviews.length === 0 ? <Empty title="Nothing here yet">Finish an interview and its report will be saved here.<Link className="btn" to="/interview/setup">Start an interview</Link></Empty> : (
            <div className="card"><table className="t">
              <thead><tr><th>Date</th><th>Category</th><th>Level</th><th>Status</th><th>Rating</th><th /></tr></thead>
              <tbody>{data.interviews.map((i) => (
                <tr key={i.id}>
                  <td>{fmtDate(i.created_at)}</td>
                  <td><b>{interviewTitle(i)}</b><div className="muted small">{i.difficulty}{i.industry ? ` · ${i.industry_name ?? i.industry}` : ''}</div></td>
                  <td>{i.level}</td>
                  <td><span className={'pill' + (i.status === 'in_progress' ? ' lime' : '')}>{i.status === 'in_progress' ? 'In progress' : i.feedback_status === 'ready' ? 'Report ready' : i.feedback_status === 'not_available' ? 'No score' : 'Report pending'}</span></td>
                  <td>{i.rating ? <Stars value={i.rating.rating} /> : <span className="muted">Not rated</span>}</td>
                  <td><Link to={i.status === 'in_progress' ? '/interview/live' : `/history/${i.id}`}>{i.status === 'in_progress' ? 'Resume' : 'Open'}</Link></td>
                </tr>
              ))}</tbody>
            </table></div>
          )}
        </div>
      )}
    </>
  )
}
