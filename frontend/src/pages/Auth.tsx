import { useState, type FormEvent } from 'react'
import { Link, Navigate, useLocation, useNavigate, useSearchParams } from 'react-router-dom'
import { Clock, HeartPulse, ShieldCheck, Store, Users } from 'lucide-react'
import Logo from '../components/Logo'
import { PlateArt } from '../components/FoodArt'
import { Field, Spinner, useToast } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { Role, User } from '../lib/types'

export const homeFor = (u: User) => u.roles.includes('ADMIN') ? '/admin' : u.roles.length > 1 ? '/workspace' : '/app'

export function Shell({ title, subtitle, children }: { title: string; subtitle: string; children: React.ReactNode }) {
  return (
    <div className="grid min-h-screen lg:grid-cols-[1fr_1.05fr]">
      <div className="flex flex-col px-6 py-8 sm:px-12">
        <Logo />
        <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center py-10 animate-rise">
          <h1 className="font-display text-3xl font-extrabold">{title}</h1>
          <p className="mt-2 text-sm text-gray-500">{subtitle}</p>
          <div className="mt-8">{children}</div>
        </div>
      </div>
      <div className="hero relative hidden items-center justify-center lg:flex">
        <div className="max-w-sm text-center text-white">
          <PlateArt className="mx-auto w-72 drop-shadow-2xl" />
          <p className="mt-8 font-display text-2xl font-extrabold">Eat better. Spend smarter. Live healthier.</p>
        </div>
      </div>
    </div>
  )
}

export function Login() {
  const { login, user, loading } = useAuth()
  const nav = useNavigate()
  const loc = useLocation()
  const from = (loc.state as any)?.from as string | undefined
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner />
  if (user) return <Navigate to={from ?? homeFor(user)} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setBusy(true); setErr('')
    try {
      const u = await login(email, password)
      nav(from ?? homeFor(u), { replace: true })
    } catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  return (
    <Shell title="Welcome back" subtitle="Sign in to your ChakulaSmart account.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" autoComplete="email" required value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        <Field label="Password"><input className="input" type="password" autoComplete="current-password" required value={password} onChange={(e) => setPassword(e.target.value)} /></Field>
        <div className="text-right text-sm"><Link className="font-semibold text-forest" to="/forgot-password">Forgot your password?</Link></div>
        {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{err}</div>}
        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? 'Signing in…' : 'Sign in'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">New here? <Link className="font-semibold text-forest" to="/register">Create an account</Link></p>
    </Shell>
  )
}

const TYPES: { id: Role; title: string; desc: string; icon: any }[] = [
  { id: 'INDIVIDUAL', title: 'Individual / Family', desc: 'Plan meals and manage your food budget.', icon: Users },
  { id: 'NUTRITIONIST', title: 'Nutritionist', desc: 'Manage clients and create meal plans.', icon: HeartPulse },
  { id: 'BUSINESS', title: 'Food Business', desc: 'Promote products and connect with customers.', icon: Store },
]

