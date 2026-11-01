import { useMemo, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, CalendarPlus, FileDown, ShoppingBasket, Sparkles, Trash2, Wand2 } from 'lucide-react'
import { Empty, ErrorBox, Field, PageHeader, Spinner, Tag, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useApi } from '../../lib/hooks'
import { addDays, DAYS, isoDate, ksh, MEAL_EMOJI, MEAL_LABEL, MEAL_TYPES, mondayOf, shortDate } from '../../lib/format'
import type { Recipe } from '../../lib/types'

export function PlannerList({ base = '/app/planner', mineOnly = true, title = 'Meal planner', canAuto = true }: { base?: string; mineOnly?: boolean; title?: string; canAuto?: boolean }) {
  const { data, error, loading, reload } = useApi<any[]>(`/plans?mine=${mineOnly}`)
  const toast = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState(false)

  async function auto() {
    setBusy(true)
    try { const r = await api.post<{ id: number }>('/plans/generate', { weekStart: mondayOf(isoDate()) }); toast('Your week is planned'); nav(`${base}/${r.id}`) }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <div>
      <PageHeader title={title} subtitle="Plan a whole week, turn it into a shopping list, or download a PDF."
        actions={<>
          {canAuto && <button className="btn btn-accent" disabled={busy} onClick={auto}><Wand2 className="h-4 w-4" />{busy ? 'Planning…' : 'Auto-plan this week'}</button>}
          <Link to={`${base}/new`} className="btn btn-primary"><CalendarPlus className="h-4 w-4" />Build my own</Link>
        </>} />
      {loading && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && <Empty emoji="📅" title="No plans yet">Tap “Auto-plan this week” and ChakulaSmart builds seven days of meals around your budget and goal.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {(data ?? []).map((p) => (
          <Link key={p.id} to={`${base}/${p.id}`} className="card transition hover:-translate-y-1 hover:shadow-lift">
            <div className="flex items-start justify-between gap-2">
              <div><h3 className="font-display font-extrabold">{p.title}</h3><div className="mt-1 text-xs text-gray-500">Week of {shortDate(p.week_start)}{p.for_user_id !== p.owner_id ? ` · for ${p.for_name}` : ''}</div></div>
              {p.by_professional && <Tag tone="orange">By {p.owner_name}</Tag>}
            </div>
            {p.note && <p className="mt-2 line-clamp-2 text-sm text-gray-600">{p.note}</p>}
          </Link>
        ))}
      </div>
    </div>
  )
}

export function PlanDetail({ base = '/app/planner' }: { base?: string }) {
  const { id } = useParams()
  const { user } = useAuth()
  const { data: p, error, loading, reload } = useApi<any>(`/plans/${id}`)
  const toast = useToast()
  const nav = useNavigate()
  const [busy, setBusy] = useState('')
  if (loading) return <Spinner />
  if (error || !p) return <ErrorBox message={error ?? 'Plan not found'} onRetry={reload} />

  const types = MEAL_TYPES.filter((t) => p.entries.some((e: any) => e.meal_type === t))
  const cell = (day: number, t: string) => p.entries.find((e: any) => e.day_index === day && e.meal_type === t)?.recipe as Recipe | undefined
  async function shopping() {
    setBusy('shop')
    try { const r = await api.post<{ id: number }>(`/plans/${id}/shopping-list`); toast('Shopping list created'); nav(`/app/shopping/${r.id}`) }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy('') }
  }
  async function pdf() {
    setBusy('pdf')
    try { await api.download(`/plans/${id}/pdf`, `chakulasmart-meal-plan-${id}.pdf`) } catch (e: any) { toast(e.message, 'err') } finally { setBusy('') }
  }
  async function remove() {
    if (!confirm('Delete this meal plan?')) return
    try { await api.del(`/plans/${id}`); toast('Plan deleted'); nav(base) } catch (e: any) { toast(e.message, 'err') }
  }
  const mine = p.owner_id === user?.id
  return (
    <div>
      <Link to={base} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-forest"><ArrowLeft className="h-4 w-4" />All plans</Link>
      <PageHeader title={p.title} subtitle={<>Week of {shortDate(p.week_start)} · for {p.for_name} · prepared by {p.owner_name}</>}
        actions={<>
          {p.for_user_id === user?.id && <button className="btn btn-primary" disabled={!!busy} onClick={shopping}><ShoppingBasket className="h-4 w-4" />Shopping list</button>}
          <button className="btn btn-ghost" disabled={!!busy} onClick={pdf}><FileDown className="h-4 w-4" />PDF</button>
          {mine && <button className="btn btn-danger" onClick={remove}><Trash2 className="h-4 w-4" />Delete</button>}
        </>} />
      {p.note && <div className="mb-5 rounded-2xl bg-sun-100 p-4 text-sm"><b>Note:</b> {p.note}</div>}
      <div className="mb-5 grid gap-4 sm:grid-cols-3">
        <div className="card"><div className="label">Cost per person / week</div><div className="font-display text-2xl font-extrabold text-forest">{ksh(p.total_cost_per_person)}</div></div>
        <div className="card"><div className="label">Average per person / day</div><div className="font-display text-2xl font-extrabold">{ksh(p.avg_daily_cost_per_person)}</div></div>
        <div className="card"><div className="label">Meals planned</div><div className="font-display text-2xl font-extrabold">{p.entries.length}</div></div>
      </div>
      <div className="card overflow-x-auto p-0">
        <table className="w-full min-w-[860px] text-left text-sm">
          <thead><tr className="border-b border-gray-100 bg-forest-50 text-xs uppercase tracking-wide text-forest-800">
            <th className="w-24 px-4 py-3" />{DAYS.map((d, i) => <th key={d} className="px-3 py-3">{d}<div className="font-normal normal-case text-gray-500">{shortDate(addDays(p.week_start, i))}</div></th>)}
          </tr></thead>
          <tbody>
            {types.map((t) => (
              <tr key={t} className="border-b border-gray-50 align-top">
                <th className="px-4 py-3 text-xs font-bold text-gray-500">{MEAL_EMOJI[t]} {MEAL_LABEL[t]}</th>
                {DAYS.map((_, di) => {
                  const r = cell(di, t)
                  return <td key={di} className="px-3 py-3">{r ? <Link to={`/recipes/${r.id}`} className="block rounded-xl bg-white p-2 ring-1 ring-gray-100 transition hover:ring-forest"><div className="text-base">{r.emoji}</div><div className="text-xs font-bold leading-tight">{r.name}</div><div className="mt-1 text-[11px] text-gray-500">{ksh(r.cost)} · {Math.round(r.calories)} kcal</div></Link> : <span className="text-gray-300">·</span>}</td>
                })}
              </tr>
            ))}
            <tr className="bg-forest-50/60 text-xs font-semibold"><th className="px-4 py-3 text-forest-800">Day total</th>
              {p.days.map((d: any) => <td key={d.day_index} className="px-3 py-3">{ksh(d.cost)}<div className="font-normal text-gray-500">{Math.round(d.calories)} kcal</div></td>)}</tr>
          </tbody>
        </table>
      </div>
      <p className="mt-3 text-xs text-gray-500">Costs and calories are per person. Shopping lists multiply by your household size.</p>
    </div>
  )
}

