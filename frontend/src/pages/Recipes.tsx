import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { AlertTriangle, ArrowLeft, Clock, Flame, Search } from 'lucide-react'
import RecipeCard from '../components/RecipeCard'
import { Empty, ErrorBox, Field, Modal, Spinner, Tag, useToast } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useApi, useDebounced } from '../lib/hooks'
import { isoDate, ksh, MEAL_LABEL, MEAL_TYPES } from '../lib/format'
import type { Recipe } from '../lib/types'

export function Recipes() {
  const [q, setQ] = useState('')
  const [meal, setMeal] = useState('')
  const [maxCost, setMaxCost] = useState('')
  const dq = useDebounced(q)
  const params = new URLSearchParams()
  if (dq.trim()) params.set('q', dq.trim())
  if (meal) params.set('meal_type', meal)
  if (maxCost) params.set('max_cost', maxCost)
  const { data, error, loading, reload } = useApi<Recipe[]>(`/public/recipes?${params.toString()}`)

  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl font-extrabold">Kenyan recipes</h1>
      <p className="mt-2 max-w-2xl text-gray-600">Costs are estimated per person; calories are per portion. No account needed to browse.</p>
      <div className="mt-6 grid gap-3 rounded-2xl bg-white p-4 shadow-soft sm:grid-cols-[1fr_180px_180px]">
        <div className="relative"><Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" /><input className="input pl-10" placeholder="Search recipes or ingredients (e.g. beans, omena)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search recipes" /></div>
        <select className="input" value={meal} onChange={(e) => setMeal(e.target.value)} aria-label="Meal type">
          <option value="">All meals</option>{MEAL_TYPES.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}
        </select>
        <select className="input" value={maxCost} onChange={(e) => setMaxCost(e.target.value)} aria-label="Maximum cost">
          <option value="">Any price</option><option value="50">Under KSh 50</option><option value="100">Under KSh 100</option><option value="150">Under KSh 150</option><option value="250">Under KSh 250</option>
        </select>
      </div>
      {loading && <Spinner />}
      {error && <div className="mt-6"><ErrorBox message={error} onRetry={reload} /></div>}
      {data && data.length === 0 && <div className="mt-8"><Empty title="No recipes match">Try a different search or price.</Empty></div>}
      <div className="mt-8 grid gap-5 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">{(data ?? []).map((r) => <RecipeCard key={r.id} r={r} />)}</div>
    </div>
  )
}

