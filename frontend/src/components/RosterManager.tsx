import { useMemo, useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Download, Mail, Pencil, Plus, Search, Trash2, Upload } from 'lucide-react'
import { Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Tag, useToast } from './ui'
import { api } from '../lib/api'
import { useApi, useDebounced } from '../lib/hooks'
import { CSV_TEMPLATE, downloadText, parseCsv, type ImportRow } from '../lib/csv'
import { GOALS, timeAgo } from '../lib/format'
import type { RosterPerson } from '../lib/types'

type Kind = 'pro' | 'biz'
const CFG = {
  pro: { base: '/pro/roster', one: 'client', many: 'Clients', title: 'Clients', file: 'clients-template.csv',
    sub: 'Add, edit, import and invite your clients. They get an email with a personal link to create their account. You only see health data once they have joined or accepted.' },
  biz: { base: '/biz/customers', one: 'customer', many: 'Customers', title: 'Customers', file: 'customers-template.csv',
    sub: 'Keep your customer list here. Add or import people and they get an email with a link to join ChakulaSmart. You only ever see their name and contact details.' },
} as const

const STATUS: Record<string, { label: string; tone: 'green' | 'orange' | 'gray' | 'red' }> = {
  ACTIVE: { label: 'Connected', tone: 'green' },
  REGISTERED: { label: 'Joined', tone: 'green' },
  INVITED: { label: 'Invited · not joined', tone: 'orange' },
  PENDING: { label: 'Awaiting consent', tone: 'orange' },
  REVOKED: { label: 'Access ended', tone: 'gray' },
}
const blank = { fullName: '', email: '', phone: '', notes: '', goalNote: '' }

