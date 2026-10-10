import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { clearAllDrafts, get, getToken, post, setToken, type User } from './api'

// devVerifyUrl: prototype stand-in for the verification email, shown on the dashboard after sign-up.
type Ctx = { user: User | null; ready: boolean; signIn: (path: 'login' | 'signup' | 'google', body?: Record<string, unknown>) => Promise<void>; signOut: () => void; setUser: (u: User | null) => void; devVerifyUrl: string; setDevVerifyUrl: (u: string) => void }
const AuthCtx = createContext<Ctx>(null as unknown as Ctx)
export const useAuth = () => useContext(AuthCtx)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [ready, setReady] = useState(false)
  const [devVerifyUrl, setDevVerifyUrl] = useState('')
  useEffect(() => {
    if (!getToken()) { setReady(true); return }
    get('/me').then((r) => setUser(r.user)).catch(() => setToken(null)).finally(() => setReady(true))
  }, [])
  useEffect(() => { const f = () => setUser(null); window.addEventListener('pm-signed-out', f); return () => window.removeEventListener('pm-signed-out', f) }, [])
  const signIn = useCallback(async (path: 'login' | 'signup' | 'google', body: Record<string, unknown> = {}) => {
    const r = await post('/auth/' + path, body)
    setToken(r.token); setUser(r.user); setDevVerifyUrl(r.dev_verify_url || '')
  }, [])
  // Drafts stay on the device only while signed in, so the next person on a shared computer cannot read them.
  const signOut = useCallback(() => { if (getToken()) post('/auth/logout').catch(() => {}); setToken(null); setUser(null); setDevVerifyUrl(''); clearAllDrafts() }, [])
  return <AuthCtx.Provider value={{ user, ready, signIn, signOut, setUser, devVerifyUrl, setDevVerifyUrl }}>{children}</AuthCtx.Provider>
}