export function Register() {
  const { register, user, loading } = useAuth()
  const nav = useNavigate()
  const [sp] = useSearchParams()
  const initial = (sp.get('type') || '').toUpperCase() as Role
  const [type, setType] = useState<Role>(TYPES.some((t) => t.id === initial) ? initial : 'INDIVIDUAL')
  const [f, setF] = useState({ fullName: '', email: '', phone: '', password: '', businessName: '', specialization: '', applicationNote: '' })
  const [pending, setPending] = useState<string | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const set = (k: keyof typeof f) => (e: React.ChangeEvent<HTMLInputElement>) => setF({ ...f, [k]: e.target.value })

  if (loading) return <Spinner />
  if (user && !busy) return <Navigate to={homeFor(user)} replace />

  async function submit(e: FormEvent) {
    e.preventDefault()
    setErr('')
    if (f.password.length < 8) { setErr('Password must be at least 8 characters'); return }
    setBusy(true)
    try {
      const res = await register({ ...f, accountType: type })
      if (res.pending) { setPending(res.message ?? 'Application received.'); setBusy(false); return }
      nav(type === 'INDIVIDUAL' ? '/app/onboarding' : type === 'NUTRITIONIST' ? '/pro/profile' : '/biz/profile', { replace: true })
    } catch (e: any) { setErr(e.message); setBusy(false) }
  }
  if (pending) {
    return (
      <Shell title="Application received" subtitle="Thank you for joining ChakulaSmart.">
        <div className="card text-center">
          <Clock className="mx-auto h-10 w-10 text-sun-600" />
          <h2 className="mt-3 font-display text-xl font-extrabold">Waiting for approval</h2>
          <p className="mt-2 text-sm text-gray-600">{pending}</p>
          <p className="mt-2 text-sm text-gray-600">Nutritionist and food business accounts are reviewed by an administrator before they can sign in. This keeps the directory trustworthy for families.</p>
          <Link to="/login" className="btn btn-ghost mt-5">Back to sign in</Link>
        </div>
      </Shell>
    )
  }
  return (
    <Shell title="Choose your account type" subtitle={type === 'INDIVIDUAL' ? 'Free and instant. You can apply for the other types later with the same login.' : 'Nutritionist and business accounts are approved by an administrator before first sign-in.'}>
      <form onSubmit={submit} className="space-y-4">
        <div className="grid gap-2" role="radiogroup" aria-label="Account type">
          {TYPES.map((t) => (
            <button key={t.id} type="button" role="radio" aria-checked={type === t.id} onClick={() => setType(t.id)}
              className={`flex items-center gap-3 rounded-2xl p-3.5 text-left ring-1 transition ${type === t.id ? 'bg-forest-50 ring-2 ring-forest' : 'bg-white ring-gray-200 hover:ring-forest-300'}`}>
              <span className={`flex h-10 w-10 items-center justify-center rounded-xl ${type === t.id ? 'bg-forest text-white' : 'bg-forest-100 text-forest'}`}><t.icon className="h-5 w-5" /></span>
              <span><span className="block text-sm font-bold">{t.title}</span><span className="text-xs text-gray-500">{t.desc}</span></span>
            </button>
          ))}
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><input className="input" required value={f.fullName} onChange={set('fullName')} autoComplete="name" /></Field>
          <Field label="Phone (optional)"><input className="input" value={f.phone} onChange={set('phone')} autoComplete="tel" /></Field>
        </div>
        {type === 'BUSINESS' && <Field label="Business name"><input className="input" required value={f.businessName} onChange={set('businessName')} /></Field>}
        {type === 'NUTRITIONIST' && <Field label="Specialisation"><input className="input" value={f.specialization} onChange={set('specialization')} placeholder="e.g. Family nutrition, sports, diabetes" /></Field>}
        {type !== 'INDIVIDUAL' && <Field label={type === 'NUTRITIONIST' ? 'Professional registration / licence number' : 'Business registration number or KRA PIN'} hint="Helps the administrator verify and approve you faster">
          <input className="input" value={f.applicationNote} onChange={set('applicationNote')} maxLength={300} placeholder={type === 'NUTRITIONIST' ? 'e.g. KNDI / licence number, or where you practise' : 'e.g. business permit no.'} /></Field>}
        <Field label="Email"><input className="input" type="email" required value={f.email} onChange={set('email')} autoComplete="email" /></Field>
        <Field label="Password" hint="At least 8 characters"><input className="input" type="password" required minLength={8} value={f.password} onChange={set('password')} autoComplete="new-password" /></Field>
        {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{err}</div>}
        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? 'Submitting…' : type === 'INDIVIDUAL' ? 'Create account' : 'Submit application'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">Already registered? <Link className="font-semibold text-forest" to="/login">Sign in</Link></p>
    </Shell>
  )
}

