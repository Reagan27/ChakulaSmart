import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react'
import { api, getToken, setToken } from './api'
import type { Role, User } from './types'

interface RegisterInput {
  email: string; password: string; fullName: string; phone?: string
  accountType: Role; businessName?: string; specialization?: string; applicationNote?: string
}
interface AuthCtx {
  user: User | null
  loading: boolean
  workspace: Role
  setWorkspace: (w: Role) => void
  login: (email: string, password: string) => Promise<User>
  /** Individuals are signed in at once; nutritionists and businesses get { pending: true } and wait for approval. */
  register: (r: RegisterInput) => Promise<{ pending: boolean; message?: string }>
  /** Store a session received from the server (used by invitation sign-up). */
  startSession: (token: string, user: User) => void
  logout: () => void
  refresh: () => Promise<void>
  setUser: (u: User) => void
  has: (r: Role) => boolean
  isPremium: () => boolean
}

const Ctx = createContext<AuthCtx | null>(null)
const WS_KEY = 'chakula.workspace'

function readWs(): Role {
  try { return (localStorage.getItem(WS_KEY) as Role) || 'INDIVIDUAL' } catch { return 'INDIVIDUAL' }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUserState] = useState<User | null>(null)
  const [loading, setLoading] = useState<boolean>(!!getToken())
  const [workspace, setWs] = useState<Role>(readWs())

  const setWorkspace = useCallback((w: Role) => {
    setWs(w)
    try { localStorage.setItem(WS_KEY, w) } catch { /* ignore */ }
  }, [])

  const logout = useCallback(() => { setToken(null); setUserState(null) }, [])

  const refresh = useCallback(async () => {
    if (!getToken()) { setUserState(null); setLoading(false); return }
    try { setUserState(await api.get<User>('/account/me')) } catch { setToken(null); setUserState(null) } finally { setLoading(false) }
  }, [])

  useEffect(() => { refresh() }, [refresh])
  useEffect(() => {
    const h = () => logout()
    window.addEventListener('chakula:unauthorized', h)
    return () => window.removeEventListener('chakula:unauthorized', h)
  }, [logout])

  const value = useMemo<AuthCtx>(() => ({
    user, loading, workspace, setWorkspace, logout, refresh,
    setUser: setUserState,
    has: (r) => !!user?.roles.includes(r),
    isPremium: () => !!user?.subscriptions.some((s) => s.status === 'ACTIVE' && new Date(s.renews_at) > new Date()),
    async login(email, password) {
      const res = await api.post<{ token: string; user: User }>('/auth/login', { email, password })
      setToken(res.token); setUserState(res.user)
      return res.user
    },
    async register(r) {
      const res = await api.post<{ token?: string; user?: User; pending?: boolean; message?: string }>('/auth/register', r)
      if (res.pending || !res.token || !res.user) return { pending: true, message: res.message }
      setToken(res.token); setUserState(res.user)
      setWorkspace(r.accountType)
      return { pending: false }
    },
    startSession(token, u) { setToken(token); setUserState(u); setWorkspace('INDIVIDUAL') },
  }), [user, loading, workspace, setWorkspace, logout, refresh])

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useAuth(): AuthCtx {
  const c = useContext(Ctx)
  if (!c) throw new Error('useAuth outside AuthProvider')
  return c
}
