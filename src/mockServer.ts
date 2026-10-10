// Static hosting: the mock API runs inside the page and keeps its data in this browser's localStorage.
// Every account on this browser is still kept separate by the same token and owner checks as the Node server.
import { createCore } from '../server/app.js'

const KEY = 'promanai-mock-v2'
try { localStorage.removeItem('promanai-mock-v1') } catch { /* data from the old single-user build */ }

export const dispatch = createCore({
  devTools: true, // a static site cannot send email, so verification links are shown in the app instead
  load: () => { try { return JSON.parse(localStorage.getItem(KEY) || 'null') } catch { return null } },
  save: (d) => { try { localStorage.setItem(KEY, JSON.stringify(d)) } catch { /* storage full or private mode */ } },
})
