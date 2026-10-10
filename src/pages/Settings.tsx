import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { api, post, PROTOTYPE_TOOLS } from '../api'
import { useAuth } from '../auth'
import { ErrorBox, Modal, PageHead, useAction, useToast } from '../ui'

export default function Settings() {
  const { user, setUser, signOut } = useAuth()
  const toast = useToast()
  const nav = useNavigate()
  const [name, setName] = useState(user?.name ?? '')
  const [confirm, setConfirm] = useState('')
  const [open, setOpen] = useState(false)
  const save = useAction(async () => { const r = await api('PATCH', '/me', { name }); setUser(r.user); toast('Name saved') })
  const del = useAction(async () => { await post('/delete-account', { confirm }); signOut(); nav('/', { replace: true }) })
  const flag = (b: object, m: string) => post('/_dev/flags', b).then(() => toast(m))
  return (
    <>
      <PageHead title="Settings" />
      <div className="stack lg" style={{ maxWidth: 640 }}>
        <section className="card stack">
          <h2>Profile</h2>
          <label className="field">Name<input value={name} onChange={(e) => setName(e.target.value)} /></label>
          <label className="field">Email<input value={user?.email} readOnly /></label>
          <div className="row"><button className="btn" onClick={() => save.run()} disabled={save.busy || !name.trim()}>Save changes</button><button className="btn ghost" onClick={() => toast('Verification link sent to your new email (prototype)')}>Change email</button><button className="btn ghost" onClick={() => toast('Password change form (prototype)')}>Change password</button></div>
          <ErrorBox error={save.error} />
        </section>
        {PROTOTYPE_TOOLS && <section className="card stack">
          <h2>Prototype tools</h2>
          <p className="muted">Trigger the failure screens on demand. These are only here so you can see the fallbacks.</p>
          <div className="row"><button className="btn ghost sm" onClick={() => flag({ busyNext: true }, 'Next AI question will fail once')}>Make next AI question fail</button><button className="btn ghost sm" onClick={() => flag({ feedbackFailNext: true }, 'Next report will fail once')}>Make next report fail</button></div>
          <button className="btn ghost sm" style={{ justifySelf: 'start' }} onClick={() => post('/_dev/reset').then(() => { toast('Sample data reset'); signOut(); nav('/login') })}>Reset all sample data</button>
        </section>}
        <section className="card stack" style={{ borderColor: '#f3bccd' }}>
          <h2>Delete account</h2>
          <p className="muted">Removes your account, interviews, transcripts, reports, ratings and anything you posted, plus drafts saved on this device. This cannot be undone. Download any reports you want to keep first.</p>
          <button className="btn danger" style={{ justifySelf: 'start' }} onClick={() => setOpen(true)}>Delete my account</button>
        </section>
      </div>
      {open && (
        <Modal title="Delete your account?" onClose={() => setOpen(false)}>
          <p>Type <b>DELETE</b> to confirm.</p>
          <input value={confirm} onChange={(e) => setConfirm(e.target.value)} aria-label="Type DELETE" />
          <ErrorBox error={del.error} />
          <div className="row"><button className="btn danger" disabled={confirm !== 'DELETE' || del.busy} onClick={() => del.run()}>Delete everything</button><button className="btn ghost" onClick={() => setOpen(false)}>Cancel</button></div>
        </Modal>
      )}
    </>
  )
}
