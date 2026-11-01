import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Ban, BadgeCheck, Check, Clock, KeyRound, Mail, Plus, Search, ShieldCheck, Trash2, UserCheck, Users, X } from 'lucide-react'
import { Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Stat, Tabs, Tag, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useApi, useDebounced } from '../../lib/hooks'
import { timeAgo } from '../../lib/format'
import { useAuth } from '../../lib/auth'

const ROLE_LABEL: Record<string, string> = { INDIVIDUAL: 'Individual', NUTRITIONIST: 'Nutritionist', BUSINESS: 'Business', ADMIN: 'Admin' }

export function AdminOverview() {
  const { data, error, loading, reload } = useApi<any>('/admin/overview')
  if (loading && !data) return <Spinner />
  if (error || !data) return <ErrorBox message={error ?? 'Failed'} onRetry={reload} />
  const pending = data.pending_nutritionists + data.pending_businesses
  return (
    <div>
      <PageHeader title="Administration" subtitle="Approve professionals and businesses, and look after accounts."
        actions={<Link to="/admin/approvals" className="btn btn-primary"><BadgeCheck className="h-4 w-4" />Review applications{pending > 0 ? ` (${pending})` : ''}</Link>} />
      {pending > 0 && <Link to="/admin/approvals" className="mb-5 flex items-center gap-3 rounded-2xl bg-sun-100 p-4 text-sm font-semibold text-sun-600"><Clock className="h-5 w-5" />{pending} application{pending === 1 ? '' : 's'} waiting for your decision</Link>}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Active accounts" value={data.users} sub={`${data.new_users_7d} joined in the last 7 days`} icon={<Users className="h-4 w-4" />} />
        <Stat label="Nutritionists" value={data.nutritionists} tone="good" sub={`${data.pending_nutritionists} pending`} />
        <Stat label="Food businesses" value={data.businesses} tone="good" sub={`${data.pending_businesses} pending`} />
        <Stat label="Suspended" value={data.suspended} tone={data.suspended > 0 ? 'warn' : 'default'} />
      </div>
      {data.emails_failed_7d > 0 && <div className="mt-4"><ErrorBox message={`${data.emails_failed_7d} email${data.emails_failed_7d === 1 ? '' : 's'} failed to send in the last 7 days. Check the Emails tab and your mail settings.`} /></div>}
      <h2 className="mb-3 mt-8 font-display text-xl font-extrabold">Recent admin activity</h2>
      {data.recent_actions.length === 0 ? <Empty emoji="📋" title="Nothing yet">Approvals, suspensions and other admin actions appear here.</Empty> : (
        <div className="card divide-y divide-gray-100">
          {data.recent_actions.map((a: any) => (
            <div key={a.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5 text-sm">
              <span><b>{a.admin_name ?? 'An admin'}</b> · {a.action.replace(/_/g, ' ').toLowerCase()}{a.target_name ? <> · {a.target_name}</> : null}{a.detail ? <span className="text-gray-500"> ({a.detail})</span> : null}</span>
              <span className="text-xs text-gray-500">{timeAgo(String(a.created_at))}</span>
            </div>))}
        </div>)}
    </div>
  )
}

export function AdminApprovals() {
  const [tab, setTab] = useState<'PENDING' | 'APPROVED' | 'REJECTED'>('PENDING')
  const { data, error, loading, reload } = useApi<any[]>(`/admin/approvals?status=${tab}`)
  const toast = useToast()
  const [rejecting, setRejecting] = useState<any | null>(null)
  const [note, setNote] = useState('')
  const [busy, setBusy] = useState('')
  const key = (a: any) => `${a.user_id}-${a.role}`

  async function approve(a: any) {
    setBusy(key(a))
    try { await api.post(`/admin/approvals/${a.user_id}/${a.role}/approve`); toast(`${a.full_name} approved and notified by email`); reload() }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy('') }
  }
  async function reject(e: FormEvent) {
    e.preventDefault(); if (!rejecting) return
    setBusy(key(rejecting))
    try { await api.post(`/admin/approvals/${rejecting.user_id}/${rejecting.role}/reject`, { note }); toast('Application declined and the applicant was notified'); setRejecting(null); setNote(''); reload() }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy('') }
  }
  return (
    <div>
      <PageHeader title="Approvals" subtitle="Nutritionists and food businesses cannot sign in or appear in the directory until you approve them." />
      <Tabs tabs={[{ id: 'PENDING', label: 'Waiting' }, { id: 'APPROVED', label: 'Approved' }, { id: 'REJECTED', label: 'Declined' }]} value={tab} onChange={setTab} />
      {loading && !data && <Spinner />}{error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && <Empty emoji={tab === 'PENDING' ? '🎉' : '📭'} title={tab === 'PENDING' ? 'All caught up' : 'Nothing here'}>{tab === 'PENDING' ? 'No applications are waiting.' : 'No applications in this list.'}</Empty>}
      <div className="grid gap-4 lg:grid-cols-2">
        {(data ?? []).map((a) => (
          <div key={key(a)} className="card">
            <div className="flex items-start justify-between gap-2">
              <div>
                <h3 className="font-display text-lg font-extrabold">{a.role === 'BUSINESS' ? (a.business_name ?? a.full_name) : a.full_name}</h3>
                <div className="text-xs text-gray-500">{a.role === 'BUSINESS' ? <>Contact: {a.full_name} · </> : null}{a.email}{a.phone ? ` · ${a.phone}` : ''}</div>
              </div>
              <Tag tone={a.role === 'NUTRITIONIST' ? 'green' : 'orange'}>{ROLE_LABEL[a.role]}</Tag>
            </div>
            <dl className="mt-3 space-y-1.5 text-sm">
              <div><dt className="inline font-semibold">{a.role === 'NUTRITIONIST' ? 'Licence / registration: ' : 'Registration / PIN: '}</dt><dd className="inline">{a.application_note || <span className="text-gray-400">not provided</span>}</dd></div>
              {a.role === 'NUTRITIONIST' && <div><dt className="inline font-semibold">Specialisation: </dt><dd className="inline">{a.specialization || '·'}</dd></div>}
              {a.role === 'BUSINESS' && <div><dt className="inline font-semibold">Category: </dt><dd className="inline">{a.business_category || '·'}{a.business_city ? ` · ${a.business_city}` : ''}</dd></div>}
              <div className="text-xs text-gray-500">Applied {timeAgo(String(a.requested_at))}{a.account_status === 'PENDING' ? ' · new account' : ' · existing account'}</div>
              {a.status !== 'PENDING' && <div className="text-xs text-gray-500">{a.status === 'APPROVED' ? 'Approved' : 'Declined'} {a.reviewed_at ? timeAgo(String(a.reviewed_at)) : ''}{a.reviewed_by_name ? ` by ${a.reviewed_by_name}` : ''}{a.review_note ? ` · ${a.review_note}` : ''}</div>}
            </dl>
            {a.status === 'PENDING' && (
              <div className="mt-4 flex gap-2">
                <button className="btn btn-primary flex-1" disabled={busy === key(a)} onClick={() => approve(a)}><Check className="h-4 w-4" />Approve</button>
                <button className="btn btn-danger flex-1" disabled={busy === key(a)} onClick={() => { setRejecting(a); setNote('') }}><X className="h-4 w-4" />Decline</button>
              </div>)}
            {a.status === 'REJECTED' && <div className="mt-4"><button className="btn btn-ghost w-full" disabled={busy === key(a)} onClick={() => approve(a)}><Check className="h-4 w-4" />Approve after all</button></div>}
          </div>))}
      </div>
      <Modal open={!!rejecting} onClose={() => setRejecting(null)} title="Decline application">
        <form onSubmit={reject} className="space-y-4">
          <p className="text-sm text-gray-600">{rejecting?.full_name} will be told by email. Add a short reason so they know what to fix.</p>
          <Field label="Reason (shown to the applicant)"><textarea className="input min-h-[90px]" maxLength={300} value={note} onChange={(e) => setNote(e.target.value)} placeholder="e.g. We could not verify your licence number." /></Field>
          <button className="btn btn-danger w-full" disabled={!!busy}>Decline application</button>
        </form>
      </Modal>
    </div>
  )
}

