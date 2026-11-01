// Thin fetch wrapper around the ChakulaSmart API. The JWT is kept in localStorage (wrapped in try/catch).
const BASE: string = (import.meta.env.VITE_API_URL as string | undefined) ?? ''
const TOKEN_KEY = 'chakula.token'

export function getToken(): string | null {
  try { return localStorage.getItem(TOKEN_KEY) } catch { return null }
}
export function setToken(t: string | null) {
  try { if (t) localStorage.setItem(TOKEN_KEY, t); else localStorage.removeItem(TOKEN_KEY) } catch { /* ignore */ }
}

export class ApiError extends Error {
  status: number
  constructor(status: number, message: string) { super(message); this.status = status }
}

async function raw(path: string, opts: RequestInit = {}): Promise<Response> {
  const headers: Record<string, string> = { ...(opts.headers as Record<string, string> | undefined) }
  if (opts.body && !headers['Content-Type']) headers['Content-Type'] = 'application/json'
  const token = getToken()
  if (token) headers.Authorization = `Bearer ${token}`
  let res: Response
  try {
    res = await fetch(`${BASE}/api${path}`, { ...opts, headers })
  } catch {
    throw new ApiError(0, 'Cannot reach the ChakulaSmart server. Is the backend running on port 8080?')
  }
  if (!res.ok) {
    let msg = res.status === 401 ? 'Please sign in to continue' : `Request failed (${res.status})`
    try { const j = await res.json(); if (j?.error) msg = j.error } catch { /* no body */ }
    if (res.status === 401 && token) window.dispatchEvent(new Event('chakula:unauthorized'))
    throw new ApiError(res.status, msg)
  }
  return res
}

async function json<T>(path: string, opts: RequestInit = {}): Promise<T> {
  const res = await raw(path, opts)
  if (res.status === 204) return undefined as T
  const text = await res.text()
  return (text ? JSON.parse(text) : undefined) as T
}

export const api = {
  get: <T = any>(path: string) => json<T>(path),
  post: <T = any>(path: string, body?: unknown) => json<T>(path, { method: 'POST', body: JSON.stringify(body ?? {}) }),
  put: <T = any>(path: string, body?: unknown) => json<T>(path, { method: 'PUT', body: JSON.stringify(body ?? {}) }),
  patch: <T = any>(path: string, body?: unknown) => json<T>(path, { method: 'PATCH', body: JSON.stringify(body ?? {}) }),
  del: <T = any>(path: string) => json<T>(path, { method: 'DELETE' }),
  /** Download a binary file (PDF) with the auth header and hand it to the browser. */
  async download(path: string, filename: string) {
    const res = await raw(path)
    const blob = await res.blob()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  },
}
