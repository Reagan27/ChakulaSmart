import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Clock, Flame, Sparkles } from 'lucide-react'
import { Empty, ErrorBox, PageHeader, Spinner, Tabs, Tag, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useApi } from '../../lib/hooks'
import { isoDate, ksh, MEAL_LABEL, MEAL_TYPES } from '../../lib/format'

export function SuggestionCard({ s, mealType, onRecorded, compact }: { s: any; mealType: string; onRecorded?: () => void; compact?: boolean }) {
  const r = s.recipe
  const toast = useToast()
  const [busy, setBusy] = useState(false)
  async function record() {
    setBusy(true)
    try { await api.post('/diary/meals', { date: isoDate(), mealType, recipeId: r.id, portions: 1 }); toast(`${r.name} added to today's diary`); onRecorded?.() }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  return (
    <div className="card flex flex-col">
      <div className="flex items-start gap-3">
        <span className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-forest-100 text-3xl">{r.emoji}</span>
        <div className="min-w-0 flex-1">
          <h3 className="font-display font-extrabold leading-snug">{r.name}</h3>
          <div className="mt-1 flex flex-wrap items-center gap-x-3 text-xs text-gray-500">
            <span className="font-bold text-forest">{ksh(r.cost)} / person</span>
            <span className="flex items-center gap-1"><Flame className="h-3.5 w-3.5 text-sun" />{Math.round(r.calories)} kcal</span>
            <span className="flex items-center gap-1"><Clock className="h-3.5 w-3.5" />{r.prepMinutes} min</span>
          </div>
        </div>
      </div>
      {!compact && <p className="mt-3 text-sm text-gray-600">{r.description}</p>}
      <ul className="mt-3 flex flex-wrap gap-1.5">{s.reasons.slice(0, 3).map((x: string) => <Tag key={x}>{x}</Tag>)}</ul>
      <div className="mt-4 flex gap-2 pt-1">
        <Link to={`/recipes/${r.id}`} className="btn btn-ghost btn-sm flex-1">View recipe</Link>
        <button className="btn btn-primary btn-sm flex-1" disabled={busy} onClick={record}>{busy ? 'Saving…' : 'Record meal'}</button>
      </div>
    </div>
  )
}

export default function Suggestions() {
  const [type, setType] = useState<string>('')
  const { data, error, loading, reload } = useApi<any>(`/diary/suggestions?limit=6${type ? `&meal_type=${type}` : ''}`)
  const active = type || data?.meal_type || 'LUNCH'
  return (
    <div>
      <PageHeader title="Meal ideas" subtitle="Scored against what's left of today's budget, your goal, allergies and what you've eaten lately." />
      <Tabs tabs={[{ id: '', label: 'Next meal' }, ...MEAL_TYPES.map((m) => ({ id: m as string, label: MEAL_LABEL[m] }))]} value={type} onChange={setType} />
      {loading && <Spinner label="Finding meals" />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && <p className="mb-4 flex items-center gap-2 text-sm text-gray-600"><Sparkles className="h-4 w-4 text-sun" />Top picks for <b>{MEAL_LABEL[data.meal_type]}</b></p>}
      {data && data.suggestions.length === 0 && <Empty emoji="🤔" title="No recipes match your restrictions">Try loosening your allergies list in Account & plan.</Empty>}
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {(data?.suggestions ?? []).map((s: any) => <SuggestionCard key={s.recipe.id} s={s} mealType={active} onRecorded={reload} />)}
      </div>
    </div>
  )
}