const STATUS_TONE: Record<string, 'green' | 'orange' | 'gray' | 'red'> = { ACTIVE: 'green', PENDING: 'orange', SUSPENDED: 'red', REJECTED: 'gray' }

export function AdminUsers() {
  const { user: me } = useAuth()
  const toast = useToast()
  const [q, setQ] = useState('')
  const dq = useDebounced(q, 250)
  const [role, setRole] = useState('')
  const [status, setStatus] = useState('')
  const params = new URLSearchParams()
  if (dq.trim()) params.set('q', dq.trim())
  if (role) params.set('role', role)
  if (status) params.set('status', status)
  const { data, error, loading, reload } = useApi<any[]>(`/admin/users?${params}`)
  const [suspending, setSuspending] = useState<any | null>(null)
  const [reason, setReason] = useState('')
  const [addingAdmin, setAddingAdmin] = useState(false)
  const [adm, setAdm] = useState({ fullName: '', email: '' })
  const [busy, setBusy] = useState(false)

  async function run(fn: () => Promise<any>, ok: string) {
    try { const r = await fn(); toast(r?.message ?? ok); reload() } catch (e: any) { toast(e.message, 'err') }
  }
  async function suspend(e: FormEvent) {
    e.preventDefault(); if (!suspending) return
    setBusy(true)
    await run(() => api.post(`/admin/users/${suspending.id}/suspend`, { note: reason }), 'Account suspended')
    setBusy(false); setSuspending(null); setReason('')
  }
  async function addAdmin(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    await run(() => api.post('/admin/admins', adm), 'Administrator invited')
    setBusy(false); setAddingAdmin(false); setAdm({ fullName: '', email: '' })
  }
  const isAdmin = (u: any) => String(u.roles).split(',').includes('ADMIN')

  return (
    <div>
      <PageHeader title="Users" subtitle="Search every account, suspend or reactivate it, or send a password reset."
        actions={<button className="btn btn-primary" onClick={() => setAddingAdmin(true)}><Plus className="h-4 w-4" />Add administrator</button>} />
      <div className="mb-4 flex flex-wrap gap-3">
        <div className="relative min-w-[220px] flex-1 sm:max-w-sm"><Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
          <input className="input pl-9" placeholder="Search name, email or phone" aria-label="Search users" value={q} onChange={(e) => setQ(e.target.value)} /></div>
        <select className="input w-auto" aria-label="Filter by role" value={role} onChange={(e) => setRole(e.target.value)}>
          <option value="">All roles</option>{Object.entries(ROLE_LABEL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}</select>
        <select className="input w-auto" aria-label="Filter by status" value={status} onChange={(e) => setStatus(e.target.value)}>
          <option value="">All statuses</option><option value="ACTIVE">Active</option><option value="PENDING">Pending approval</option><option value="SUSPENDED">Suspended</option><option value="REJECTED">Declined</option></select>
      </div>
      {loading && !data && <Spinner />}{error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && <Empty emoji="🔎" title="No users match">Try clearing the filters.</Empty>}
      {data && data.length > 0 && (
        <div className="card overflow-x-auto p-0">
          <table className="w-full min-w-[820px] text-left text-sm">
            <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">User</th><th className="px-4 py-3">Roles</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Last sign-in</th><th className="px-4 py-3 text-right">Actions</th></tr></thead>
            <tbody className="divide-y divide-gray-100">
              {data.map((u) => {
                const self = u.id === me?.id
                const locked = self || isAdmin(u)
                return (
                  <tr key={u.id} className="align-top">
                    <td className="px-4 py-3"><div className="font-bold">{u.full_name}{self ? <span className="ml-1 text-xs font-normal text-gray-400">(you)</span> : null}</div><div className="text-xs text-gray-500">{u.email}{u.phone ? ` · ${u.phone}` : ''}</div></td>
                    <td className="px-4 py-3 text-xs">{String(u.roles).split(',').filter(Boolean).map((r: string) => ROLE_LABEL[r] ?? r).join(', ') || '·'}{u.pending_roles ? <div className="text-sun-600">Pending: {String(u.pending_roles).split(',').map((r: string) => ROLE_LABEL[r] ?? r).join(', ')}</div> : null}</td>
                    <td className="px-4 py-3"><Tag tone={STATUS_TONE[u.status] ?? 'gray'}>{u.status === 'PENDING' ? 'Pending approval' : u.status.charAt(0) + u.status.slice(1).toLowerCase()}</Tag>{u.status_note ? <div className="mt-1 max-w-[180px] text-xs text-gray-500">{u.status_note}</div> : null}</td>
                    <td className="px-4 py-3 text-xs text-gray-500">{u.last_login_at ? timeAgo(String(u.last_login_at)) : 'Never'}</td>
                    <td className="px-4 py-3">
                      {locked ? <div className="text-right text-xs text-gray-400">{isAdmin(u) ? <span className="inline-flex items-center gap-1"><ShieldCheck className="h-3.5 w-3.5" />Administrator</span> : null}</div> : (
                        <div className="flex justify-end gap-1">
                          <button className="btn btn-ghost btn-sm" title="Email a password reset link" onClick={() => run(() => api.post(`/admin/users/${u.id}/send-reset`), 'Reset link sent')}><KeyRound className="h-3.5 w-3.5" /></button>
                          {u.status === 'SUSPENDED'
                            ? <button className="btn btn-ghost btn-sm" onClick={() => run(() => api.post(`/admin/users/${u.id}/reactivate`), 'Account reactivated')}><UserCheck className="h-3.5 w-3.5" />Reactivate</button>
                            : u.status === 'ACTIVE' ? <button className="btn btn-ghost btn-sm" onClick={() => { setSuspending(u); setReason('') }}><Ban className="h-3.5 w-3.5" />Suspend</button> : null}
                          <button className="btn btn-danger btn-sm" aria-label={`Delete ${u.full_name}`} onClick={() => { if (confirm(`Permanently delete ${u.full_name} and ALL of their data? This cannot be undone.`)) run(() => api.del(`/admin/users/${u.id}`), 'User deleted') }}><Trash2 className="h-3.5 w-3.5" /></button>
                        </div>)}
                    </td>
                  </tr>)
              })}
            </tbody>
          </table>
        </div>)}

      <Modal open={!!suspending} onClose={() => setSuspending(null)} title={`Suspend ${suspending?.full_name ?? ''}`}>
        <form onSubmit={suspend} className="space-y-4">
          <p className="text-sm text-gray-600">They are signed out immediately and cannot sign in again until you reactivate them. They are told by email.</p>
          <Field label="Reason (shown to the user)"><textarea className="input min-h-[80px]" maxLength={300} value={reason} onChange={(e) => setReason(e.target.value)} /></Field>
          <button className="btn btn-danger w-full" disabled={busy}>Suspend account</button>
        </form>
      </Modal>
      <Modal open={addingAdmin} onClose={() => setAddingAdmin(false)} title="Add an administrator">
        <form onSubmit={addAdmin} className="space-y-4">
          <p className="text-sm text-gray-600">They receive an email with a link to choose their own password.</p>
          <Field label="Full name"><input className="input" required value={adm.fullName} onChange={(e) => setAdm({ ...adm, fullName: e.target.value })} /></Field>
          <Field label="Email"><input className="input" type="email" required value={adm.email} onChange={(e) => setAdm({ ...adm, email: e.target.value })} /></Field>
          <button className="btn btn-primary w-full" disabled={busy}>Send invitation</button>
        </form>
      </Modal>
    </div>
  )
}

export function AdminEmails() {
  const { data, error, loading, reload } = useApi<any[]>('/admin/emails')
  return (
    <div>
      <PageHeader title="Emails" subtitle="The last 100 emails the platform sent. Message bodies are not stored." actions={<button className="btn btn-ghost" onClick={reload}>Refresh</button>} />
      {loading && !data && <Spinner />}{error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && <Empty emoji="✉️" title="No emails yet">Invitations, approvals and password resets will be listed here.</Empty>}
      {data && data.length > 0 && <>
        {data.every((e) => e.status === 'LOGGED') && <div className="mb-4 rounded-2xl bg-sun-100 p-4 text-sm text-sun-600"><Mail className="mr-2 inline h-4 w-4" />No SMTP server is configured, so emails are only written to the backend log. Set <code>SPRING_MAIL_HOST</code> (see the README) to send real emails.</div>}
        <div className="card overflow-x-auto p-0"><table className="w-full min-w-[640px] text-left text-sm">
          <thead className="border-b border-gray-100 text-xs uppercase tracking-wide text-gray-500"><tr><th className="px-4 py-3">To</th><th className="px-4 py-3">Subject</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">When</th></tr></thead>
          <tbody className="divide-y divide-gray-100">{data.map((e) => (
            <tr key={e.id}><td className="px-4 py-2.5">{e.to_email}</td><td className="px-4 py-2.5">{e.subject}</td>
              <td className="px-4 py-2.5"><Tag tone={e.status === 'SENT' ? 'green' : e.status === 'FAILED' ? 'red' : 'orange'}>{e.status === 'LOGGED' ? 'Logged only' : e.status.charAt(0) + e.status.slice(1).toLowerCase()}</Tag>{e.error ? <div className="mt-1 max-w-xs truncate text-xs text-red-600" title={e.error}>{e.error}</div> : null}</td>
              <td className="px-4 py-2.5 text-xs text-gray-500">{timeAgo(String(e.created_at))}</td></tr>))}</tbody>
        </table></div></>}
    </div>
  )
}
