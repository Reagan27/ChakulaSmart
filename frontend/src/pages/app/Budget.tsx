import { useState, type FormEvent } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, Line, LineChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { ErrorBox, PageHeader, Spinner, Stat, Tabs, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useAuth } from '../../lib/auth'
import { useApi } from '../../lib/hooks'
import { isoDate, ksh, prettyDate, shortDate } from '../../lib/format'
import { ProfileForm } from './Account'

export function Budget() {
  const [days, setDays] = useState('14')
  const { data, error, loading, reload } = useApi<any>(`/diary/history?days=${days}`)
  const { user } = useAuth()
  const [edit, setEdit] = useState(false)
  return (
    <div>
      <PageHeader title="Food budget" subtitle="Your spending history against your daily budget."
        actions={<button className="btn btn-ghost" onClick={() => setEdit((e) => !e)}>{edit ? 'Close' : 'Change budget'}</button>} />
      {edit && user && <div className="card mb-6"><ProfileForm initial={user.profile} submitLabel="Save budget" onDone={() => { setEdit(false); reload() }} /></div>}
      <Tabs tabs={[{ id: '7', label: '7 days' }, { id: '14', label: '14 days' }, { id: '30', label: '30 days' }, { id: '90', label: '90 days' }]} value={days} onChange={setDays} />
      {loading && !data && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && (
        <>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <Stat label="Total spent" value={ksh(data.total_spend)} sub={`over ${days} days`} />
            <Stat label="Average per tracked day" value={ksh(data.average_spend)} tone={data.average_spend > data.daily_budget ? 'bad' : 'good'} />
            <Stat label="Daily budget" value={ksh(data.daily_budget)} />
            <Stat label="Days tracked" value={`${data.days_tracked} / ${days}`} sub={`${data.days.filter((d: any) => d.over_budget).length} over budget`} />
          </div>
          <div className="card mt-6">
            <h2 className="mb-3 font-display text-lg font-extrabold">Daily spending</h2>
            <div className="h-72"><ResponsiveContainer width="100%" height="100%">
              <BarChart data={data.days.map((d: any) => ({ ...d, label: shortDate(d.date) }))} margin={{ left: -12, right: 8, top: 8 }}>
                <CartesianGrid vertical={false} stroke="#E5E7EB" />
                <XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
                <YAxis tickLine={false} axisLine={false} fontSize={11} />
                <Tooltip formatter={(v: number) => ksh(v)} cursor={{ fill: '#F0FDF4' }} />
                <ReferenceLine y={data.daily_budget} stroke="#F59E0B" strokeDasharray="4 4" />
                <Bar dataKey="spend" radius={[5, 5, 0, 0]}>{data.days.map((d: any, i: number) => <Cell key={i} fill={d.over_budget ? '#DC2626' : '#166534'} />)}</Bar>
              </BarChart></ResponsiveContainer></div>
            <p className="mt-2 text-xs text-gray-500">Red bars went over budget. The dashed line is your daily budget.</p>
          </div>
        </>
      )}
    </div>
  )
}

export function Progress() {
  const { data, error, loading, reload } = useApi<any[]>('/diary/weight')
  const hist = useApi<any>('/diary/history?days=14')
  const toast = useToast()
  const [kg, setKg] = useState('')
  const [date, setDate] = useState(isoDate())
  const [busy, setBusy] = useState(false)
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    try { await api.post('/diary/weight', { loggedOn: date, weightKg: Number(kg) }); setKg(''); toast('Weight saved'); reload() }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  const pts = (data ?? []).map((w) => ({ label: shortDate(String(w.logged_on)), kg: Number(w.weight_kg) }))
  const change = pts.length > 1 ? pts[pts.length - 1].kg - pts[0].kg : 0
  return (
    <div>
      <PageHeader title="Progress" subtitle="Log your weight and watch the trend. Your nutritionist sees this only if you've shared access." />
      <div className="grid gap-4 sm:grid-cols-3">
        <Stat label="Latest weight" value={pts.length ? `${pts[pts.length - 1].kg} kg` : '·'} />
        <Stat label="Change since first log" value={pts.length > 1 ? `${change > 0 ? '+' : ''}${change.toFixed(1)} kg` : '·'} />
        <Stat label="Entries" value={pts.length} />
      </div>
      <div className="mt-6 grid gap-6 lg:grid-cols-[1fr_300px]">
        <div className="card"><h2 className="mb-3 font-display text-lg font-extrabold">Weight trend</h2>
          {loading ? <Spinner /> : error ? <ErrorBox message={error} onRetry={reload} /> : pts.length < 2 ? <p className="py-10 text-center text-sm text-gray-500">Log at least two weights to see a trend.</p> : (
            <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={pts} margin={{ left: -12, right: 8, top: 8 }}>
              <CartesianGrid vertical={false} stroke="#E5E7EB" /><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis domain={['dataMin - 1', 'dataMax + 1']} tickLine={false} axisLine={false} fontSize={11} /><Tooltip formatter={(v: number) => `${v} kg`} />
              <Line type="monotone" dataKey="kg" stroke="#166534" strokeWidth={3} dot={{ r: 4, fill: '#166534' }} /></LineChart></ResponsiveContainer></div>)}
        </div>
        <form onSubmit={save} className="card h-fit space-y-4"><h2 className="font-display text-lg font-extrabold">Log weight</h2>
          <div><label className="label">Date</label><input className="input" type="date" max={isoDate()} value={date} onChange={(e) => setDate(e.target.value)} /></div>
          <div><label className="label">Weight (kg)</label><input className="input" type="number" step="0.1" min="20" max="400" required value={kg} onChange={(e) => setKg(e.target.value)} /></div>
          <button className="btn btn-primary w-full" disabled={busy}>Save</button></form>
      </div>
      {hist.data && <div className="card mt-6"><h2 className="mb-3 font-display text-lg font-extrabold">Calories & protein, last 14 days</h2>
        <div className="h-64"><ResponsiveContainer width="100%" height="100%"><LineChart data={hist.data.days.map((d: any) => ({ ...d, label: shortDate(d.date) }))} margin={{ left: -12, right: 8, top: 8 }}>
          <CartesianGrid vertical={false} stroke="#E5E7EB" /><XAxis dataKey="label" tickLine={false} axisLine={false} fontSize={11} interval="preserveStartEnd" />
          <YAxis yAxisId="c" tickLine={false} axisLine={false} fontSize={11} /><YAxis yAxisId="p" orientation="right" tickLine={false} axisLine={false} fontSize={11} /><Tooltip />
          <Line yAxisId="c" type="monotone" dataKey="calories" name="Calories" stroke="#F59E0B" strokeWidth={2.5} dot={false} />
          <Line yAxisId="p" type="monotone" dataKey="protein" name="Protein (g)" stroke="#166534" strokeWidth={2.5} dot={false} /></LineChart></ResponsiveContainer></div></div>}
      <span className="hidden">{prettyDate(date)}</span>
    </div>
  )
}