export function PlanBuilder({ base = '/app/planner', forUserId, forName }: { base?: string; forUserId?: number; forName?: string }) {
  const recipes = useApi<Recipe[]>('/public/recipes')
  const toast = useToast()
  const nav = useNavigate()
  const [title, setTitle] = useState(forName ? `Plan for ${forName}` : 'My week')
  const [week, setWeek] = useState(mondayOf(isoDate()))
  const [note, setNote] = useState('')
  const [types, setTypes] = useState<string[]>(['BREAKFAST', 'LUNCH', 'DINNER'])
  const [cells, setCells] = useState<Record<string, number>>({})
  const [busy, setBusy] = useState(false)

  const byId = useMemo(() => new Map((recipes.data ?? []).map((r) => [r.id, r])), [recipes.data])
  const dayCost = (di: number) => types.reduce((s, t) => s + (byId.get(cells[`${di}:${t}`])?.cost ?? 0), 0)
  const total = DAYS.reduce((s, _, i) => s + dayCost(i), 0)
  const set = (k: string, v: string) => setCells((c) => { const n = { ...c }; if (v) n[k] = Number(v); else delete n[k]; return n })
  const toggle = (t: string) => setTypes((x) => (x.includes(t) ? x.filter((y) => y !== t) : [...x, t]))

  async function save() {
    const entries = Object.entries(cells).filter(([k]) => types.includes(k.split(':')[1])).map(([k, recipeId]) => {
      const [d, t] = k.split(':'); return { dayIndex: Number(d), mealType: t, recipeId }
    })
    if (entries.length === 0) { toast('Pick at least one meal', 'err'); return }
    setBusy(true)
    try { const r = await api.post<{ id: number }>('/plans', { title, weekStart: week, forUserId: forUserId ?? null, note: note || null, entries }); toast('Plan saved'); nav(`${base}/${r.id}`) }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <div>
      <Link to={base} className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-forest"><ArrowLeft className="h-4 w-4" />Back</Link>
      <PageHeader title="Build a meal plan" subtitle={forName ? `Planning for ${forName}` : 'Choose a recipe for each meal. Leave a slot empty to skip it.'}
        actions={<button className="btn btn-primary" disabled={busy} onClick={save}><Sparkles className="h-4 w-4" />{busy ? 'Saving…' : 'Save plan'}</button>} />
      <div className="card mb-5 grid gap-4 md:grid-cols-3">
        <Field label="Title"><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} /></Field>
        <Field label="Week starting (Monday)"><input type="date" className="input" value={week} onChange={(e) => e.target.value && setWeek(mondayOf(e.target.value))} /></Field>
        <Field label="Note"><input className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optional guidance" /></Field>
        <div className="md:col-span-3 flex flex-wrap items-center gap-2"><span className="label mb-0 mr-2">Meals per day</span>
          {MEAL_TYPES.map((t) => <button key={t} type="button" aria-pressed={types.includes(t)} onClick={() => toggle(t)} className={`rounded-full px-3.5 py-1.5 text-xs font-semibold ring-1 ${types.includes(t) ? 'bg-forest text-white ring-forest' : 'bg-white text-gray-600 ring-gray-200'}`}>{MEAL_LABEL[t]}</button>)}</div>
      </div>
      {recipes.loading && <Spinner />}
      {recipes.data && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead><tr className="border-b border-gray-100 bg-forest-50 text-xs uppercase tracking-wide text-forest-800"><th className="w-24 px-4 py-3" />{DAYS.map((d) => <th key={d} className="px-2 py-3">{d}</th>)}</tr></thead>
            <tbody>
              {types.sort((a, b) => MEAL_TYPES.indexOf(a as any) - MEAL_TYPES.indexOf(b as any)).map((t) => (
                <tr key={t} className="border-b border-gray-50">
                  <th className="px-4 py-2 text-xs font-bold text-gray-500">{MEAL_EMOJI[t]} {MEAL_LABEL[t]}</th>
                  {DAYS.map((d, di) => (
                    <td key={d} className="px-2 py-2"><select aria-label={`${d} ${MEAL_LABEL[t]}`} className="input px-2 py-1.5 text-xs" value={cells[`${di}:${t}`] ?? ''} onChange={(e) => set(`${di}:${t}`, e.target.value)}>
                      <option value="">—</option>
                      {recipes.data!.filter((r) => r.mealType.includes(t)).map((r) => <option key={r.id} value={r.id}>{r.name} ({ksh(r.cost)})</option>)}
                    </select></td>
                  ))}
                </tr>
              ))}
              <tr className="bg-forest-50/60 text-xs font-semibold"><th className="px-4 py-3 text-forest-800">Per person</th>{DAYS.map((_, i) => <td key={i} className="px-2 py-3">{ksh(dayCost(i))}</td>)}</tr>
            </tbody>
          </table>
        </div>
      )}
      <p className="mt-3 text-sm font-semibold text-forest">Estimated week: {ksh(total)} per person</p>
    </div>
  )
}
