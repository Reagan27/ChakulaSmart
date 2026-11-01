import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react'
import { AlertCircle, CheckCircle2, Loader2, X } from 'lucide-react'

export function Spinner({ label = 'Loading' }: { label?: string }) {
  return (
    <div className="flex items-center justify-center gap-2 py-16 text-forest" role="status">
      <Loader2 className="h-5 w-5 animate-spin" /> <span className="text-sm font-medium">{label}…</span>
    </div>
  )
}

export function ErrorBox({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <div className="flex items-start gap-3 rounded-2xl bg-red-50 p-4 text-sm text-red-700 ring-1 ring-red-100" role="alert">
      <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
      <div className="flex-1">{message}</div>
      {onRetry && <button className="font-semibold underline" onClick={onRetry}>Retry</button>}
    </div>
  )
}

export function Empty({ emoji = '🥣', title, children }: { emoji?: string; title: string; children?: ReactNode }) {
  return (
    <div className="rounded-2xl border-2 border-dashed border-forest-200 bg-white/60 px-6 py-10 text-center">
      <div className="text-4xl">{emoji}</div>
      <h3 className="mt-2 text-base font-bold text-ink">{title}</h3>
      {children && <div className="mt-1 text-sm text-gray-500">{children}</div>}
    </div>
  )
}

export function Stat({ label, value, sub, tone = 'default', icon }: {
  label: string; value: ReactNode; sub?: ReactNode; tone?: 'default' | 'good' | 'warn' | 'bad'; icon?: ReactNode
}) {
  const color = { default: 'text-ink', good: 'text-forest', warn: 'text-sun-600', bad: 'text-red-600' }[tone]
  return (
    <div className="card">
      <div className="flex items-center justify-between text-xs font-semibold uppercase tracking-wide text-gray-500">
        <span>{label}</span>{icon}
      </div>
      <div className={`mt-2 font-display text-2xl font-extrabold ${color}`}>{value}</div>
      {sub && <div className="mt-0.5 text-xs text-gray-500">{sub}</div>}
    </div>
  )
}

export function PageHeader({ title, subtitle, actions }: { title: string; subtitle?: ReactNode; actions?: ReactNode }) {
  return (
    <div className="mb-6 flex flex-wrap items-end justify-between gap-3">
      <div>
        <h1 className="font-display text-2xl font-extrabold text-ink sm:text-3xl">{title}</h1>
        {subtitle && <p className="mt-1 text-sm text-gray-500">{subtitle}</p>}
      </div>
      {actions && <div className="flex flex-wrap gap-2">{actions}</div>}
    </div>
  )
}

export function Field({ label, children, hint }: { label: string; children: ReactNode; hint?: string }) {
  return (
    <label className="block">
      <span className="label">{label}</span>
      {children}
      {hint && <span className="mt-1 block text-xs text-gray-400">{hint}</span>}
    </label>
  )
}

export function Modal({ open, onClose, title, children, wide }: {
  open: boolean; onClose: () => void; title: string; children: ReactNode; wide?: boolean
}) {
  useEffect(() => {
    if (!open) return
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', h)
    return () => window.removeEventListener('keydown', h)
  }, [open, onClose])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-ink/50 p-0 backdrop-blur-sm sm:items-center sm:p-6" onMouseDown={onClose}>
      <div role="dialog" aria-modal="true" aria-label={title} onMouseDown={(e) => e.stopPropagation()}
        className={`max-h-[92vh] w-full overflow-y-auto rounded-t-3xl bg-cream p-6 shadow-lift sm:rounded-3xl ${wide ? 'sm:max-w-3xl' : 'sm:max-w-lg'} animate-rise`}>
        <div className="mb-4 flex items-center justify-between">
          <h2 className="font-display text-xl font-extrabold">{title}</h2>
          <button onClick={onClose} aria-label="Close" className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100"><X className="h-5 w-5" /></button>
        </div>
        {children}
      </div>
    </div>
  )
}