export default function RosterManager({ kind }: { kind: Kind }) {
  const c = CFG[kind]
  const toast = useToast()
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const [filter, setFilter] = useState<string>('ALL')
  const { data, error, loading, reload } = useApi<RosterPerson[]>(`${c.base}${dq.trim() ? `?q=${encodeURIComponent(dq.trim())}` : ''}`)
  const [form, setForm] = useState<typeof blank | null>(null)
  const [editing, setEditing] = useState<RosterPerson | null>(null)
  const [busy, setBusy] = useState(false)
  const [importing, setImporting] = useState(false)

  const shown = useMemo(() => (data ?? []).filter((p) => filter === 'ALL' || p.status === filter), [data, filter])
  const counts = useMemo(() => {
    const m: Record<string, number> = {}
    for (const p of data ?? []) m[p.status] = (m[p.status] ?? 0) + 1
    return m
  }, [data])

  function openNew() { setEditing(null); setForm({ ...blank }) }
  function openEdit(p: RosterPerson) { setEditing(p); setForm({ fullName: p.full_name, email: p.email, phone: p.phone ?? '', notes: p.notes ?? '', goalNote: p.goal_note ?? '' }) }
  async function save(e: FormEvent) {
    e.preventDefault(); if (!form) return
    setBusy(true)
    try {
      if (editing) { await api.put(`${c.base}/${editing.id}`, form); toast('Saved') }
      else { const r = await api.post<RosterPerson>(c.base, form); toast(r.status === 'INVITED' ? `Invitation emailed to ${r.email}` : `${r.full_name} already has an account. We emailed them to connect.`) }
      setForm(null); reload()
    } catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  async function remove(p: RosterPerson) {
    const extra = kind === 'pro' && p.client_id ? ' You will lose access to their data.' : ''
    if (!confirm(`Remove ${p.full_name} from your ${c.one} list?${extra} Their ChakulaSmart account is not deleted.`)) return
    try { await api.del(`${c.base}/${p.id}`); toast('Removed'); reload() } catch (e: any) { toast(e.message, 'err') }
  }
  async function resend(p: RosterPerson) {
    try { await api.post(`${c.base}/${p.id}/resend`); toast(`Email sent to ${p.email}`); reload() } catch (e: any) { toast(e.message, 'err') }
  }
  const set = (k: keyof typeof blank) => (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => setForm({ ...form!, [k]: e.target.value })

  return (
    <div>
      <PageHeader title={c.title} subtitle={c.sub}
        actions={<>
          <button className="btn btn-ghost" onClick={() => setImporting(true)}><Upload className="h-4 w-4" />Import</button>
          <button className="btn btn-primary" onClick={openNew}><Plus className="h-4 w-4" />Add {c.one}</button></>} />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search name, email or phone" aria-label="Search" value={q} onChange={(e) => setQ(e.target.value)} />
        </div>
        <div className="flex flex-wrap gap-1.5" role="group" aria-label="Filter by status">
          {['ALL', ...Object.keys(STATUS).filter((s) => kind === 'pro' ? s !== 'REGISTERED' : ['INVITED', 'REGISTERED'].includes(s))].map((s) => (
            <button key={s} onClick={() => setFilter(s)} aria-pressed={filter === s}
              className={`rounded-full px-3 py-1.5 text-xs font-semibold transition ${filter === s ? 'bg-forest text-white' : 'bg-white text-gray-600 ring-1 ring-gray-200 hover:bg-forest-50'}`}>
              {s === 'ALL' ? `All (${data?.length ?? 0})` : `${STATUS[s].label}${counts[s] ? ` (${counts[s]})` : ''}`}
            </button>))}
        </div>
      </div>

      {loading && !data && <Spinner />}{error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && (
        <Empty emoji={kind === 'pro' ? '🩺' : '🛒'} title={dq ? 'Nobody matches your search' : `No ${c.one}s yet`}>
          {dq ? 'Try a different name or email.' : <>Add someone with their email, or <button className="font-semibold text-forest underline" onClick={() => setImporting(true)}>import a CSV list</button>. They are emailed a link to join.</>}
        </Empty>)}
      {data && data.length > 0 && shown.length === 0 && <Empty emoji="🔎" title="Nothing in this view">Try another status filter.</Empty>}

      {shown.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[720px] text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500">
              <tr><th className="px-4 py-3">{c.one[0].toUpperCase() + c.one.slice(1)}</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">{kind === 'pro' ? 'Goal / progress' : 'Notes'}</th><th className="px-4 py-3 text-right">Actions</th></tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {shown.map((p) => {
                const st = STATUS[p.status] ?? STATUS.PENDING
                return (
                  <tr key={p.id} className="align-top">
                    <td className="px-4 py-3">
                      {kind === 'pro' && p.status === 'ACTIVE' && p.client_id
                        ? <Link to={`/pro/clients/${p.client_id}`} className="font-bold text-forest hover:underline">{p.full_name}</Link>
                        : <span className="font-bold">{p.full_name}</span>}
                      <div className="text-xs text-gray-500">{p.email}{p.phone ? ` · ${p.phone}` : ''}</div>
                    </td>
                    <td className="px-4 py-3">
                      <Tag tone={st.tone}>{st.label}</Tag>
                      {p.status === 'INVITED' && <div className="mt-1 text-xs text-gray-500">{p.invite_expired ? <span className="text-red-600">Link expired</span> : p.invited_at ? `Sent ${timeAgo(p.invited_at)}` : ''}</div>}
                    </td>
                    <td className="max-w-xs px-4 py-3 text-xs text-gray-600">
                      {kind === 'pro' ? (
                        p.status === 'ACTIVE'
                          ? <>Focus: <b>{GOALS[p.goal ?? ''] ?? p.goal ?? '·'}</b> · Meals (7d): <b>{p.meals_7d ?? 0}</b>{p.latest_weight ? <> · <b>{Number(p.latest_weight)} kg</b></> : null}</>
                          : p.goal_note ?? '·')
                        : p.notes || '·'}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex justify-end gap-1">
                        {(p.status === 'INVITED' || p.status === 'PENDING') && <button className="btn btn-ghost btn-sm" onClick={() => resend(p)} title="Send the email again"><Mail className="h-3.5 w-3.5" />{p.status === 'INVITED' ? 'Resend' : 'Remind'}</button>}
                        <button className="btn btn-ghost btn-sm" onClick={() => openEdit(p)} aria-label={`Edit ${p.full_name}`}><Pencil className="h-3.5 w-3.5" /></button>
                        <button className="btn btn-danger btn-sm" onClick={() => remove(p)} aria-label={`Remove ${p.full_name}`}><Trash2 className="h-3.5 w-3.5" /></button>
                      </div>
                    </td>
                  </tr>)
              })}
            </tbody>
          </table>
        </div>)}

      <Modal open={!!form} onClose={() => setForm(null)} title={editing ? `Edit ${editing.full_name}` : `Add a ${c.one}`}>
        {form && <form onSubmit={save} className="space-y-4">
          <Field label="Full name"><input className="input" required maxLength={150} value={form.fullName} onChange={set('fullName')} /></Field>
          <Field label="Email" hint={editing?.client_id ? 'Cannot be changed once they have an account.' : `We email ${c.one === 'client' ? 'your client' : 'your customer'} a personal link to join ChakulaSmart.`}>
            <input className="input" type="email" required disabled={!!editing?.client_id} value={form.email} onChange={set('email')} /></Field>
          <Field label="Phone (optional)"><input className="input" maxLength={40} value={form.phone} onChange={set('phone')} /></Field>
          {kind === 'pro' && <Field label="Goal for working together" hint="Visible to your client."><textarea className="input min-h-[70px]" maxLength={1000} value={form.goalNote} onChange={set('goalNote')} placeholder="e.g. Balanced family meals within KSh 600/day" /></Field>}
          <Field label="Private notes" hint="Only you can see these."><textarea className="input min-h-[70px]" maxLength={2000} value={form.notes} onChange={set('notes')} /></Field>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : editing ? 'Save changes' : 'Add and send invitation'}</button>
        </form>}
      </Modal>

      <ImportModal open={importing} onClose={() => setImporting(false)} base={c.base} one={c.one} file={c.file} onDone={reload} />
    </div>
  )
}

