import { useMemo, useState } from 'react'
import { get, post } from '../api'
import { ErrorBox, Modal, PageHead, Spinner, Stars, useAction, useLoad } from '../ui'

type Tool = { id: string; name: string; category: string; uses: string[]; industries: string[]; companies: string[]; influence: number; adoption: string; updates: { when: string; text: string }[]; up: number; voted: number; expert: { name: string; role: string; vote: number }[]; reports: { use: string; industry: string; impact: number; role: string; when: string }[] }
type Data = { tools: Tool[]; industries: string[]; categories: string[] }

export default function AiTools() {
  const { data, setData, loading, error, reload } = useLoad(() => get<Data>('/ai-tools'))
  const [cat, setCat] = useState(''); const [ind, setInd] = useState(''); const [q, setQ] = useState('')
  const [sort, setSort] = useState<'votes' | 'influence'>('votes')
  const [report, setReport] = useState<Tool | null>(null)
  const vote = useAction(async (id: string) => { const r = await post(`/ai-tools/${id}/vote`); setData({ ...data!, tools: data!.tools.map((t) => (t.id === id ? r.tool : t)) }) })
  const list = useMemo(() => (data?.tools ?? []).filter((t) => (!cat || t.category === cat) && (!ind || t.industries.includes(ind)) && (!q || (t.name + t.uses.join(' ')).toLowerCase().includes(q.toLowerCase()))).sort((a, b) => (sort === 'votes' ? b.up - a.up : b.influence - a.influence)), [data, cat, ind, q, sort])
  if (loading && !data) return <Spinner />
  if (!data) return <ErrorBox error={error} onRetry={reload} />
  const updates = data.tools.flatMap((t) => t.updates.map((u) => ({ ...u, tool: t.name }))).slice(0, 5)
  return (
    <>
      <PageHead title="PM AI tools and intelligence" sub="Which AI tools PMs use, in which industries, for what, and how much they change the work. Votes and reports come from PMs, with experienced voices shown by name." sample />
      <div className="stack lg">
        <section className="card stack">
          <h2>Recent developments</h2>
          {updates.map((u, i) => <div key={i} className="row"><span className="pill lime">{u.when}</span><span><b>{u.tool}</b> · {u.text}</span></div>)}
        </section>
        <div className="row">
          <input aria-label="Search tools" placeholder="Search tools or tasks" value={q} onChange={(e) => setQ(e.target.value)} style={{ width: 240 }} />
          <select aria-label="Category" value={cat} onChange={(e) => setCat(e.target.value)} style={{ width: 'auto' }}><option value="">All categories</option>{data.categories.map((c) => <option key={c}>{c}</option>)}</select>
          <select aria-label="Industry" value={ind} onChange={(e) => setInd(e.target.value)} style={{ width: 'auto' }}><option value="">All industries</option>{data.industries.map((c) => <option key={c}>{c}</option>)}</select>
          <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as 'votes' | 'influence')} style={{ width: 'auto' }}><option value="votes">Most voted</option><option value="influence">Most influence on the work</option></select>
        </div>
        <ErrorBox error={vote.error} />
        <div className="stack">
          {list.length === 0 && <div className="empty"><h3 style={{ color: 'var(--ink)' }}>No tools match</h3>Clear a filter.</div>}
          {list.map((t) => (
            <article key={t.id} className="card" style={{ display: 'grid', gridTemplateColumns: 'auto 1fr', gap: 18 }}>
              <button className={'vote' + (t.voted ? ' on' : '')} aria-pressed={!!t.voted} aria-label={`Upvote ${t.name}`} onClick={() => vote.run(t.id)}>▲<span>{t.up}</span></button>
              <div className="stack">
                <div className="row between"><div className="row"><h2>{t.name}</h2><span className="pill">{t.category}</span><span className={'pill ' + (t.adoption === 'Widely used' ? 'lime' : 'line')}>{t.adoption}</span></div>
                  <div className="row small"><span className="muted">Influence on PM work</span><span className="influence" aria-label={`${t.influence} out of 5`}>{[1, 2, 3, 4, 5].map((n) => <i key={n} className={n <= Math.round(t.influence) ? 'on' : ''} />)}</span><b>{t.influence}</b></div></div>
                <div><span className="small muted">PMs use it for</span><div className="row" style={{ marginTop: 4 }}>{t.uses.map((u) => <span key={u} className="pill">{u}</span>)}</div></div>
                <div className="grid2">
                  <div><span className="small muted">Industries</span><div className="row" style={{ marginTop: 4 }}>{t.industries.map((u) => <span key={u} className="pill line">{u}</span>)}</div></div>
                  <div><span className="small muted">Teams reported using it</span><div className="small" style={{ marginTop: 4 }}>{t.companies.join(', ')}</div></div>
                </div>
                {t.updates.map((u, i) => <div key={i} className="small"><span className="pill lime" style={{ marginRight: 8 }}>{u.when}</span>{u.text}</div>)}
                {t.expert.length > 0 && <div className="small muted">Endorsed by {t.expert.map((e) => `${e.name} (${e.role})`).join(', ')}</div>}
                {t.reports.map((r, i) => <div key={i} className="review"><div className="row between small"><b>{r.role} · {r.industry}</b><span className="row"><Stars value={r.impact} /> {r.when}</span></div>{r.use}</div>)}
                <button className="btn sm ghost" style={{ justifySelf: 'start' }} onClick={() => setReport(t)}>Share how you use {t.name}</button>
              </div>
            </article>
          ))}
        </div>
      </div>
      {report && <ReportModal tool={report} industries={data.industries} onClose={() => setReport(null)} onDone={(tool) => { setData({ ...data, tools: data.tools.map((t) => (t.id === tool.id ? tool : t)) }); setReport(null) }} />}
    </>
  )
}

function ReportModal({ tool, industries, onClose, onDone }: { tool: Tool; industries: string[]; onClose: () => void; onDone: (t: Tool) => void }) {
  const [f, setF] = useState({ use: '', industry: '', impact: 0, role: 'PM' })
  const save = useAction(async () => { const r = await post(`/ai-tools/${tool.id}/reports`, f); onDone(r.tool) })
  return (
    <Modal title={`How do you use ${tool.name}?`} onClose={onClose}>
      <label className="field">What do you use it for?<textarea value={f.use} onChange={(e) => setF({ ...f, use: e.target.value })} style={{ minHeight: 70 }} maxLength={200} /></label>
      <div className="grid2"><label className="field">Your industry<select value={f.industry} onChange={(e) => setF({ ...f, industry: e.target.value })}><option value="">Choose…</option>{industries.map((i) => <option key={i}>{i}</option>)}</select></label><label className="field">Your role<input value={f.role} onChange={(e) => setF({ ...f, role: e.target.value })} /></label></div>
      <div className="field">How much does it change your work?<Stars value={f.impact} onChange={(n) => setF({ ...f, impact: n })} /></div>
      <ErrorBox error={save.error} />
      <div className="row"><button className="btn" disabled={save.busy} onClick={() => save.run()}>Share</button><button className="btn ghost" onClick={onClose}>Cancel</button></div>
    </Modal>
  )
}
