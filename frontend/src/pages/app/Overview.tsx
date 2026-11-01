import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ArrowRight, HeartHandshake, Plus } from 'lucide-react'
import { Greeting } from '../../components/DashboardLayout'
import { ErrorBox, Macro, PageHeader, Ring, Spinner, Stat } from '../../components/ui'
import { useApi } from '../../lib/hooks'
import { isoDate, ksh, MEAL_EMOJI, MEAL_LABEL, MEAL_TYPES, shortDate } from '../../lib/format'
import { AddMealModal, mealTitle } from './Diary'
import { SuggestionCard } from './Suggestions'
import { useAuth } from '../../lib/auth'

export default function Overview() {
  const { user } = useAuth()
  const today = isoDate()
  const day = useApi<any>(`/diary/day?date=${today}`)
  const sug = useApi<any>('/diary/suggestions?limit=3')
  const hist = useApi<any>('/diary/history?days=7')
  const reqs = useApi<any[]>('/care/requests')
  const [open, setOpen] = useState(false)

  if (day.loading && !day.data) return <Spinner />
  if (day.error) return <ErrorBox message={day.error} onRetry={day.reload} />
  const d = day.data
  const refresh = () => { day.reload(); sug.reload(); hist.reload() }
  const top = sug.data?.suggestions?.[0]

  return (
    <div>
      <PageHeader title={`${'👋'} ${new Date().getHours() < 12 ? 'Good morning' : new Date().getHours() < 17 ? 'Good afternoon' : 'Good evening'}, ${user?.full_name.split(' ')[0]}`}
        subtitle="Here's how today is going."
        actions={<button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />Record a meal</button>} />
      <span className="hidden"><Greeting /></span>

      {(reqs.data?.length ?? 0) > 0 && (
        <Link to="/app/care" className="mb-6 flex items-center gap-3 rounded-2xl bg-sun-100 p-4 text-sm font-semibold text-ink ring-1 ring-sun/30 transition hover:ring-sun">
          <HeartHandshake className="h-5 w-5 text-sun-600" />
          {reqs.data!.length} nutritionist request{reqs.data!.length > 1 ? 's' : ''} waiting for your response
          <ArrowRight className="ml-auto h-4 w-4" />
        </Link>
      )}

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Meals recorded" value={`${d.meals.length} / ${d.meals_per_day}`} sub="today" />
        <Stat label="Daily food budget" value={ksh(d.budget.daily)} sub="for your household" />
        <Stat label="Spent so far" value={ksh(d.budget.spent)} sub="estimated or actual" tone={d.budget.remaining < 0 ? 'bad' : 'default'} />
        <Stat label="Remaining" value={ksh(Math.max(0, d.budget.remaining))} tone={d.budget.remaining < 0 ? 'bad' : d.budget.remaining < d.budget.daily * 0.2 ? 'warn' : 'good'}
          sub={d.budget.remaining < 0 ? `${ksh(-d.budget.remaining)} over` : 'left to spend'} />
      </div>

      <div className="mt-6 grid gap-6 lg:grid-cols-[1.4fr_1fr]">
        <div className="space-y-6">
          <section>
            <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold">Your next meal</h2><Link to="/app/suggestions" className="text-sm font-semibold text-forest">More ideas →</Link></div>
            {sug.loading ? <Spinner label="Finding a meal" /> : top ? <SuggestionCard s={top} mealType={sug.data.meal_type} onRecorded={refresh} />
              : <div className="card text-sm text-gray-500">No suggestions right now. Check your allergies in Account & plan.</div>}
          </section>
          <section className="card">
            <div className="mb-3 flex items-center justify-between"><h2 className="font-display text-xl font-extrabold">Spending, last 7 days</h2><Link to="/app/budget" className="text-sm font-semibold text-forest">Details →</Link></div>
            {hist.data && (
              <div className="h-52">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={hist.data.days.map((x: any) => ({ ...x, label: shortDate(x.date) }))} margin={{ left: -16, right: 4, top: 8 }}>
                    <CartesianGrid vertical={false} stroke="#E5E7EB" />
                    <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
                    <YAxis tickLine={false} axisLine={false} fontSize={11} />
                    <Tooltip formatter={(v: number) => ksh(v)} cursor={{ fill: '#F0FDF4' }} />
                    <ReferenceLine y={hist.data.daily_budget} stroke="#F59E0B" strokeDasharray="4 4" label={{ value: 'Budget', fontSize: 10, fill: '#D97706', position: 'insideTopRight' }} />
                    <Bar dataKey="spend" radius={[6, 6, 0, 0]}>{hist.data.days.map((x: any, i: number) => <Cell key={i} fill={x.over_budget ? '#DC2626' : '#166534'} />)}</Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </section>
        </div>
        <div className="space-y-6">
          <section className="card">
            <div className="flex items-center gap-5">
              <Ring value={d.totals.calories} max={d.calorie_target} size={116} label={Math.round(d.totals.calories)} sub={`/ ${Math.round(d.calorie_target)} kcal`} />
              <div className="flex-1 space-y-2.5">
                <Macro label="Protein" value={d.totals.protein} max={d.calorie_target * 0.2 / 4} color="#166534" />
                <Macro label="Carbs" value={d.totals.carbs} max={d.calorie_target * 0.55 / 4} color="#F59E0B" />
                <Macro label="Fat" value={d.totals.fat} max={d.calorie_target * 0.25 / 9} color="#0EA5E9" />
              </div>
            </div>
          </section>
          <section className="card">
            <div className="mb-2 flex items-center justify-between"><h2 className="font-display text-lg font-extrabold">Today's food diary</h2><Link to="/app/diary" className="text-sm font-semibold text-forest">Open →</Link></div>
            <ul className="divide-y divide-gray-100">
              {MEAL_TYPES.filter((t) => t !== 'SNACK' || d.meals.some((m: any) => m.meal_type === 'SNACK')).map((t) => {
                const ms = d.meals.filter((m: any) => m.meal_type === t)
                return (
                  <li key={t} className="flex items-start justify-between gap-3 py-2.5 text-sm">
                    <span className="w-24 shrink-0 font-semibold text-gray-600">{MEAL_EMOJI[t]} {MEAL_LABEL[t]}</span>
                    <span className={`flex-1 text-right ${ms.length ? '' : 'text-gray-400'}`}>{ms.length ? ms.map(mealTitle).join(' + ') : 'Not recorded yet'}</span>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>
      </div>
      <AddMealModal open={open} onClose={() => setOpen(false)} date={today} defaultType={sug.data?.meal_type} onSaved={refresh} />
    </div>
  )
}