const EMAIL_RE = /^[^@\s]+@[^@\s]+\.[^@\s]+$/
interface ImportResult { total: number; invited: number; linked: number; skipped: number; invalid: number; results: { row: number; name: string; email: string; result: string; message: string }[] }

function ImportModal({ open, onClose, base, one, file, onDone }: { open: boolean; onClose: () => void; base: string; one: string; file: string; onDone: () => void }) {
  const toast = useToast()
  const [rows, setRows] = useState<ImportRow[]>([])
  const [text, setText] = useState('')
  const [busy, setBusy] = useState(false)
  const [res, setRes] = useState<ImportResult | null>(null)

  function load(t: string) { setText(t); setRows(parseCsv(t).slice(0, 2000)) }
  async function pick(f: File | undefined) { if (f) load(await f.text()) }
  function close() { setRows([]); setText(''); setRes(null); onClose() }
  const problem = (r: ImportRow) => !r.fullName.trim() ? 'Name missing' : !EMAIL_RE.test(r.email.trim()) ? 'Invalid email' : ''
  const good = rows.filter((r) => !problem(r)).length

  async function send() {
    setBusy(true)
    try { const r = await api.post<ImportResult>(`${base}/import`, { rows }); setRes(r); onDone(); toast(`${r.invited + r.linked} email${r.invited + r.linked === 1 ? '' : 's'} sent`) }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }

  return (
    <Modal open={open} onClose={close} title={`Import ${one}s`} wide>
      {res ? (
        <div className="space-y-4">
          <div className="grid gap-3 sm:grid-cols-4 text-center">
            <div className="card"><div className="font-display text-2xl font-extrabold text-forest">{res.invited}</div><div className="text-xs text-gray-500">Invited by email</div></div>
            <div className="card"><div className="font-display text-2xl font-extrabold text-forest">{res.linked}</div><div className="text-xs text-gray-500">Already on ChakulaSmart</div></div>
            <div className="card"><div className="font-display text-2xl font-extrabold text-sun-600">{res.skipped}</div><div className="text-xs text-gray-500">Skipped (duplicates)</div></div>
            <div className="card"><div className="font-display text-2xl font-extrabold text-red-600">{res.invalid}</div><div className="text-xs text-gray-500">Invalid</div></div>
          </div>
          {res.results.some((r) => r.result === 'SKIPPED' || r.result === 'INVALID') && (
            <div className="max-h-56 overflow-y-auto rounded-2xl bg-white ring-1 ring-gray-200">
              <table className="w-full text-left text-xs"><tbody className="divide-y divide-gray-100">
                {res.results.filter((r) => r.result === 'SKIPPED' || r.result === 'INVALID').map((r) => (
                  <tr key={r.row}><td className="px-3 py-2 text-gray-500">Row {r.row}</td><td className="px-3 py-2">{r.email || r.name}</td><td className="px-3 py-2 text-red-600">{r.message}</td></tr>))}
              </tbody></table>
            </div>)}
          <button className="btn btn-primary w-full" onClick={close}>Done</button>
        </div>
      ) : (
        <div className="space-y-4">
          <p className="text-sm text-gray-600">Upload a CSV with the columns <b>name, email</b> and optionally <b>phone, notes, goal</b>. Everyone is emailed a personal link to create their account (up to 500 at a time).</p>
          <div className="flex flex-wrap gap-2">
            <label className="btn btn-ghost cursor-pointer"><Upload className="h-4 w-4" />Choose CSV file
              <input type="file" accept=".csv,text/csv,text/plain" className="sr-only" onChange={(e) => pick(e.target.files?.[0])} /></label>
            <button type="button" className="btn btn-ghost" onClick={() => downloadText(file, CSV_TEMPLATE)}><Download className="h-4 w-4" />Download template</button>
          </div>
          <Field label="…or paste rows here"><textarea className="input min-h-[90px] font-mono text-xs" value={text} onChange={(e) => load(e.target.value)} placeholder={'name,email,phone\nWanjiku Kamau,wanjiku@example.com,0712345678'} /></Field>
          {rows.length > 0 && <>
            <div className="text-sm"><b>{good}</b> of {rows.length} rows are ready{rows.length - good > 0 && <span className="text-red-600"> · {rows.length - good} will be skipped</span>}</div>
            <div className="max-h-64 overflow-auto rounded-2xl bg-white ring-1 ring-gray-200">
              <table className="w-full min-w-[480px] text-left text-xs">
                <thead className="sticky top-0 bg-gray-50 text-gray-500"><tr><th className="px-3 py-2">#</th><th className="px-3 py-2">Name</th><th className="px-3 py-2">Email</th><th className="px-3 py-2">Phone</th><th className="px-3 py-2" /></tr></thead>
                <tbody className="divide-y divide-gray-100">
                  {rows.slice(0, 200).map((r, i) => { const p = problem(r); return (
                    <tr key={i} className={p ? 'bg-red-50' : ''}><td className="px-3 py-1.5 text-gray-400">{i + 1}</td><td className="px-3 py-1.5">{r.fullName}</td><td className="px-3 py-1.5">{r.email}</td><td className="px-3 py-1.5">{r.phone}</td><td className="px-3 py-1.5 text-red-600">{p}</td></tr>) })}
                </tbody>
              </table>
              {rows.length > 200 && <div className="px-3 py-2 text-xs text-gray-500">…and {rows.length - 200} more rows</div>}
            </div>
            <button className="btn btn-primary w-full" disabled={busy || good === 0} onClick={send}>{busy ? 'Sending invitations…' : `Import ${good} and send invitations`}</button>
          </>}
        </div>
      )}
    </Modal>
  )
}
