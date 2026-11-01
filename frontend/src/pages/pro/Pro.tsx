import { useState, type FormEvent } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowLeft, ClipboardList, Hourglass, Plus, UserPlus, Users, Wand2 } from 'lucide-react'
import { Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Stat, Tabs, Tag, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useApi } from '../../lib/hooks'
import { GOALS, isoDate, ksh, mondayOf, shortDate, timeAgo } from '../../lib/format'
import RosterManager from '../../components/RosterManager'
import type { RosterPerson } from '../../lib/types'
import { PlanBuilder } from '../app/Planner'
import { mealTitle } from '../app/Diary'

export function ProOverview() {
  const o = useApi<any>('/pro/overview')
  const c = useApi<RosterPerson[]>('/pro/roster')
  if (o.loading && !o.data) return <Spinner />
  if (o.error) return <ErrorBox message={o.error} onRetry={o.reload} />
  return (
    <div>
      <PageHeader title="Practice overview" subtitle="Clients who have granted you access, and what needs attention."
        actions={<Link to="/pro/clients" className="btn btn-primary"><UserPlus className="h-4 w-4" />Add or import clients</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active clients" value={o.data.active_clients} tone="good" icon={<Users className="h-4 w-4" />} />
        <Stat label="Waiting to join / accept" value={o.data.pending_invites + o.data.not_registered} sub={`${o.data.not_registered} not registered yet`} icon={<Hourglass className="h-4 w-4" />} />
        <Stat label="Plans created for clients" value={o.data.plans_created} icon={<ClipboardList className="h-4 w-4" />} />
        <Stat label="Progress notes" value={o.data.notes_written} />
      </div>
      <h2 className="mb-3 mt-8 font-display text-xl font-extrabold">Your clients</h2>
      {(c.data ?? []).length === 0 ? <Empty emoji="🩺" title="No clients yet"><Link to="/pro/clients" className="font-semibold text-forest">Add or import your clients</Link>. They are emailed a link to join, and you only see health data once they consent.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">{c.data!.slice(0, 6).map((x) => <ClientCard key={x.id} c={x} />)}</div>)}
    </div>
  )
}

function ClientCard({ c }: { c: RosterPerson }) {
  const active = c.status === 'ACTIVE' && !!c.client_id
  const label = c.status === 'INVITED' ? 'Invited · not joined' : c.status === 'PENDING' ? 'Awaiting consent' : c.status === 'REVOKED' ? 'Access ended' : 'Active'
  const body = (
    <div className={`card h-full ${active ? 'transition hover:-translate-y-1 hover:shadow-lift' : ''}`}>
      <div className="flex items-start justify-between gap-2">
        <div><h3 className="font-display font-extrabold">{c.full_name}</h3><div className="text-xs text-gray-500">{c.email}</div></div>
        <Tag tone={active ? 'green' : c.status === 'REVOKED' ? 'gray' : 'orange'}>{label}</Tag>
      </div>
      {c.goal_note && <p className="mt-2 text-sm text-gray-600">Goal: {c.goal_note}</p>}
      {active && <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-xs text-gray-500">
        <span>Focus: <b>{GOALS[c.goal ?? ''] ?? c.goal}</b></span><span>Meals (7d): <b>{c.meals_7d}</b></span>{c.latest_weight && <span>Weight: <b>{Number(c.latest_weight)} kg</b></span>}</div>}
    </div>
  )
  return active ? <Link to={`/pro/clients/${c.client_id}`}>{body}</Link> : body
}

export function ProClients() {
  return <RosterManager kind="pro" />
}

export function ClientDetail() {
  const { clientId } = useParams()
  const { data: d, error, loading, reload } = useApi<any>(`/pro/clients/${clientId}`)
  const toast = useToast()
  const nav = useNavigate()
  const [tab, setTab] = useState<'overview' | 'diary' | 'progress' | 'plans' | 'notes'>('overview')
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState(false)
  if (loading && !d) return <Spinner />
  if (error || !d) return <div><Link to="/pro/clients" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-forest"><ArrowLeft className="h-4 w-4" />Clients</Link><ErrorBox message={error ?? 'Not found'} onRetry={reload} /></div>

  async function addNote(e: FormEvent) {
    e.preventDefault(); if (!note.trim()) return
    try { await api.post(`/pro/clients/${clientId}/notes`, { note }); setNote(''); toast('Note shared with client'); reload() } catch (e: any) { toast(e.message, 'err') }
  }
  async function auto() {
    setBusy(true)
    try { const r = await api.post<{ id: number }>('/plans/generate', { forUserId: Number(clientId), weekStart: mondayOf(isoDate()) }); toast('Plan generated'); nav(`/pro/plans/${r.id}`) }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  async function end() {
    if (!confirm('End this client relationship? You will lose access to their data.')) return
    try { await api.del(`/pro/clients/${clientId}`); nav('/pro/clients') } catch (e: any) { toast(e.message, 'err') }
  }
  const p = d.profile
  const weights = d.weights.map((w: any) => ({ label: shortDate(String(w.logged_on)), kg: Number(w.weight_kg) }))
  const hist = d.history.days.map((x: any) => ({ ...x, label: shortDate(x.date) }))
  return (
    <div>
      <Link to="/pro/clients" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-forest"><ArrowLeft className="h-4 w-4" />Clients</Link>
      <PageHeader title={d.client.full_name} subtitle={<>{d.client.email} · Focus: {GOALS[p.goal] ?? p.goal}</>}
        actions={<><button className="btn btn-accent" disabled={busy} onClick={auto}><Wand2 className="h-4 w-4" />Auto-plan week</button>
          <Link to={`/pro/clients/${clientId}/plan/new`} className="btn btn-primary"><Plus className="h-4 w-4" />Build plan</Link>
          <button className="btn btn-danger" onClick={end}>End access</button></>} />
      <Tabs tabs={[{ id: 'overview', label: 'Overview' }, { id: 'diary', label: "Today's diary" }, { id: 'progress', label: 'Progress' }, { id: 'plans', label: 'Plans' }, { id: 'notes', label: 'Notes' }]} value={tab} onChange={setTab} />
      {tab === 'overview' && <div className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <Stat label="Household" value={p.household_size} sub="people" /><Stat label="Daily budget" value={ksh(p.daily_budget)} />
          <Stat label="Avg spend (tracked days)" value={ksh(d.history.average_spend)} tone={d.history.average_spend > d.history.daily_budget ? 'bad' : 'good'} /><Stat label="Days tracked (14d)" value={d.history.days_tracked} />
        </div>
        <div className="grid gap-6 lg:grid-cols-2">
          <div className="card"><h3 className="mb-2 font-display font-extrabold">Spending, 14 days</h3><div className="h-56"><ResponsiveContainer width="100%" height="100%"><BarChart data={hist} margin={{ left: -16, right: 4 }}><CartesianGrid vertical={false} stroke="#E5E7EB" /><XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis fontSize={10} tickLine={false} axisLine={false} /><Tooltip formatter={(v: number) => ksh(v)} /><ReferenceLine y={d.history.daily_budget} stroke="#F59E0B" strokeDasharray="4 4" /><Bar dataKey="spend" fill="#166534" radius={[4, 4, 0, 0]} /></BarChart></ResponsiveContainer></div></div>
          <div className="card space-y-2 text-sm"><h3 className="font-display font-extrabold">Client profile</h3>
            <p><b>Allergies:</b> {p.allergies || 'None listed'}</p><p><b>Favourite foods:</b> {p.favorite_foods || '·'}</p><p><b>Notes:</b> {p.diet_notes || '·'}</p><p><b>Meals per day:</b> {p.meals_per_day}</p>
            {d.link.goal_note && <p><b>Agreed goal:</b> {d.link.goal_note}</p>}</div>
        </div></div>}
      {tab === 'diary' && <div className="card divide-y divide-gray-100">{d.today.meals.length === 0 ? <p className="py-4 text-sm text-gray-500">Nothing recorded today.</p> : d.today.meals.map((m: any) => (
        <div key={m.id} className="flex justify-between gap-3 py-3 text-sm"><span><b>{m.meal_type}</b> · {mealTitle(m)}<br /><span className="text-xs text-gray-500">{Math.round(m.calories)} kcal · {Math.round(m.protein)} g protein</span></span><span className="font-bold text-forest">{ksh(m.cost)}</span></div>))}
        <div className="flex justify-between pt-3 text-sm font-semibold"><span>Total</span><span>{Math.round(d.today.totals.calories)} kcal · {ksh(d.today.totals.spend)}</span></div></div>}
      {tab === 'progress' && <div className="grid gap-6 lg:grid-cols-2">
        <div className="card"><h3 className="mb-2 font-display font-extrabold">Weight</h3>{weights.length < 2 ? <p className="py-8 text-center text-sm text-gray-500">Not enough weight entries yet.</p> : <div className="h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={weights} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} stroke="#E5E7EB" /><XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} /><YAxis domain={['dataMin - 1', 'dataMax + 1']} fontSize={10} tickLine={false} axisLine={false} /><Tooltip formatter={(v: number) => `${v} kg`} /><Line dataKey="kg" stroke="#166534" strokeWidth={3} /></LineChart></ResponsiveContainer></div>}</div>
        <div className="card"><h3 className="mb-2 font-display font-extrabold">Calories & protein</h3><div className="h-60"><ResponsiveContainer width="100%" height="100%"><LineChart data={hist} margin={{ left: -12, right: 8 }}><CartesianGrid vertical={false} stroke="#E5E7EB" /><XAxis dataKey="label" fontSize={10} tickLine={false} axisLine={false} interval="preserveStartEnd" /><YAxis fontSize={10} tickLine={false} axisLine={false} /><Tooltip /><Line dataKey="calories" stroke="#F59E0B" strokeWidth={2.5} dot={false} /><Line dataKey="protein" stroke="#166534" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></div></div>}
      {tab === 'plans' && (d.plans.length === 0 ? <Empty emoji="📅" title="No plans for this client yet">Use “Auto-plan week” or “Build plan”.</Empty> : <div className="grid gap-4 md:grid-cols-2">{d.plans.map((pl: any) => <Link key={pl.id} to={`/pro/plans/${pl.id}`} className="card transition hover:-translate-y-1 hover:shadow-lift"><h3 className="font-display font-extrabold">{pl.title}</h3><div className="text-xs text-gray-500">Week of {shortDate(pl.week_start)}</div></Link>)}</div>)}
      {tab === 'notes' && <div className="space-y-4">
        <form onSubmit={addNote} className="card space-y-3"><Field label="New progress note (visible to the client)"><textarea className="input min-h-[90px]" value={note} onChange={(e) => setNote(e.target.value)} /></Field><button className="btn btn-primary">Share note</button></form>
        {d.notes.map((n: any) => <div key={n.id} className="card"><div className="text-xs text-gray-500">{timeAgo(String(n.created_at))}</div><p className="mt-1 text-sm">{n.note}</p></div>)}</div>}
    </div>
  )
}

export function ClientPlanBuilder() {
  const { clientId } = useParams()
  const { data, loading, error } = useApi<any>(`/pro/clients/${clientId}`)
  if (loading) return <Spinner />
  if (error || !data) return <ErrorBox message={error ?? 'Not found'} />
  return <PlanBuilder base="/pro/plans" forUserId={Number(clientId)} forName={data.client.full_name} />
}

export function ProProfile() {
  const { data, error, loading, reload } = useApi<any>('/pro/profile')
  const toast = useToast()
  const [f, setF] = useState<any>(null)
  const cur = f ?? data
  if (loading && !data) return <Spinner />
  if (error || !cur) return <ErrorBox message={error ?? 'Failed'} onRetry={reload} />
  const set = (k: string, v: any) => setF({ ...cur, [k]: v })
  async function save(e: FormEvent) {
    e.preventDefault()
    try { await api.put('/pro/profile', { headline: cur.headline, bio: cur.bio, specialization: cur.specialization, city: cur.city, monthlyFee: Number(cur.monthly_fee), acceptingClients: cur.accepting_clients }); toast('Profile saved and live in the directory.'); setF(null); reload() }
    catch (e: any) { toast(e.message, 'err') }
  }
  return (
    <div className="max-w-2xl">
      <PageHeader title="Public profile" subtitle="This is what households see in the nutritionist directory." />
      <form onSubmit={save} className="card space-y-4">
        <Field label="Headline"><input className="input" value={cur.headline ?? ''} onChange={(e) => set('headline', e.target.value)} placeholder="Registered dietitian for busy families" /></Field>
        <Field label="Specialisation"><input className="input" value={cur.specialization ?? ''} onChange={(e) => set('specialization', e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2"><Field label="City"><input className="input" value={cur.city ?? ''} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Monthly fee (KSh)"><input className="input" type="number" min={0} value={cur.monthly_fee ?? 0} onChange={(e) => set('monthly_fee', e.target.value)} /></Field></div>
        <Field label="About you"><textarea className="input min-h-[120px]" value={cur.bio ?? ''} onChange={(e) => set('bio', e.target.value)} /></Field>
        <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-forest" checked={!!cur.accepting_clients} onChange={(e) => set('accepting_clients', e.target.checked)} />Accepting new clients</label>
        <button className="btn btn-primary">Save profile</button>
      </form>
    </div>
  )
}
