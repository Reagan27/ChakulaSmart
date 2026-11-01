import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Pencil, Plus, Trash2, X } from 'lucide-react'
import { Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Tabs, Tag, useToast } from '../components/ui'
import { api } from '../lib/api'
import { useApi } from '../lib/hooks'
import { ksh, MEAL_LABEL, MEAL_TYPES } from '../lib/format'
import type { Food, Recipe } from '../lib/types'

const CATS = ['Staples', 'Vegetables', 'Fruits', 'Proteins', 'Cereals & Legumes', 'Dairy & Eggs', 'Meat', 'Fish', 'Drinks', 'Snacks', 'Other']
const blankFood = { name: '', category: 'Other', emoji: '🍽️', servingDesc: '', calories: '', protein: '', carbs: '', fat: '', fiber: '', priceKes: '', allergens: '' }
const blankRecipe = { name: '', description: '', emoji: '🍲', mealTypes: ['LUNCH'] as string[], prepMinutes: '30', steps: '', tags: '', ingredients: [{ foodId: '' as number | '', quantity: '1' }] }

/** Create, edit and delete the foods and recipes you added. They appear in everyone's meal ideas, planner and shopping lists. */
export default function Library() {
  const mine = useApi<{ foods: any[]; recipes: Recipe[] }>('/library/mine')
  const allFoods = useApi<Food[]>('/public/foods')
  const toast = useToast()
  const [tab, setTab] = useState<'recipes' | 'foods'>('recipes')
  const [rf, setRf] = useState<typeof blankRecipe | null>(null)
  const [ff, setFf] = useState<typeof blankFood | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)
  const reloadAll = () => { mine.reload(); allFoods.reload() }
  const foodById = useMemo(() => new Map((allFoods.data ?? []).map((f) => [f.id, f])), [allFoods.data])

  const openRecipe = (r?: Recipe) => {
    setEditId(r?.id ?? null)
    setRf(r ? { name: r.name, description: r.description, emoji: r.emoji, mealTypes: r.mealType.split(','), prepMinutes: String(r.prepMinutes), steps: r.steps, tags: r.tags,
      ingredients: r.ingredients.map((i) => ({ foodId: i.foodId, quantity: String(i.quantity) })) } : { ...blankRecipe, ingredients: [{ foodId: '', quantity: '1' }] })
  }
  const openFood = (f?: any) => {
    setEditId(f?.id ?? null)
    setFf(f ? { name: f.name, category: f.category, emoji: f.emoji, servingDesc: f.serving_desc, calories: f.calories, protein: f.protein, carbs: f.carbs, fat: f.fat, fiber: f.fiber, priceKes: f.price_kes, allergens: f.allergens } : { ...blankFood })
  }
  async function saveRecipe(e: FormEvent) {
    e.preventDefault(); if (!rf) return
    setBusy(true)
    const body = { ...rf, prepMinutes: Number(rf.prepMinutes), ingredients: rf.ingredients.filter((i) => i.foodId !== '').map((i) => ({ foodId: Number(i.foodId), quantity: Number(i.quantity) })) }
    try { editId ? await api.put(`/library/recipes/${editId}`, body) : await api.post('/library/recipes', body); toast('Recipe saved. It is now available in meal plans.'); setRf(null); reloadAll() }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  async function saveFood(e: FormEvent) {
    e.preventDefault(); if (!ff) return
    setBusy(true)
    const n = (v: any) => Number(v || 0)
    const body = { ...ff, calories: n(ff.calories), protein: n(ff.protein), carbs: n(ff.carbs), fat: n(ff.fat), fiber: n(ff.fiber), priceKes: n(ff.priceKes) }
    try { editId ? await api.put(`/library/foods/${editId}`, body) : await api.post('/library/foods', body); toast('Food saved'); setFf(null); reloadAll() }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  async function remove(kind: 'recipes' | 'foods', id: number, name: string) {
    if (!confirm(`Delete "${name}"? If it is already used in plans or diaries it is hidden instead, so nobody's history breaks.`)) return
    try { await api.del(`/library/${kind}/${id}`); toast('Deleted'); reloadAll() } catch (e: any) { toast(e.message, 'err') }
  }

  // live totals for the recipe being edited
  const totals = useMemo(() => {
    let cost = 0, cal = 0, pro = 0
    for (const i of rf?.ingredients ?? []) { const f = i.foodId === '' ? null : foodById.get(Number(i.foodId)); const q = Number(i.quantity) || 0; if (f) { cost += q * f.price_kes; cal += q * f.calories; pro += q * f.protein } }
    return { cost, cal, pro }
  }, [rf, foodById])
  const setIng = (idx: number, k: 'foodId' | 'quantity', v: any) => setRf({ ...rf!, ingredients: rf!.ingredients.map((x, i) => i === idx ? { ...x, [k]: v } : x) })

  if (mine.loading && !mine.data) return <Spinner />
  if (mine.error || !mine.data) return <ErrorBox message={mine.error ?? 'Failed'} onRetry={mine.reload} />
  return (
    <div>
      <PageHeader title="Recipes & foods" subtitle="Add your own recipes and foods. Once saved, they appear in everyone's meal ideas, planner and shopping lists."
        actions={tab === 'recipes' ? <button className="btn btn-primary" onClick={() => openRecipe()}><Plus className="h-4 w-4" />New recipe</button> : <button className="btn btn-primary" onClick={() => openFood()}><Plus className="h-4 w-4" />New food</button>} />
      <Tabs tabs={[{ id: 'recipes', label: `Recipes (${mine.data.recipes.length})` }, { id: 'foods', label: `Foods (${mine.data.foods.length})` }]} value={tab} onChange={setTab} />

      {tab === 'recipes' && (mine.data.recipes.length === 0 ? <Empty emoji="🍲" title="No recipes yet">Create a recipe from foods in the library. Cost and nutrition are worked out for you. Missing an ingredient? <button className="font-semibold text-forest underline" onClick={() => { setTab('foods'); openFood() }}>Add the food first</button>.</Empty> : (
        <div className="grid gap-4 md:grid-cols-2">{mine.data.recipes.map((r) => (
          <div key={r.id} className="card">
            <div className="flex items-start justify-between gap-2"><div><h3 className="font-display font-extrabold">{r.emoji} {r.name}</h3><div className="text-xs text-gray-500">{r.mealType.split(',').map((m) => MEAL_LABEL[m]).join(', ')} · {r.prepMinutes} min</div></div>
              <Tag>{ksh(r.cost)}</Tag></div>
            <p className="mt-2 line-clamp-2 text-sm text-gray-600">{r.description}</p>
            <div className="mt-2 text-xs text-gray-500">{Math.round(r.calories)} kcal · {Math.round(r.protein)} g protein · {r.ingredients.length} ingredients{r.ownerName ? ` · by ${r.ownerName}` : ' · built-in'}</div>
            <div className="mt-3 flex gap-2"><Link to={`/recipes/${r.id}`} className="btn btn-ghost btn-sm">View</Link>
              <button className="btn btn-ghost btn-sm" onClick={() => openRecipe(r)}><Pencil className="h-3.5 w-3.5" />Edit</button>
              <button className="btn btn-danger btn-sm" onClick={() => remove('recipes', r.id, r.name)} aria-label={`Delete ${r.name}`}><Trash2 className="h-3.5 w-3.5" /></button></div>
          </div>))}</div>))}

      {tab === 'foods' && (mine.data.foods.length === 0 ? <Empty emoji="🥕" title="No foods yet">Add a food with its serving size, nutrition and price so it can be used in recipes.</Empty> : (
        <div className="card overflow-x-auto p-0"><table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">Food</th><th className="px-4 py-3">Serving</th><th className="px-4 py-3">kcal</th><th className="px-4 py-3">Protein</th><th className="px-4 py-3">Price</th><th className="px-4 py-3" /></tr></thead>
          <tbody className="divide-y divide-gray-100">{mine.data.foods.map((f) => (
            <tr key={f.id}><td className="px-4 py-2.5 font-semibold">{f.emoji} {f.name}<div className="text-xs font-normal text-gray-500">{f.category}</div></td><td className="px-4 py-2.5 text-xs">{f.serving_desc}</td><td className="px-4 py-2.5">{Number(f.calories)}</td><td className="px-4 py-2.5">{Number(f.protein)} g</td><td className="px-4 py-2.5">{ksh(f.price_kes)}</td>
              <td className="px-4 py-2.5"><div className="flex justify-end gap-1"><button className="btn btn-ghost btn-sm" onClick={() => openFood(f)} aria-label={`Edit ${f.name}`}><Pencil className="h-3.5 w-3.5" /></button>
                <button className="btn btn-danger btn-sm" onClick={() => remove('foods', f.id, f.name)} aria-label={`Delete ${f.name}`}><Trash2 className="h-3.5 w-3.5" /></button></div></td></tr>))}</tbody></table></div>))}

      <Modal wide open={!!rf} onClose={() => setRf(null)} title={editId ? 'Edit recipe' : 'New recipe'}>
        {rf && <form onSubmit={saveRecipe} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_90px]"><Field label="Recipe name"><input className="input" required maxLength={150} value={rf.name} onChange={(e) => setRf({ ...rf, name: e.target.value })} /></Field>
            <Field label="Emoji"><input className="input text-center" maxLength={8} value={rf.emoji} onChange={(e) => setRf({ ...rf, emoji: e.target.value })} /></Field></div>
          <Field label="Short description"><input className="input" maxLength={300} value={rf.description} onChange={(e) => setRf({ ...rf, description: e.target.value })} /></Field>
          <div><span className="label">Good for</span><div className="flex flex-wrap gap-2">{MEAL_TYPES.map((m) => { const on = rf.mealTypes.includes(m); return (
            <button type="button" key={m} aria-pressed={on} onClick={() => setRf({ ...rf, mealTypes: on ? rf.mealTypes.filter((x) => x !== m) : [...rf.mealTypes, m] })}
              className={`rounded-full px-3.5 py-1.5 text-sm font-semibold ${on ? 'bg-forest text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200'}`}>{MEAL_LABEL[m]}</button>) })}</div></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Preparation time (minutes)"><input className="input" type="number" min={1} max={1440} required value={rf.prepMinutes} onChange={(e) => setRf({ ...rf, prepMinutes: e.target.value })} /></Field>
            <Field label="Tags" hint="Comma separated, e.g. budget,vegetarian,high-protein"><input className="input" maxLength={200} value={rf.tags} onChange={(e) => setRf({ ...rf, tags: e.target.value })} /></Field></div>
          <div><span className="label">Ingredients (quantity = number of servings of the food)</span>
            <div className="space-y-2">{rf.ingredients.map((i, idx) => (
              <div key={idx} className="flex gap-2"><select className="input flex-1" required aria-label="Food" value={i.foodId} onChange={(e) => setIng(idx, 'foodId', e.target.value === '' ? '' : Number(e.target.value))}>
                <option value="">Choose a food…</option>{(allFoods.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.emoji} {f.name} ({f.serving_desc})</option>)}</select>
                <input className="input w-24" type="number" min={0.1} step={0.1} aria-label="Quantity" value={i.quantity} onChange={(e) => setIng(idx, 'quantity', e.target.value)} />
                <button type="button" className="rounded-full p-2 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Remove ingredient" disabled={rf.ingredients.length === 1} onClick={() => setRf({ ...rf, ingredients: rf.ingredients.filter((_, k) => k !== idx) })}><X className="h-4 w-4" /></button></div>))}</div>
            <button type="button" className="btn btn-ghost btn-sm mt-2" onClick={() => setRf({ ...rf, ingredients: [...rf.ingredients, { foodId: '', quantity: '1' }] })}><Plus className="h-3.5 w-3.5" />Add ingredient</button>
            <button type="button" className="ml-2 text-xs font-semibold text-forest underline" onClick={() => { setRf(null); setTab('foods'); openFood() }}>Food missing? Create it</button></div>
          <div className="rounded-xl bg-forest-50 p-3 text-sm">Per portion: <b>{ksh(totals.cost)}</b> · <b>{Math.round(totals.cal)}</b> kcal · <b>{Math.round(totals.pro)}</b> g protein <span className="text-xs text-gray-500">(calculated from the foods)</span></div>
          <Field label="Steps" hint="One step per line"><textarea className="input min-h-[120px]" required value={rf.steps} onChange={(e) => setRf({ ...rf, steps: e.target.value })} /></Field>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save recipe'}</button>
        </form>}
      </Modal>

      <Modal open={!!ff} onClose={() => setFf(null)} title={editId ? 'Edit food' : 'New food'}>
        {ff && <form onSubmit={saveFood} className="space-y-4">
          <div className="grid gap-4 sm:grid-cols-[1fr_90px]"><Field label="Food name"><input className="input" required maxLength={120} value={ff.name} onChange={(e) => setFf({ ...ff, name: e.target.value })} /></Field>
            <Field label="Emoji"><input className="input text-center" maxLength={8} value={ff.emoji} onChange={(e) => setFf({ ...ff, emoji: e.target.value })} /></Field></div>
          <div className="grid gap-4 sm:grid-cols-2"><Field label="Category"><select className="input" value={ff.category} onChange={(e) => setFf({ ...ff, category: e.target.value })}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="One serving is" hint="e.g. 1 plate (250 g)"><input className="input" required maxLength={80} value={ff.servingDesc} onChange={(e) => setFf({ ...ff, servingDesc: e.target.value })} /></Field></div>
          <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
            {([['calories', 'Calories (kcal)'], ['protein', 'Protein (g)'], ['carbs', 'Carbs (g)'], ['fat', 'Fat (g)'], ['fiber', 'Fibre (g)'], ['priceKes', 'Price per serving (KSh)']] as const).map(([k, l]) => (
              <Field key={k} label={l}><input className="input" type="number" min={0} step="0.1" required={k === 'calories' || k === 'priceKes'} value={(ff as any)[k]} onChange={(e) => setFf({ ...ff, [k]: e.target.value })} /></Field>))}</div>
          <Field label="Allergens" hint="Comma separated, e.g. milk, eggs, nuts"><input className="input" value={ff.allergens} onChange={(e) => setFf({ ...ff, allergens: e.target.value })} /></Field>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save food'}</button>
        </form>}
      </Modal>
    </div>
  )
}
