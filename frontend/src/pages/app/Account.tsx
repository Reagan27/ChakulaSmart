import { useState, type FormEvent } from 'react'
import { useNavigate } from 'react-router-dom'
import { Check, Crown } from 'lucide-react'
import { Field, PageHeader, Tag, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useApi } from '../../lib/hooks'
import { GOALS, ksh } from '../../lib/format'
import type { PlanInfo, Profile, Role, User } from '../../lib/types'

const ALLERGENS = [['dairy', 'Milk / dairy'], ['nuts', 'Groundnuts'], ['egg', 'Eggs'], ['gluten', 'Gluten / wheat'], ['fish', 'Fish']]

export function ProfileForm({ initial, submitLabel, onDone }: { initial: Profile; submitLabel: string; onDone?: () => void }) {
  const { setUser } = useAuth()
  const toast = useToast()
  const [f, setF] = useState({
    goal: initial.goal, householdSize: initial.household_size, dailyBudget: Number(initial.daily_budget), mealsPerDay: initial.meals_per_day,
    allergies: initial.allergies ?? '', favoriteFoods: initial.favorite_foods ?? '', dietNotes: initial.diet_notes ?? '',
  })
  const [busy, setBusy] = useState(false)
  const selected = f.allergies.toLowerCase().split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  const toggle = (k: string) => {
    const next = selected.includes(k) ? selected.filter((s) => s !== k) : [...selected, k]
    setF({ ...f, allergies: next.join(', ') })
  }
  async function submit(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try { setUser(await api.put<User>('/account/profile', f)); toast('Preferences saved'); onDone?.() }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="space-y-5">
      <div>
        <span className="label">What is your main goal?</span>
        <div className="grid gap-2 sm:grid-cols-2">
          {Object.entries(GOALS).map(([k, v]) => (
            <button key={k} type="button" onClick={() => setF({ ...f, goal: k })} aria-pressed={f.goal === k}
              className={`rounded-xl px-4 py-3 text-left text-sm font-semibold ring-1 transition ${f.goal === k ? 'bg-forest-50 ring-2 ring-forest text-forest-800' : 'bg-white ring-gray-200 hover:ring-forest-300'}`}>{v}</button>
          ))}
        </div>
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Field label="People you cook for"><input className="input" type="number" min={1} max={30} value={f.householdSize} onChange={(e) => setF({ ...f, householdSize: +e.target.value })} /></Field>
        <Field label="Daily food budget (KSh)" hint="For the whole household"><input className="input" type="number" min={0} step={50} value={f.dailyBudget} onChange={(e) => setF({ ...f, dailyBudget: +e.target.value })} /></Field>
        <Field label="Meals per day"><input className="input" type="number" min={1} max={6} value={f.mealsPerDay} onChange={(e) => setF({ ...f, mealsPerDay: +e.target.value })} /></Field>
      </div>
      <div>
        <span className="label">Allergies or foods to avoid</span>
        <div className="flex flex-wrap gap-2">
          {ALLERGENS.map(([k, l]) => (
            <button key={k} type="button" aria-pressed={selected.includes(k)} onClick={() => toggle(k)}
              className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ${selected.includes(k) ? 'bg-red-50 text-red-700 ring-red-300' : 'bg-white text-gray-600 ring-gray-200'}`}>{l}</button>
          ))}
        </div>
        <input className="input mt-2" placeholder="Anything else, comma separated" value={f.allergies} onChange={(e) => setF({ ...f, allergies: e.target.value })} />
      </div>
      <Field label="Foods you normally eat or enjoy" hint="Comma separated, e.g. ugali, sukuma, beans, omena"><input className="input" value={f.favoriteFoods} onChange={(e) => setF({ ...f, favoriteFoods: e.target.value })} /></Field>
      <Field label="Dietary notes"><textarea className="input min-h-[80px]" value={f.dietNotes} onChange={(e) => setF({ ...f, dietNotes: e.target.value })} placeholder="e.g. two children under 10, vegetarian on Fridays" /></Field>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : submitLabel}</button>
    </form>
  )
}

export function Onboarding() {
  const { user } = useAuth()
  const nav = useNavigate()
  if (!user) return null
  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Let's personalise ChakulaSmart" subtitle="A few quick questions so your suggestions fit your goals, family and budget." />
      <div className="card"><ProfileForm initial={user.profile} submitLabel="Save and go to my dashboard" onDone={() => nav('/app')} /></div>
    </div>
  )
}

function PasswordForm() {
  const toast = useToast()
  const [cur, setCur] = useState('')
  const [next, setNext] = useState('')
  const [busy, setBusy] = useState(false)
  async function submit(e: FormEvent) {
    e.preventDefault()
    if (next.length < 8) { toast('New password must be at least 8 characters', 'err'); return }
    setBusy(true)
    try { await api.post('/account/password', { currentPassword: cur, newPassword: next }); toast('Password updated'); setCur(''); setNext('') }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <form onSubmit={submit} className="card space-y-4">
      <h2 className="font-display text-lg font-extrabold">Change password</h2>
      <Field label="Current password"><input className="input" type="password" required autoComplete="current-password" value={cur} onChange={(e) => setCur(e.target.value)} /></Field>
      <Field label="New password" hint="At least 8 characters"><input className="input" type="password" required minLength={8} autoComplete="new-password" value={next} onChange={(e) => setNext(e.target.value)} /></Field>
      <button className="btn btn-primary" disabled={busy}>{busy ? 'Saving…' : 'Update password'}</button>
    </form>
  )
}

export default function Account() {
  const { user, setUser, has, refresh } = useAuth()
  const toast = useToast()
  const plans = useApi<PlanInfo[]>('/public/plans')
  const [name, setName] = useState(user?.full_name ?? '')
  const [phone, setPhone] = useState(user?.phone ?? '')
  const [busy, setBusy] = useState('')
  if (!user) return null

  async function saveMe(e: FormEvent) {
    e.preventDefault(); setBusy('me')
    try { setUser(await api.put<User>('/account/me', { fullName: name, phone })); toast('Details updated') }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy('') }
  }
  async function addRole(role: Role) {
    setBusy(role)
    try {
      setUser(await api.post<User>('/account/roles', { role, businessName: role === 'BUSINESS' ? `${user!.full_name}'s Shop` : undefined }))
      toast(role === 'INDIVIDUAL' ? 'Workspace added. Find it in the workspace switcher.' : 'Application sent. An administrator will review it and email you.')
    }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy('') }
  }
  async function subscribe(code: string) {
    setBusy(code)
    try { const r = await api.post<{ user: User }>('/billing/subscribe', { planCode: code }); setUser(r.user); toast('Plan activated for 30 days (demo billing, nobody was charged)') }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy('') }
  }
  async function cancel(code: string) {
    setBusy(code)
    try { setUser(await api.del<User>(`/billing/subscriptions/${code}`)); toast('Subscription cancelled') }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(''); refresh() }
  }
  const active = new Map(user.subscriptions.filter((s) => s.status === 'ACTIVE').map((s) => [s.plan_code, s]))
  const paid = (plans.data ?? []).filter((p) => p.price_kes > 0 && has(p.role))

  return (
    <div className="space-y-8">
      <PageHeader title="Account & plan" subtitle="Your details, workspaces and subscription." />
      <div className="grid gap-6 lg:grid-cols-2">
        <form onSubmit={saveMe} className="card space-y-4">
          <h2 className="font-display text-lg font-extrabold">Your details</h2>
          <Field label="Full name"><input className="input" required value={name} onChange={(e) => setName(e.target.value)} /></Field>
          <Field label="Phone"><input className="input" value={phone ?? ''} onChange={(e) => setPhone(e.target.value)} /></Field>
          <Field label="Email"><input className="input bg-gray-50" value={user.email} disabled /></Field>
          <button className="btn btn-primary" disabled={busy === 'me'}>Save details</button>
        </form>
        {!has('ADMIN') && <div className="card">
          <h2 className="font-display text-lg font-extrabold">Workspaces on this account</h2>
          <p className="mt-1 text-sm text-gray-500">One login, several dashboards. Nutritionist and business workspaces are approved by an administrator.</p>
          <div className="mt-4 space-y-3">
            {([['INDIVIDUAL', 'Personal & family'], ['NUTRITIONIST', 'Nutritionist'], ['BUSINESS', 'Food business']] as [Role, string][]).map(([r, l]) => {
              const req = user.role_requests?.find((q) => q.role === r)
              return (
                <div key={r} className="rounded-xl bg-forest-50 px-4 py-3">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{l}</span>
                    {has(r) ? <Tag>Active</Tag> : req?.status === 'PENDING' ? <Tag tone="orange">Awaiting approval</Tag>
                      : <button className="btn btn-ghost btn-sm" disabled={busy === r} onClick={() => addRole(r)}>{busy === r ? 'Sending…' : r === 'INDIVIDUAL' ? 'Activate' : req?.status === 'REJECTED' ? 'Apply again' : 'Apply'}</button>}
                  </div>
                  {req?.status === 'REJECTED' && <p className="mt-1 text-xs text-red-600">Not approved{req.review_note ? `: ${req.review_note}` : ''}</p>}
                </div>)
            })}
          </div>
        </div>}
        <PasswordForm />
      </div>

      {paid.length > 0 && <div>
        <h2 className="font-display text-xl font-extrabold">Subscriptions</h2>
        <p className="mt-1 text-sm text-gray-500">Billing is in <b>demo mode</b>: activating a plan unlocks it for 30 days without payment. Connect M-Pesa before launch (see README).</p>
        <div className="mt-4 grid gap-5 md:grid-cols-2 xl:grid-cols-3">
          {paid.map((p) => {
            const s = active.get(p.code)
            return (
              <div key={p.code} className={`card flex flex-col ${s ? 'ring-2 ring-forest' : ''}`}>
                <div className="flex items-center justify-between"><h3 className="font-display text-lg font-extrabold">{p.name}</h3>{s && <Tag><Crown className="mr-1 h-3 w-3" />Active</Tag>}</div>
                <div className="mt-1 font-display text-2xl font-extrabold text-forest">{ksh(p.price_kes)}<span className="text-sm font-medium text-gray-500"> / month</span></div>
                <ul className="mt-3 flex-1 space-y-1.5 text-sm">{p.features.map((f) => <li key={f} className="flex gap-2"><Check className="mt-0.5 h-4 w-4 shrink-0 text-forest" />{f}</li>)}</ul>
                {s && <p className="mt-3 text-xs text-gray-500">Renews {new Date(s.renews_at).toLocaleDateString('en-KE')}</p>}
                {s ? <button className="btn btn-danger mt-4" disabled={busy === p.code} onClick={() => cancel(p.code)}>Cancel plan</button>
                  : <button className="btn btn-primary mt-4" disabled={busy === p.code} onClick={() => subscribe(p.code)}>{busy === p.code ? 'Activating…' : 'Activate plan'}</button>}
              </div>
            )
          })}
        </div>
      </div>}

      {has('INDIVIDUAL') && (
        <div>
          <h2 className="mb-3 font-display text-xl font-extrabold">Food preferences</h2>
          <div className="card"><ProfileForm initial={user.profile} submitLabel="Save preferences" /></div>
        </div>
      )}
    </div>
  )
}
