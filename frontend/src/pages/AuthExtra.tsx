import { useEffect, useState, type FormEvent } from 'react'
import { Link, Navigate, useNavigate, useSearchParams } from 'react-router-dom'
import { CheckCircle2, MailCheck } from 'lucide-react'
import { Field, Spinner } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import type { User } from '../lib/types'
import { Shell } from './Auth'

export function ForgotPassword() {
  const [email, setEmail] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true); setErr('')
    try { await api.post('/auth/forgot-password', { email }); setDone(true) }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  if (done) {
    return (
      <Shell title="Check your email" subtitle="We sent instructions if that address has an account.">
        <div className="card text-center">
          <MailCheck className="mx-auto h-10 w-10 text-forest" />
          <p className="mt-3 text-sm text-gray-600">If an account uses <b>{email}</b>, a reset link is on its way. It works once and expires in 1 hour. Check your spam folder too.</p>
          <Link to="/login" className="btn btn-ghost mt-5">Back to sign in</Link>
        </div>
      </Shell>
    )
  }
  return (
    <Shell title="Forgot your password?" subtitle="Enter your email and we'll send you a link to choose a new one.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input" type="email" required autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} /></Field>
        {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{err}</div>}
        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? 'Sending…' : 'Send reset link'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500"><Link className="font-semibold text-forest" to="/login">Back to sign in</Link></p>
    </Shell>
  )
}

export function ResetPassword() {
  const [sp] = useSearchParams()
  const token = sp.get('token') ?? ''
  const nav = useNavigate()
  const [pw, setPw] = useState('')
  const [pw2, setPw2] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (pw.length < 8) { setErr('Password must be at least 8 characters'); return }
    if (pw !== pw2) { setErr('The two passwords do not match'); return }
    setBusy(true)
    try { await api.post('/auth/reset-password', { token, password: pw }); setDone(true); setTimeout(() => nav('/login'), 2500) }
    catch (e: any) { setErr(e.message) } finally { setBusy(false) }
  }
  if (!token) return <Shell title="Link not valid" subtitle="This reset link is missing its token."><Link to="/forgot-password" className="btn btn-primary">Request a new link</Link></Shell>
  if (done) {
    return (
      <Shell title="Password updated" subtitle="You can sign in with your new password.">
        <div className="card text-center"><CheckCircle2 className="mx-auto h-10 w-10 text-forest" /><Link to="/login" className="btn btn-primary mt-5">Sign in</Link></div>
      </Shell>
    )
  }
  return (
    <Shell title="Choose a new password" subtitle="Use at least 8 characters.">
      <form onSubmit={submit} className="space-y-4">
        <Field label="New password"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw} onChange={(e) => setPw(e.target.value)} /></Field>
        <Field label="Repeat new password"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={pw2} onChange={(e) => setPw2(e.target.value)} /></Field>
        {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{err} {err.includes('expired') && <Link to="/forgot-password" className="font-semibold underline">Request a new link</Link>}</div>}
        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
      </form>
    </Shell>
  )
}

interface InviteInfo { owner_name: string; owner_role: 'NUTRITIONIST' | 'BUSINESS'; full_name: string; email: string; phone: string | null }

/** Landing page of the personal registration link a nutritionist or business emails to someone they added. */
export function Join() {
  const [sp] = useSearchParams()
  const token = sp.get('token') ?? ''
  const { user, startSession } = useAuth()
  const nav = useNavigate()
  const [info, setInfo] = useState<InviteInfo | null>(null)
  const [loadErr, setLoadErr] = useState('')
  const [f, setF] = useState({ fullName: '', phone: '', password: '' })
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  useEffect(() => {
    if (!token) { setLoadErr('This invitation link is missing its token.'); return }
    api.get<InviteInfo>(`/auth/invite/${encodeURIComponent(token)}`)
      .then((i) => { setInfo(i); setF((x) => ({ ...x, fullName: i.full_name, phone: i.phone ?? '' })) })
      .catch((e) => setLoadErr(e.message))
  }, [token])

  if (user) return <Navigate to="/workspace" replace />
  if (loadErr) return <Shell title="Invitation not available" subtitle={loadErr}><div className="flex gap-3"><Link to="/login" className="btn btn-primary">Sign in</Link><Link to="/forgot-password" className="btn btn-ghost">Forgot password</Link></div></Shell>
  if (!info) return <Spinner label="Loading your invitation" />

  const pro = info.owner_role === 'NUTRITIONIST'
  async function submit(e: FormEvent) {
    e.preventDefault(); setErr('')
    if (f.password.length < 8) { setErr('Password must be at least 8 characters'); return }
    setBusy(true)
    try {
      const res = await api.post<{ token: string; user: User }>(`/auth/invite/${encodeURIComponent(token)}/accept`, f)
      startSession(res.token, res.user)
      nav('/app/onboarding', { replace: true })
    } catch (e: any) { setErr(e.message); setBusy(false) }
  }
  return (
    <Shell title={`${info.owner_name} invited you`} subtitle={pro ? 'Create your free account to start working with your nutritionist.' : 'Create your free account to plan meals and see their fresh produce and offers.'}>
      <form onSubmit={submit} className="space-y-4">
        <Field label="Email"><input className="input bg-gray-50" value={info.email} disabled /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Full name"><input className="input" required value={f.fullName} onChange={(e) => setF({ ...f, fullName: e.target.value })} autoComplete="name" /></Field>
          <Field label="Phone (optional)"><input className="input" value={f.phone} onChange={(e) => setF({ ...f, phone: e.target.value })} autoComplete="tel" /></Field>
        </div>
        <Field label="Choose a password" hint="At least 8 characters"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={f.password} onChange={(e) => setF({ ...f, password: e.target.value })} /></Field>
        <div className="rounded-xl bg-forest-50 p-3 text-xs text-gray-600">
          {pro ? <>By creating your account you let <b>{info.owner_name}</b> see your food diary, budget and progress and share meal plans and notes with you. You can withdraw access at any time from “My nutritionist”.</>
            : <><b>{info.owner_name}</b> will only see your name and the contact details you share. No health or diary data is ever shared with businesses.</>}
        </div>
        {err && <div className="rounded-xl bg-red-50 p-3 text-sm text-red-700" role="alert">{err}</div>}
        <button className="btn btn-primary w-full py-3" disabled={busy}>{busy ? 'Creating account…' : 'Create my account'}</button>
      </form>
      <p className="mt-6 text-center text-sm text-gray-500">Already have an account? <Link className="font-semibold text-forest" to="/login">Sign in</Link></p>
    </Shell>
  )
}