export function Workspace() {
  const { user, loading, setWorkspace, refresh, has } = useAuth()
  const nav = useNavigate()
  const toast = useToast()
  const [busy, setBusy] = useState<Role | null>(null)
  if (loading) return <Spinner />
  if (!user) return <Navigate to="/login" replace />

  if (has('ADMIN') && user.roles.length === 1) return <Navigate to="/admin" replace />
  const open = (r: Role) => { setWorkspace(r); nav(r === 'INDIVIDUAL' ? '/app' : r === 'NUTRITIONIST' ? '/pro' : r === 'BUSINESS' ? '/biz' : '/admin') }
  async function activate(r: Role) {
    setBusy(r)
    try {
      await api.post('/account/roles', { role: r, businessName: r === 'BUSINESS' ? `${user!.full_name}'s Shop` : undefined })
      await refresh()
      if (r === 'INDIVIDUAL') { toast('Workspace added to your account'); open(r) } else toast('Application sent. An administrator will review it and email you.')
    } catch (e: any) { toast(e.message, 'err') } finally { setBusy(null) }
  }
  const cards: { r: Role; icon: any; t: string; d: string }[] = [
    ...(has('ADMIN') ? [{ r: 'ADMIN' as Role, icon: ShieldCheck, t: 'Administration', d: 'Approvals, users and emails.' }] : []),
    { r: 'INDIVIDUAL' as Role, icon: Users, t: 'Personal & family', d: 'Meals, budget, plans and shopping.' },
    { r: 'NUTRITIONIST' as Role, icon: HeartPulse, t: 'Nutritionist', d: 'Clients, plans and progress.' },
    { r: 'BUSINESS' as Role, icon: Store, t: 'Food business', d: 'Products, offers and enquiries.' },
  ]
  return (
    <div className="min-h-screen bg-cream"><div className="container-x py-8"><Logo />
      <div className="mx-auto mt-12 max-w-4xl text-center animate-rise">
        <h1 className="font-display text-3xl font-extrabold">Hello, {user.full_name.split(' ')[0]} 👋</h1>
        <p className="mt-2 text-gray-600">Which dashboard would you like to open?</p>
        <div className={`mt-8 grid gap-5 ${cards.length > 3 ? 'md:grid-cols-2 lg:grid-cols-4' : 'md:grid-cols-3'}`}>
          {cards.map((c) => {
            const owned = has(c.r)
            const req = user.role_requests?.find((q) => q.role === c.r)
            return (
              <div key={c.r} className={`card text-left transition ${owned ? 'hover:-translate-y-1 hover:shadow-lift' : 'opacity-80'}`}>
                <div className={`flex h-12 w-12 items-center justify-center rounded-2xl ${owned ? 'bg-forest text-white' : 'bg-gray-100 text-gray-400'}`}><c.icon className="h-6 w-6" /></div>
                <h3 className="mt-4 font-display text-lg font-extrabold">{c.t}</h3>
                <p className="mt-1 text-sm text-gray-600">{c.d}</p>
                {owned ? <button className="btn btn-primary mt-5 w-full" onClick={() => open(c.r)}>Open</button>
                  : req?.status === 'PENDING' ? <div className="mt-5 flex items-center justify-center gap-2 rounded-full bg-sun-100 px-4 py-2.5 text-sm font-semibold text-sun-600"><Clock className="h-4 w-4" />Awaiting approval</div>
                  : <>
                    {req?.status === 'REJECTED' && <p className="mt-3 text-xs text-red-600">Not approved{req.review_note ? `: ${req.review_note}` : ''}. You can apply again.</p>}
                    <button className="btn btn-ghost mt-5 w-full" disabled={busy === c.r} onClick={() => activate(c.r)}>{busy === c.r ? 'Sending…' : c.r === 'INDIVIDUAL' ? 'Add to my account' : 'Apply for this workspace'}</button></>}
              </div>
            )
          })}
        </div>
      </div></div></div>
  )
}

export function NotFound() {
  return (
    <div className="container-x py-24 text-center">
      <div className="text-6xl">🍽️</div>
      <h1 className="mt-4 font-display text-3xl font-extrabold">This page is off the menu</h1>
      <p className="mt-2 text-gray-600">We couldn't find what you were looking for.</p>
      <Link to="/" className="btn btn-primary mt-6">Back home</Link>
    </div>
  )
}