/** Circular progress ring used for calories and budget. */
export function Ring({ value, max, label, sub, color = '#166534', size = 120 }: {
  value: number; max: number; label: ReactNode; sub?: ReactNode; color?: string; size?: number
}) {
  const pct = max > 0 ? Math.min(1, Math.max(0, value / max)) : 0
  const r = (size - 14) / 2
  const c = 2 * Math.PI * r
  const over = max > 0 && value > max
  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="-rotate-90">
        <circle cx={size / 2} cy={size / 2} r={r} stroke="#DCFCE7" strokeWidth="12" fill="none" />
        <circle cx={size / 2} cy={size / 2} r={r} stroke={over ? '#DC2626' : color} strokeWidth="12" fill="none" strokeLinecap="round"
          strokeDasharray={c} strokeDashoffset={c * (1 - pct)} style={{ transition: 'stroke-dashoffset .8s ease' }} />
      </svg>
      <div className="absolute text-center">
        <div className="font-display text-lg font-extrabold leading-tight">{label}</div>
        {sub && <div className="text-[11px] text-gray-500">{sub}</div>}
      </div>
    </div>
  )
}

export function Macro({ label, value, max, color }: { label: string; value: number; max: number; color: string }) {
  const pct = Math.min(100, max > 0 ? (value / max) * 100 : 0)
  return (
    <div>
      <div className="flex justify-between text-xs"><span className="font-semibold text-gray-600">{label}</span><span className="text-gray-500">{Math.round(value)} g</span></div>
      <div className="mt-1 h-2 overflow-hidden rounded-full bg-gray-100"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: color, transition: 'width .8s ease' }} /></div>
    </div>
  )
}

export function Tag({ children, tone = 'green' }: { children: ReactNode; tone?: 'green' | 'orange' | 'gray' | 'red' }) {
  const t = { green: 'bg-forest-100 text-forest-800', orange: 'bg-sun-100 text-sun-600', gray: 'bg-gray-100 text-gray-600', red: 'bg-red-50 text-red-600' }[tone]
  return <span className={`badge ${t}`}>{children}</span>
}

export function Tabs<T extends string>({ tabs, value, onChange }: { tabs: { id: T; label: string }[]; value: T; onChange: (t: T) => void }) {
  return (
    <div className="mb-5 inline-flex max-w-full gap-1 overflow-x-auto rounded-full bg-forest-100/70 p-1" role="tablist">
      {tabs.map((t) => (
        <button key={t.id} role="tab" aria-selected={value === t.id} onClick={() => onChange(t.id)}
          className={`whitespace-nowrap rounded-full px-4 py-1.5 text-sm font-semibold transition ${value === t.id ? 'bg-white text-forest shadow-soft' : 'text-forest-800/70 hover:text-forest'}`}>
          {t.label}
        </button>
      ))}
    </div>
  )
}

// ---- toasts -------------------------------------------------------------------------------
interface Toast { id: number; text: string; kind: 'ok' | 'err' }
const ToastCtx = createContext<(text: string, kind?: 'ok' | 'err') => void>(() => {})
export const useToast = () => useContext(ToastCtx)

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<Toast[]>([])
  const push = useCallback((text: string, kind: 'ok' | 'err' = 'ok') => {
    const id = Date.now() + Math.random()
    setItems((x) => [...x, { id, text, kind }])
    setTimeout(() => setItems((x) => x.filter((t) => t.id !== id)), 4200)
  }, [])
  return (
    <ToastCtx.Provider value={push}>
      {children}
      <div className="pointer-events-none fixed bottom-5 right-5 z-[60] flex w-[min(92vw,22rem)] flex-col gap-2" aria-live="polite">
        {items.map((t) => (
          <div key={t.id} className={`pointer-events-auto flex items-start gap-2 rounded-2xl px-4 py-3 text-sm font-medium shadow-lift animate-rise ${t.kind === 'ok' ? 'bg-forest text-white' : 'bg-red-600 text-white'}`}>
            {t.kind === 'ok' ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />}
            {t.text}
          </div>
        ))}
      </div>
    </ToastCtx.Provider>
  )
}
