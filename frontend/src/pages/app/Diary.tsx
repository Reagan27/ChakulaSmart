import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { ChevronLeft, ChevronRight, Minus, Plus, Search, Trash2 } from 'lucide-react'
import { Empty, ErrorBox, Field, Macro, Modal, PageHeader, Ring, Spinner, Tabs, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useApi } from '../../lib/hooks'
import { addDays, isoDate, ksh, MEAL_EMOJI, MEAL_LABEL, MEAL_TYPES, prettyDate } from '../../lib/format'
import type { Food, Recipe } from '../../lib/types'

export function mealTitle(m: any): string {
  if (m.recipe_name) return m.recipe_name
  const names = (m.items ?? []).map((i: any) => i.name)
  return names.length ? names.join(', ') : 'Meal'
}

export function AddMealModal({ open, onClose, date, defaultType, onSaved }: {
  open: boolean; onClose: () => void; date: string; defaultType?: string; onSaved: () => void
}) {
  const toast = useToast()
  const foods = useApi<Food[]>(open ? '/public/foods' : null)
  const recipes = useApi<Recipe[]>(open ? '/public/recipes' : null)
  const [mode, setMode] = useState<'foods' | 'recipe'>('foods')
  const [type, setType] = useState(defaultType || 'LUNCH')
  const [q, setQ] = useState('')
  const [picked, setPicked] = useState<Record<number, number>>({})
  const [recipeId, setRecipeId] = useState<number | ''>('')
  const [portions, setPortions] = useState('1')
  const [cost, setCost] = useState('')
  const [notes, setNotes] = useState('')
  const [busy, setBusy] = useState(false)

  const list = useMemo(() => (foods.data ?? []).filter((f) => f.name.toLowerCase().includes(q.trim().toLowerCase())), [foods.data, q])
  const total = useMemo(() => (foods.data ?? []).reduce((s, f) => s + (picked[f.id] ?? 0) * Number(f.price_kes), 0), [foods.data, picked])
  const kcal = useMemo(() => (foods.data ?? []).reduce((s, f) => s + (picked[f.id] ?? 0) * Number(f.calories), 0), [foods.data, picked])
  const setQty = (id: number, v: number) => setPicked((p) => { const n = { ...p }; if (v <= 0) delete n[id]; else n[id] = Math.min(50, v); return n })
  const pickedCount = Object.keys(picked).length

  async function save() {
    setBusy(true)
    try {
      const body: any = { date, mealType: type, actualCost: cost ? Number(cost) : null, notes: notes || null }
      if (mode === 'recipe') { body.recipeId = recipeId; body.portions = Number(portions) || 1 }
      else body.items = Object.entries(picked).map(([id, s]) => ({ foodId: Number(id), servings: s }))
      await api.post('/diary/meals', body)
      toast('Meal recorded')
      setPicked({}); setRecipeId(''); setCost(''); setNotes(''); setQ('')
      onSaved(); onClose()
    } catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  const canSave = mode === 'recipe' ? recipeId !== '' : pickedCount > 0

  return (
    <Modal open={open} onClose={onClose} title={`Record a meal · ${prettyDate(date)}`} wide>
      <div className="mb-4 flex flex-wrap gap-2">
        {MEAL_TYPES.map((m) => (
          <button key={m} onClick={() => setType(m)} aria-pressed={type === m}
            className={`rounded-full px-4 py-1.5 text-sm font-semibold ring-1 ${type === m ? 'bg-forest text-white ring-forest' : 'bg-white ring-gray-200 text-gray-600'}`}>{MEAL_EMOJI[m]} {MEAL_LABEL[m]}</button>
        ))}
      </div>
      <Tabs tabs={[{ id: 'foods', label: 'Pick foods' }, { id: 'recipe', label: 'Use a recipe' }]} value={mode} onChange={setMode} />
      {mode === 'foods' ? (
        <div>
          <div className="relative"><Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" /><input className="input pl-10" placeholder="Search foods (ugali, chapati, tea…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search foods" /></div>
          {foods.loading && <Spinner />}
          <div className="mt-3 max-h-72 space-y-1 overflow-y-auto pr-1">
            {list.map((f) => {
              const n = picked[f.id] ?? 0
              return (
                <div key={f.id} className={`flex items-center gap-3 rounded-xl px-3 py-2 ${n ? 'bg-forest-50 ring-1 ring-forest-200' : 'hover:bg-gray-50'}`}>
                  <span className="text-2xl">{f.emoji}</span>
                  <div className="min-w-0 flex-1"><div className="truncate text-sm font-semibold">{f.name}</div><div className="text-xs text-gray-500">{f.serving_desc} · {Math.round(f.calories)} kcal · {ksh(f.price_kes)}</div></div>
                  <div className="flex items-center gap-1">
                    {n > 0 && <button className="rounded-full p-1.5 ring-1 ring-gray-200" aria-label={`Less ${f.name}`} onClick={() => setQty(f.id, n - 1)}><Minus className="h-3.5 w-3.5" /></button>}
                    {n > 0 && <span className="w-6 text-center text-sm font-bold">{n}</span>}
                    <button className="rounded-full bg-forest p-1.5 text-white" aria-label={`Add ${f.name}`} onClick={() => setQty(f.id, n + 1)}><Plus className="h-3.5 w-3.5" /></button>
                  </div>
                </div>
              )
            })}
            {!foods.loading && list.length === 0 && <p className="py-6 text-center text-sm text-gray-500">No foods found.</p>}
          </div>
          <div className="mt-3 flex justify-between rounded-xl bg-forest-50 px-4 py-2 text-sm"><span>{pickedCount} item{pickedCount === 1 ? '' : 's'}</span><span className="font-semibold">{Math.round(kcal)} kcal · est. {ksh(total)}</span></div>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
          <Field label="Recipe"><select className="input" value={recipeId} onChange={(e) => setRecipeId(e.target.value ? Number(e.target.value) : '')}>
            <option value="">Choose a recipe…</option>
            {(recipes.data ?? []).filter((r) => r.mealType.includes(type)).map((r) => <option key={r.id} value={r.id}>{r.emoji} {r.name} ({ksh(r.cost)})</option>)}
          </select></Field>
          <Field label="Portions" hint="Multiply for family"><input className="input" type="number" min="0.5" step="0.5" value={portions} onChange={(e) => setPortions(e.target.value)} /></Field>
        </div>
      )}
      <div className="mt-4 grid gap-4 sm:grid-cols-2">
        <Field label="What you actually paid (KSh)" hint="Optional. Overrides the estimate."><input className="input" type="number" min="0" value={cost} onChange={(e) => setCost(e.target.value)} /></Field>
        <Field label="Notes"><input className="input" value={notes} maxLength={250} onChange={(e) => setNotes(e.target.value)} /></Field>
      </div>
      <button className="btn btn-primary mt-5 w-full py-3" disabled={busy || !canSave} onClick={save}>{busy ? 'Saving…' : 'Save meal'}</button>
    </Modal>
  )
}

export default function Diary() {
  const [date, setDate] = useState(isoDate())
  const { data: day, error, loading, reload } = useApi<any>(`/diary/day?date=${date}`)
  const toast = useToast()
  const [open, setOpen] = useState<string | null>(null)

  async function remove(id: number) {
    try { await api.del(`/diary/meals/${id}`); toast('Meal removed'); reload() } catch (e: any) { toast(e.message, 'err') }
  }
  const isToday = date === isoDate()
  return (
    <div>
      <PageHeader title="Food diary" subtitle="Record what you eat and see your calories and spending update instantly."
        actions={<button className="btn btn-primary" onClick={() => setOpen('LUNCH')}><Plus className="h-4 w-4" />Record a meal</button>} />
      <div className="mb-6 flex items-center gap-2">
        <button className="btn btn-ghost btn-sm" onClick={() => setDate(addDays(date, -1))} aria-label="Previous day"><ChevronLeft className="h-4 w-4" /></button>
        <input type="date" className="input w-auto" value={date} max={isoDate()} onChange={(e) => e.target.value && setDate(e.target.value)} aria-label="Date" />
        <button className="btn btn-ghost btn-sm" disabled={isToday} onClick={() => setDate(addDays(date, 1))} aria-label="Next day"><ChevronRight className="h-4 w-4" /></button>
        {!isToday && <button className="btn btn-ghost btn-sm" onClick={() => setDate(isoDate())}>Today</button>}
      </div>
      {loading && !day && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {day && (
        <div className="grid gap-6 lg:grid-cols-[1fr_320px]">
          <div className="space-y-4">
            {MEAL_TYPES.map((t) => {
              const meals = day.meals.filter((m: any) => m.meal_type === t)
              return (
                <div key={t} className="card">
                  <div className="flex items-center justify-between">
                    <h3 className="font-display text-lg font-extrabold">{MEAL_EMOJI[t]} {MEAL_LABEL[t]}</h3>
                    <button className="btn btn-ghost btn-sm" onClick={() => setOpen(t)}><Plus className="h-3.5 w-3.5" />Add</button>
                  </div>
                  {meals.length === 0 ? <p className="mt-2 text-sm text-gray-400">Not recorded yet</p> : (
                    <div className="mt-3 divide-y divide-gray-100">
                      {meals.map((m: any) => (
                        <div key={m.id} className="flex items-start justify-between gap-3 py-3">
                          <div className="min-w-0">
                            <div className="text-sm font-bold">{m.recipe_id ? <Link className="hover:text-forest" to={`/recipes/${m.recipe_id}`}>{m.recipe_emoji} {m.recipe_name}</Link> : mealTitle(m)}</div>
                            <div className="mt-0.5 text-xs text-gray-500">{Math.round(m.calories)} kcal · {Math.round(m.protein)} g protein</div>
                            {!m.recipe_id && m.items.length > 0 && <div className="mt-1 text-xs text-gray-400">{m.items.map((i: any) => `${Number(i.servings)}× ${i.name}`).join(' · ')}</div>}
                            {m.notes && <div className="mt-1 text-xs italic text-gray-400">“{m.notes}”</div>}
                          </div>
                          <div className="flex shrink-0 items-center gap-2">
                            <span className="text-sm font-bold text-forest">{ksh(m.cost)}</span>
                            <button className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete meal" onClick={() => remove(m.id)}><Trash2 className="h-4 w-4" /></button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )
            })}
          </div>
          <aside className="space-y-4 lg:sticky lg:top-6 lg:h-fit">
            <div className="card flex flex-col items-center gap-4">
              <Ring value={day.totals.calories} max={day.calorie_target} label={Math.round(day.totals.calories)} sub={`of ${Math.round(day.calorie_target)} kcal`} />
              <div className="w-full space-y-3">
                <Macro label="Protein" value={day.totals.protein} max={day.calorie_target * 0.2 / 4} color="#166534" />
                <Macro label="Carbs" value={day.totals.carbs} max={day.calorie_target * 0.55 / 4} color="#F59E0B" />
                <Macro label="Fat" value={day.totals.fat} max={day.calorie_target * 0.25 / 9} color="#0EA5E9" />
              </div>
            </div>
            <div className="card">
              <div className="label">Food budget</div>
              <div className="flex items-end justify-between"><span className="font-display text-2xl font-extrabold">{ksh(day.budget.spent)}</span><span className="text-sm text-gray-500">of {ksh(day.budget.daily)}</span></div>
              <div className="mt-2 h-2.5 overflow-hidden rounded-full bg-forest-100"><div className={`h-full rounded-full ${day.budget.remaining < 0 ? 'bg-red-500' : 'bg-forest'}`} style={{ width: `${Math.min(100, day.budget.daily ? (day.budget.spent / day.budget.daily) * 100 : 0)}%` }} /></div>
              <div className={`mt-2 text-sm font-semibold ${day.budget.remaining < 0 ? 'text-red-600' : 'text-forest'}`}>{day.budget.remaining < 0 ? `${ksh(-day.budget.remaining)} over budget` : `${ksh(day.budget.remaining)} remaining`}</div>
            </div>
          </aside>
        </div>
      )}
      {day && <AddMealModal open={open !== null} onClose={() => setOpen(null)} date={date} defaultType={open ?? 'LUNCH'} onSaved={reload} />}
      {day && day.meals.length === 0 && <div className="mt-6"><Empty emoji="🍽️" title="Nothing recorded for this day">Tap “Record a meal” to start.</Empty></div>}
    </div>
  )
}
