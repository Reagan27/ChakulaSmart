import { useCallback, useEffect, useRef, useState } from 'react'
import { api } from './api'

/** Fetch-on-mount helper: { data, error, loading, reload, setData }. Pass null to skip. */
export function useApi<T = any>(path: string | null, deps: unknown[] = []) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [loading, setLoading] = useState<boolean>(!!path)
  const seq = useRef(0)

  const load = useCallback(async () => {
    if (!path) { setLoading(false); return }
    const n = ++seq.current
    setLoading(true)
    try {
      const d = await api.get<T>(path)
      if (n === seq.current) { setData(d); setError(null) }
    } catch (e: any) {
      if (n === seq.current) setError(e.message || 'Something went wrong')
    } finally {
      if (n === seq.current) setLoading(false)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [path, ...deps])

  useEffect(() => { load() }, [load])
  return { data, error, loading, reload: load, setData }
}

export function useDebounced<T>(value: T, ms = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => { const t = setTimeout(() => setV(value), ms); return () => clearTimeout(t) }, [value, ms])
  return v
}
