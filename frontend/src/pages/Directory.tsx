import { useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { ArrowLeft, BadgeCheck, MapPin, MessageCircle, Phone, Search } from 'lucide-react'
import { Empty, ErrorBox, Field, Spinner, Tag, useToast } from '../components/ui'
import { api } from '../lib/api'
import { useAuth } from '../lib/auth'
import { useApi, useDebounced } from '../lib/hooks'
import { ksh } from '../lib/format'

export function NutritionistDirectory() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const { data, error, loading, reload } = useApi<any[]>(`/public/nutritionists?q=${encodeURIComponent(dq)}`)
  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl font-extrabold">Find a nutritionist</h1>
      <p className="mt-2 max-w-2xl text-gray-600">Browse professionals. To work with one, create an account and invite them, so you stay in control of what they can see.</p>
      <div className="relative mt-6 max-w-xl"><Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" /><input className="input pl-10" placeholder="Search by name, specialty or headline" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search nutritionists" /></div>
      {loading && <Spinner />}
      {error && <div className="mt-6"><ErrorBox message={error} onRetry={reload} /></div>}
      {data && data.length === 0 && <div className="mt-8"><Empty emoji="🩺" title="No nutritionists found" /></div>}
      <div className="mt-8 grid gap-5 md:grid-cols-2">
        {(data ?? []).map((n) => (
          <div key={n.id} className="card">
            <div className="flex items-start gap-4">
              <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl bg-forest text-xl font-extrabold text-white">{n.full_name.split(' ').map((p: string) => p[0]).slice(-2).join('')}</div>
              <div className="flex-1">
                <h3 className="font-display text-lg font-extrabold">{n.full_name}</h3>
                <p className="text-sm text-gray-600">{n.headline || 'Nutrition professional'}</p>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-xs text-gray-500">
                  {n.city && <span className="flex items-center gap-1"><MapPin className="h-3.5 w-3.5" />{n.city}</span>}
                  {Number(n.monthly_fee) > 0 && <span>From {ksh(n.monthly_fee)} / month</span>}
                  <Tag tone={n.accepting_clients ? 'green' : 'gray'}>{n.accepting_clients ? 'Accepting clients' : 'Waitlist'}</Tag>
                </div>
              </div>
            </div>
            {n.specialization && <p className="mt-3 text-sm"><b>Focus:</b> {n.specialization}</p>}
            {n.bio && <p className="mt-2 line-clamp-3 text-sm text-gray-600">{n.bio}</p>}
          </div>
        ))}
      </div>
    </div>
  )
}

export function BusinessDirectory() {
  const [q, setQ] = useState('')
  const dq = useDebounced(q)
  const { data, error, loading, reload } = useApi<any[]>(`/public/businesses?q=${encodeURIComponent(dq)}`)
  return (
    <div className="container-x py-12">
      <h1 className="font-display text-4xl font-extrabold">Food vendors</h1>
      <p className="mt-2 max-w-2xl text-gray-600">Grocers, vegetable vendors and suppliers who publish prices on ChakulaSmart.</p>
      <div className="relative mt-6 max-w-xl"><Search className="absolute left-3.5 top-3 h-4 w-4 text-gray-400" /><input className="input pl-10" placeholder="Search vendors or products (beans, sukuma, omena…)" value={q} onChange={(e) => setQ(e.target.value)} aria-label="Search vendors" /></div>
      {loading && <Spinner />}
      {error && <div className="mt-6"><ErrorBox message={error} onRetry={reload} /></div>}
      {data && data.length === 0 && <div className="mt-8"><Empty emoji="🏪" title="No vendors found" /></div>}
      <div className="mt-8 grid gap-5 md:grid-cols-2 lg:grid-cols-3">
        {(data ?? []).map((b) => (
          <Link key={b.id} to={`/directory/businesses/${b.id}`} className="card transition hover:-translate-y-1 hover:shadow-lift">
            <div className="flex items-center gap-3"><div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-sun-100 text-2xl">🏪</div>
              <div><h3 className="flex items-center gap-1 font-display font-extrabold">{b.business_name}{b.verified && <BadgeCheck className="h-4 w-4 text-forest" aria-label="Verified" />}</h3>
                <div className="text-xs text-gray-500">{b.category}{b.city ? ` · ${b.city}` : ''}</div></div></div>
            <p className="mt-3 line-clamp-2 text-sm text-gray-600">{b.description}</p>
            <div className="mt-3 text-xs font-semibold text-forest">{b.product_count} products listed →</div>
          </Link>
        ))}
      </div>
    </div>
  )
}

