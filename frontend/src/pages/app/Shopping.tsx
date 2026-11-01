import { useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Phone, Plus, ShoppingBasket, Store, Trash2 } from 'lucide-react'
import { Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Tag, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useApi } from '../../lib/hooks'
import { ksh, shortDate } from '../../lib/format'

export function ShoppingLists() {
  const { data, error, loading, reload } = useApi<any[]>('/shopping')
  const toast = useToast()
  const nav = useNavigate()
  const [open, setOpen] = useState(false)
  const [title, setTitle] = useState('')
  async function create() {
    try { const r = await api.post<{ id: number }>('/shopping', { title }); setOpen(false); setTitle(''); nav(`/app/shopping/${r.id}`) } catch (e: any) { toast(e.message, 'err') }
  }
  return (
    <div>
      <PageHeader title="Shopping lists" subtitle="Create a list from a meal plan, or start one from scratch."
        actions={<><Link to="/app/planner" className="btn btn-ghost">From a meal plan</Link><button className="btn btn-primary" onClick={() => setOpen(true)}><Plus className="h-4 w-4" />New list</button></>} />
      {loading && <Spinner />}
      {error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && <Empty emoji="🛒" title="No shopping lists yet">Open a meal plan and tap “Shopping list”, and we'll total every ingredient for the week.</Empty>}
      <div className="grid gap-4 md:grid-cols-2">
        {(data ?? []).map((l) => (
          <Link key={l.id} to={`/app/shopping/${l.id}`} className="card transition hover:-translate-y-1 hover:shadow-lift">
            <h3 className="font-display font-extrabold">{l.title}</h3>
            <div className="mt-1 text-xs text-gray-500">{shortDate(String(l.created_at))}</div>
            <div className="mt-3 h-2 overflow-hidden rounded-full bg-forest-100"><div className="h-full rounded-full bg-forest" style={{ width: `${l.item_count ? (l.checked_count / l.item_count) * 100 : 0}%` }} /></div>
            <div className="mt-2 flex justify-between text-sm"><span className="text-gray-600">{l.checked_count} / {l.item_count} bought</span><span className="font-bold text-forest">{ksh(l.est_total)}</span></div>
          </Link>
        ))}
      </div>
      <Modal open={open} onClose={() => setOpen(false)} title="New shopping list">
        <Field label="Title"><input className="input" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Saturday market" /></Field>
        <button className="btn btn-primary mt-4 w-full" onClick={create}>Create list</button>
      </Modal>
    </div>
  )
}

export function ShoppingDetail() {
  const { id } = useParams()
  const { data: l, error, loading, reload, setData } = useApi<any>(`/shopping/${id}`)
  const toast = useToast()
  const nav = useNavigate()
  const [name, setName] = useState('')
  const [qty, setQty] = useState('1')
  const [cost, setCost] = useState('')
  const [showVendors, setShowVendors] = useState(true)
  if (loading && !l) return <Spinner />
  if (error || !l) return <ErrorBox message={error ?? 'List not found'} onRetry={reload} />

  async function check(item: any) {
    const checked = !item.checked
    setData({ ...l, items: l.items.map((i: any) => (i.id === item.id ? { ...i, checked } : i)) })
    try { await api.patch(`/shopping/items/${item.id}`, { checked }) } catch (e: any) { toast(e.message, 'err'); reload() }
  }
  async function add() {
    if (!name.trim()) return
    try { await api.post(`/shopping/${id}/items`, { name, quantity: Number(qty) || 1, unit: '', estCost: cost ? Number(cost) : 0 }); setName(''); setCost(''); setQty('1'); reload() } catch (e: any) { toast(e.message, 'err') }
  }
  async function remove(itemId: number) { try { await api.del(`/shopping/items/${itemId}`); reload() } catch (e: any) { toast(e.message, 'err') } }
  async function removeList() {
    if (!confirm('Delete this list?')) return
    try { await api.del(`/shopping/${id}`); nav('/app/shopping') } catch (e: any) { toast(e.message, 'err') }
  }
  const done = l.items.filter((i: any) => i.checked).length
  const cheapest = l.items.reduce((s: number, i: any) => s + (i.vendors?.[0] ? Number(i.vendors[0].price) : 0), 0)
  return (
    <div>
      <Link to="/app/shopping" className="mb-3 inline-flex items-center gap-1 text-sm font-semibold text-forest"><ArrowLeft className="h-4 w-4" />All lists</Link>
      <PageHeader title={l.title} subtitle={`${done} of ${l.items.length} bought · estimated ${ksh(l.est_total)}`}
        actions={<><button className="btn btn-ghost" onClick={() => setShowVendors((v) => !v)}><Store className="h-4 w-4" />{showVendors ? 'Hide' : 'Show'} vendor prices</button><button className="btn btn-danger" onClick={removeList}><Trash2 className="h-4 w-4" />Delete</button></>} />
      <div className="mb-5 h-2.5 overflow-hidden rounded-full bg-forest-100"><div className="h-full rounded-full bg-forest transition-all" style={{ width: `${l.items.length ? (done / l.items.length) * 100 : 0}%` }} /></div>
      {l.items.length === 0 && <Empty emoji="🛒" title="This list is empty">Add items below.</Empty>}
      <div className="space-y-3">
        {l.items.map((i: any) => (
          <div key={i.id} className={`card ${i.checked ? 'opacity-60' : ''}`}>
            <div className="flex items-center gap-3">
              <input type="checkbox" className="h-5 w-5 accent-forest" checked={i.checked} onChange={() => check(i)} aria-label={`Bought ${i.name}`} />
              <div className="min-w-0 flex-1"><div className={`font-semibold ${i.checked ? 'line-through' : ''}`}>{i.name}</div><div className="text-xs text-gray-500">{Number(i.quantity)} × {i.unit || 'item'}</div></div>
              <span className="text-sm font-bold text-forest">{ksh(i.est_cost)}</span>
              <button className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label={`Remove ${i.name}`} onClick={() => remove(i.id)}><Trash2 className="h-4 w-4" /></button>
            </div>
            {showVendors && i.vendors?.length > 0 && (
              <div className="mt-3 flex flex-wrap gap-2 border-t border-gray-100 pt-3">
                {i.vendors.map((v: any) => (
                  <Link key={v.id} to={`/directory/businesses/${v.business_id}`} className="flex items-center gap-2 rounded-xl bg-sun-100/60 px-3 py-2 text-xs transition hover:bg-sun-100">
                    <Store className="h-3.5 w-3.5 text-sun-600" />
                    <span><b>{v.business_name}</b>{v.city ? ` · ${v.city}` : ''}<br />{v.name}: <b>{ksh(v.price)}</b> / {v.unit}</span>
                    {v.offer_text && <Tag tone="orange">{v.offer_text}</Tag>}
                    {v.phone && <Phone className="h-3.5 w-3.5 text-gray-400" aria-label={v.phone} />}
                  </Link>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
      {showVendors && cheapest > 0 && <p className="mt-3 text-xs text-gray-500">Vendor prices are per their listed unit and aren't converted to your quantities. Contact the vendor to confirm.</p>}
      <div className="card mt-6">
        <h3 className="mb-3 flex items-center gap-2 font-display font-extrabold"><ShoppingBasket className="h-4 w-4 text-forest" />Add an item</h3>
        <div className="grid gap-3 sm:grid-cols-[1fr_100px_140px_auto]">
          <input className="input" placeholder="e.g. Cooking oil" value={name} onChange={(e) => setName(e.target.value)} onKeyDown={(e) => e.key === 'Enter' && add()} aria-label="Item name" />
          <input className="input" type="number" min="0.1" step="0.5" value={qty} onChange={(e) => setQty(e.target.value)} aria-label="Quantity" />
          <input className="input" type="number" min="0" placeholder="Est. KSh" value={cost} onChange={(e) => setCost(e.target.value)} aria-label="Estimated cost" />
          <button className="btn btn-primary" onClick={add}>Add</button>
        </div>
      </div>
    </div>
  )
}
