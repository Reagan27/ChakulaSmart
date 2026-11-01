import { Link } from 'react-router-dom'
import { Check, Eye, ShieldCheck, X } from 'lucide-react'
import { Empty, PageHeader, Spinner, Tag, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useApi } from '../../lib/hooks'
import { shortDate, timeAgo } from '../../lib/format'

export default function Care() {
  const reqs = useApi<any[]>('/care/requests')
  const team = useApi<any[]>('/care/team')
  const notes = useApi<any[]>('/care/notes')
  const log = useApi<any[]>('/care/access-log')
  const plans = useApi<any[]>('/plans?mine=true')
  const toast = useToast()
  const reloadAll = () => { reqs.reload(); team.reload(); notes.reload(); log.reload() }

  async function respond(id: number, accept: boolean) {
    try { await api.post(`/care/requests/${id}/respond`, { accept }); toast(accept ? 'Access granted' : 'Request declined'); reloadAll() } catch (e: any) { toast(e.message, 'err') }
  }
  async function withdraw(id: number) {
    if (!confirm('Withdraw access? This nutritionist will no longer see your data.')) return
    try { await api.del(`/care/team/${id}`); toast('Access withdrawn'); reloadAll() } catch (e: any) { toast(e.message, 'err') }
  }
  if (reqs.loading && !reqs.data) return <Spinner />
  const proPlans = (plans.data ?? []).filter((p) => p.by_professional)
  return (
    <div className="space-y-8">
      <PageHeader title="My nutritionist" subtitle="You decide who can see your food diary and progress. Access starts only when you accept." />
      <div className="flex items-start gap-3 rounded-2xl bg-forest-50 p-4 text-sm text-forest-800"><ShieldCheck className="mt-0.5 h-5 w-5 shrink-0" />Nutritionists can see your diary, spending and weight only while access is active. You can withdraw at any time, and every view is logged below.</div>

      <section><h2 className="mb-3 font-display text-xl font-extrabold">Requests waiting for you</h2>
        {(reqs.data ?? []).length === 0 ? <Empty emoji="📭" title="No pending requests">Nutritionists can invite you by your email address. <Link className="font-semibold text-forest" to="/directory/nutritionists">Find a nutritionist</Link></Empty> : (
          <div className="grid gap-4 md:grid-cols-2">{reqs.data!.map((r) => (
            <div key={r.link_id} className="card ring-2 ring-sun/40">
              <h3 className="font-display font-extrabold">{r.full_name}</h3><p className="text-sm text-gray-600">{r.headline}</p>
              {r.goal_note && <p className="mt-2 rounded-xl bg-sun-100/60 p-3 text-sm">“{r.goal_note}”</p>}
              <div className="mt-4 flex gap-2"><button className="btn btn-primary btn-sm flex-1" onClick={() => respond(r.link_id, true)}><Check className="h-4 w-4" />Accept &amp; share</button><button className="btn btn-ghost btn-sm flex-1" onClick={() => respond(r.link_id, false)}><X className="h-4 w-4" />Decline</button></div>
            </div>))}</div>)}
      </section>

      <section><h2 className="mb-3 font-display text-xl font-extrabold">Your care team</h2>
        {(team.data ?? []).length === 0 ? <p className="text-sm text-gray-500">You haven't shared your data with anyone.</p> : (
          <div className="grid gap-4 md:grid-cols-2">{team.data!.map((t) => (
            <div key={t.link_id} className="card"><div className="flex items-start justify-between"><div><h3 className="font-display font-extrabold">{t.full_name}</h3><p className="text-sm text-gray-600">{t.headline}</p></div><Tag>Active</Tag></div>
              {t.goal_note && <p className="mt-2 text-sm text-gray-500">Goal: {t.goal_note}</p>}
              <button className="btn btn-danger btn-sm mt-4" onClick={() => withdraw(t.link_id)}>Withdraw access</button></div>))}</div>)}
      </section>

      {proPlans.length > 0 && <section><h2 className="mb-3 font-display text-xl font-extrabold">Plans from your nutritionist</h2>
        <div className="grid gap-4 md:grid-cols-2">{proPlans.map((p) => <Link key={p.id} to={`/app/planner/${p.id}`} className="card transition hover:-translate-y-1 hover:shadow-lift"><h3 className="font-display font-extrabold">{p.title}</h3><div className="text-xs text-gray-500">By {p.owner_name} · week of {shortDate(p.week_start)}</div></Link>)}</div></section>}

      <section><h2 className="mb-3 font-display text-xl font-extrabold">Notes from your nutritionist</h2>
        {(notes.data ?? []).length === 0 ? <p className="text-sm text-gray-500">No notes yet.</p> : <div className="space-y-3">{notes.data!.map((n) => <div key={n.id} className="card"><div className="text-xs font-semibold text-forest">{n.nutritionist_name} · {timeAgo(String(n.created_at))}</div><p className="mt-1 text-sm">{n.note}</p></div>)}</div>}
      </section>

      <section><h2 className="mb-3 flex items-center gap-2 font-display text-xl font-extrabold"><Eye className="h-5 w-5" />Who viewed your data</h2>
        {(log.data ?? []).length === 0 ? <p className="text-sm text-gray-500">Nobody has viewed your data.</p> : <div className="card divide-y divide-gray-100 p-0">{log.data!.map((a) => <div key={a.id} className="flex justify-between px-5 py-3 text-sm"><span><b>{a.actor_name}</b> · {String(a.action).toLowerCase().replace(/_/g, ' ')}</span><span className="text-gray-500">{timeAgo(String(a.created_at))}</span></div>)}</div>}
      </section>
    </div>
  )
}