export function BusinessDetail() {
  const { id } = useParams()
  const { data: b, error, loading, reload } = useApi<any>(`/public/businesses/${id}`)
  const { user } = useAuth()
  const toast = useToast()
  const [msg, setMsg] = useState('')
  const [contact, setContact] = useState('')
  const [busy, setBusy] = useState(false)
  if (loading) return <Spinner />
  if (error || !b) return <div className="container-x py-12"><ErrorBox message={error ?? 'Not found'} onRetry={reload} /></div>

  async function send() {
    setBusy(true)
    try { await api.post('/enquiries', { businessId: b.id, message: msg, contact }); toast('Enquiry sent. The vendor will contact you.'); setMsg('') }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  const wa = String(b.whatsapp || '').replace(/\D/g, '')
  return (
    <div className="container-x py-10">
      <Link to="/directory/businesses" className="inline-flex items-center gap-1 text-sm font-semibold text-forest"><ArrowLeft className="h-4 w-4" /> All vendors</Link>
      <div className="mt-5 grid gap-8 lg:grid-cols-[1fr_360px]">
        <div>
          <h1 className="flex items-center gap-2 font-display text-3xl font-extrabold">{b.business_name}{b.verified && <BadgeCheck className="h-6 w-6 text-forest" />}</h1>
          <div className="mt-1 text-sm text-gray-500">{b.category}{b.city ? ` · ${b.city}` : ''}</div>
          <p className="mt-4 text-gray-600">{b.description}</p>
          <div className="mt-5 flex flex-wrap gap-2">
            {b.phone && <a className="btn btn-ghost" href={`tel:${b.phone}`}><Phone className="h-4 w-4" />{b.phone}</a>}
            {wa && <a className="btn btn-primary" href={`https://wa.me/${wa}`} target="_blank" rel="noreferrer"><MessageCircle className="h-4 w-4" />WhatsApp</a>}
          </div>
          <h2 className="mt-8 font-display text-xl font-extrabold">Products & prices</h2>
          <div className="card mt-3 divide-y divide-gray-100 p-0">
            {b.products.length === 0 && <div className="p-5 text-sm text-gray-500">No products listed yet.</div>}
            {b.products.map((p: any) => (
              <div key={p.id} className="flex items-center justify-between gap-3 px-5 py-3 text-sm">
                <div><div className={`font-semibold ${p.in_stock ? '' : 'text-gray-400 line-through'}`}>{p.name}</div>
                  <div className="text-xs text-gray-500">{p.category}</div>
                  {p.offer_text && <Tag tone="orange">{p.offer_text}</Tag>}</div>
                <div className="text-right"><div className="font-display font-extrabold text-forest">{ksh(p.price)}</div><div className="text-xs text-gray-500">per {p.unit}</div></div>
              </div>
            ))}
          </div>
        </div>
        <aside className="card h-fit">
          <h3 className="font-display font-extrabold">Send an enquiry</h3>
          {user ? (
            <div className="mt-3 space-y-3">
              <Field label="Message"><textarea className="input min-h-[110px]" value={msg} onChange={(e) => setMsg(e.target.value)} placeholder="What do you need, and where should it be delivered?" /></Field>
              <Field label="Contact to share" hint="Only your name and this contact are shared, never your health data."><input className="input" value={contact} onChange={(e) => setContact(e.target.value)} placeholder="Phone or WhatsApp" /></Field>
              <button className="btn btn-primary w-full" disabled={busy || !msg.trim()} onClick={send}>{busy ? 'Sending…' : 'Send enquiry'}</button>
            </div>
          ) : <p className="mt-2 text-sm text-gray-600">Sign in to message this vendor, or contact them directly using the buttons above.<Link to="/login" className="btn btn-primary mt-4 w-full" state={{ from: `/directory/businesses/${b.id}` }}>Sign in</Link></p>}
        </aside>
      </div>
    </div>
  )
}
