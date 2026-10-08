import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { get, getToken, post, setToken, type User } from './api'

type Ctx = { user: User | null; ready: boolean; signIn: (path: 'login' | 'signup', body: Record<string, unknown>) => Promise<void>; signOut: () => void; setUser: (u: User | null) => void }
const AuthCtx = createContext<Ctx>(null as unknown as Ctx)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  useEffect(() => {
    if (!getToken()) { setReady(true); return }
    get('/me').then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])
  useEffect(() => { const f = () => setUser(null); window.addEventListener('pm-signed-out', f); return () => window.removeEventListener('pm-signed-out', f) }, [])
  const signIn = useCallback(async (path: 'login' | 'signup', body: Record<string, unknown>) => {
    const r = await post('/auth/' + path, body)
    setToken(r.token); setUser(r.user)
  }, [])
  const signOut = useCallback(() => { setToken(null); setUser(null) }, [])
  return <AuthCtx.Provider value={{ user, ready, signIn, signOut, setUser }}>{children}</AuthCtx.Provider>
}