export function RecipeDetail() {
  const { id } = useParams()
  const { data: r, error, loading, reload } = useApi<Recipe>(`/public/recipes/${id}`)
  const { user } = useAuth()
  const toast = useToast()
  const [open, setOpen] = useState(false)
  const [type, setType] = useState('LUNCH')
  const [date, setDate] = useState(isoDate())
  const [portions, setPortions] = useState('1')
  const [cost, setCost] = useState('')
  const [busy, setBusy] = useState(false)

  if (loading) return <Spinner />
  if (error || !r) return <div className="container-x py-12"><ErrorBox message={error ?? 'Recipe not found'} onRetry={reload} /></div>

  const myAllergies = (user?.profile.allergies ?? '').toLowerCase().split(/[,;]/).map((s) => s.trim()).filter(Boolean)
  const clash = myAllergies.filter((a) => r.allergens.some((x) => x.toLowerCase().includes(a) || a.includes(x.toLowerCase())) || r.ingredients.some((i) => i.name.toLowerCase().includes(a)))
  const steps = r.steps.split('\n').map((s) => s.replace(/^\d+\.\s*/, '')).filter(Boolean)

  async function record() {
    setBusy(true)
    try {
      await api.post('/diary/meals', { date, mealType: type, recipeId: r!.id, portions: Number(portions) || 1, actualCost: cost ? Number(cost) : null })
      toast('Meal added to your diary')
      setOpen(false)
    } catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }

  return (
    <div className="container-x py-10">
      <Link to="/recipes" className="inline-flex items-center gap-1 text-sm font-semibold text-forest"><ArrowLeft className="h-4 w-4" /> All recipes</Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_380px]">
        <div>
          <div className="flex items-center gap-4"><span className="flex h-20 w-20 items-center justify-center rounded-3xl bg-forest-100 text-5xl">{r.emoji}</span>
            <div><h1 className="font-display text-3xl font-extrabold sm:text-4xl">{r.name}</h1>
            {r.ownerName && <p className="mt-1 text-sm text-gray-500">Shared by {r.ownerName}</p>}
              <div className="mt-2 flex flex-wrap gap-1.5">{r.tags.split(',').filter(Boolean).map((t) => <Tag key={t}>{t.trim()}</Tag>)}{r.mealType.split(',').map((m) => <Tag key={m} tone="gray">{MEAL_LABEL[m] ?? m}</Tag>)}</div></div></div>
          <p className="mt-5 text-gray-600">{r.description}</p>
          {clash.length > 0 && <div className="mt-4 flex gap-2 rounded-2xl bg-red-50 p-4 text-sm text-red-700"><AlertTriangle className="h-4 w-4 shrink-0" /> Contains something you listed as an allergy: {clash.join(', ')}.</div>}
          <h2 className="mt-8 font-display text-xl font-extrabold">Ingredients <span className="text-sm font-medium text-gray-400">(per person)</span></h2>
          <div className="card mt-3 divide-y divide-gray-100 p-0">
            {r.ingredients.map((i) => (
              <div key={i.foodId} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <span><span className="mr-2">{i.emoji}</span><b>{i.quantity}×</b> {i.name} <span className="text-gray-400">({i.servingDesc})</span></span>
                <span className="font-semibold text-forest">{ksh(i.cost)}</span>
              </div>
            ))}
          </div>
          <h2 className="mt-8 font-display text-xl font-extrabold">Method</h2>
          <ol className="mt-3 space-y-3">{steps.map((s, i) => <li key={i} className="flex gap-3"><span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-forest text-xs font-bold text-white">{i + 1}</span><span className="pt-0.5 text-gray-700">{s}</span></li>)}</ol>
        </div>
        <aside className="h-fit space-y-4 lg:sticky lg:top-24">
          <div className="card">
            <div className="grid grid-cols-3 gap-3 text-center">
              <div><div className="font-display text-xl font-extrabold text-forest">{ksh(r.cost)}</div><div className="text-xs text-gray-500">per person</div></div>
              <div><div className="flex items-center justify-center gap-1 font-display text-xl font-extrabold"><Flame className="h-4 w-4 text-sun" />{Math.round(r.calories)}</div><div className="text-xs text-gray-500">kcal</div></div>
              <div><div className="flex items-center justify-center gap-1 font-display text-xl font-extrabold"><Clock className="h-4 w-4 text-gray-400" />{r.prepMinutes}</div><div className="text-xs text-gray-500">minutes</div></div>
            </div>
            <div className="mt-5 grid grid-cols-4 gap-2 text-center text-xs">
              {[['Protein', r.protein], ['Carbs', r.carbs], ['Fat', r.fat], ['Fibre', r.fiber]].map(([l, v]) => (
                <div key={l as string} className="rounded-xl bg-forest-50 py-2"><div className="font-bold">{Math.round(v as number)} g</div><div className="text-gray-500">{l}</div></div>
              ))}
            </div>
            {r.allergens.length > 0 && <p className="mt-4 text-xs text-gray-500">Contains: {r.allergens.join(', ')}</p>}
            {user ? <button className="btn btn-primary mt-5 w-full" onClick={() => setOpen(true)}>Record this meal</button>
              : <Link to="/login" className="btn btn-primary mt-5 w-full" state={{ from: `/recipes/${r.id}` }}>Sign in to record this meal</Link>}
          </div>
        </aside>
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title={`Record: ${r.name}`}>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Meal"><select className="input" value={type} onChange={(e) => setType(e.target.value)}>{MEAL_TYPES.map((m) => <option key={m} value={m}>{MEAL_LABEL[m]}</option>)}</select></Field>
          <Field label="Date"><input type="date" className="input" value={date} max={isoDate()} onChange={(e) => setDate(e.target.value)} /></Field>
          <Field label="Portions eaten" hint="1 = one person's serving"><input className="input" type="number" min="0.5" step="0.5" value={portions} onChange={(e) => setPortions(e.target.value)} /></Field>
          <Field label="Actual cost (KSh)" hint="Optional. Leave blank to use the estimate."><input className="input" type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        </div>
        <button className="btn btn-primary mt-5 w-full" disabled={busy} onClick={record}>{busy ? 'Saving…' : 'Add to my diary'}</button>
      </Modal>
    </div>
  )
}
