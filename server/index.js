// Node entry for the mock backend (used by `npm run dev` and the tests). The logic lives in app.js.
import http from 'node:http'
import { fileURLToPath } from 'node:url'
import { createCore } from './app.js'

const PORT = process.env.PORT || 8787

export function createApp(opts = {}) {
  const dispatch = createCore({ devTools: process.env.NODE_ENV !== 'production', ...opts })
  return async function handle(req, res) {
    const url = new URL(req.url, 'http://x')
    res.setHeader('Content-Type', 'application/json')
    const send = (status, body) => { res.statusCode = status; res.end(JSON.stringify(body)) }
    let body = {}
    if (req.method !== 'GET') {
      const chunks = []
      for await (const c of req) chunks.push(c)
      if (chunks.length) { try { body = JSON.parse(Buffer.concat(chunks).toString()) } catch { return send(400, { error: { code: 'bad_json', message: 'Invalid request body.' } }) } }
    }
    const token = (req.headers.authorization || '').replace(/^Bearer /, '')
    const out = await dispatch({ method: req.method, path: url.pathname, token, body })
    send(out.status, out.body)
  }
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  http.createServer(createApp()).listen(PORT, () => console.log(`mock api on http://localhost:${PORT}`))
}
