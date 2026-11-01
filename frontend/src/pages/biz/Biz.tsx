import { useState, type FormEvent } from 'react'
import { Link } from 'react-router-dom'
import { Inbox, Package, Pencil, Plus, Tag as TagIcon, Trash2, Users } from 'lucide-react'
import { Empty, ErrorBox, Field, Modal, PageHeader, Spinner, Stat, Tag, useToast } from '../../components/ui'
import { api } from '../../lib/api'
import { useApi } from '../../lib/hooks'
import { ksh, timeAgo } from '../../lib/format'
import type { Food } from '../../lib/types'
import RosterManager from '../../components/RosterManager'

export function BizOverview() {
  const { data, error, loading, reload } = useApi<any>('/biz/overview')
  const prof = useApi<any>('/biz/profile')
  if (loading && !data) return <Spinner />
  if (error) return <ErrorBox message={error} onRetry={reload} />
  return (
    <div>
      <PageHeader title={prof.data?.business_name ?? 'Your business'} subtitle="Shoppers see your products when their lists need them."
        actions={prof.data && <Link to={`/directory/businesses/${prof.data.user_id}`} className="btn btn-ghost">View public page</Link>} />
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Products listed" value={data.products} icon={<Package className="h-4 w-4" />} />
        <Stat label="In stock" value={data.in_stock} tone="good" />
        <Stat label="Active offers" value={data.offers} icon={<TagIcon className="h-4 w-4" />} />
        <Stat label="New enquiries" value={data.new_enquiries} tone={data.new_enquiries > 0 ? 'warn' : 'default'} sub={`${data.total_enquiries} total`} icon={<Inbox className="h-4 w-4" />} />
      </div>
      <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Customers on your list" value={data.customers} sub={`${data.customers_registered} have joined ChakulaSmart`} icon={<Users className="h-4 w-4" />} />
      </div>
      {data.products === 0 && <div className="mt-8"><Empty emoji="🥬" title="Add your first product"><Link className="font-semibold text-forest" to="/biz/products">List products and prices</Link> so shoppers can find you.</Empty></div>}
    </div>
  )
}

const CATS = ['Vegetables', 'Fruits', 'Cereals & Legumes', 'Dairy & Eggs', 'Meat', 'Fish', 'Prepared meals', 'Other']
const blank = { name: '', category: 'Vegetables', price: '', unit: 'kg', offerText: '', inStock: true, foodId: '' as number | '' }

export function BizProducts() {
  const { data, error, loading, reload } = useApi<any[]>('/biz/products')
  const foods = useApi<Food[]>('/public/foods')
  const toast = useToast()
  const [form, setForm] = useState<any | null>(null)
  const [editId, setEditId] = useState<number | null>(null)
  const [busy, setBusy] = useState(false)

  function openNew() { setEditId(null); setForm({ ...blank }) }
  function openEdit(p: any) { setEditId(p.id); setForm({ name: p.name, category: p.category, price: p.price, unit: p.unit, offerText: p.offer_text ?? '', inStock: p.in_stock, foodId: p.food_id ?? '' }) }
  async function save(e: FormEvent) {
    e.preventDefault(); setBusy(true)
    const body = { ...form, price: Number(form.price), foodId: form.foodId === '' ? null : Number(form.foodId) }
    try { editId ? await api.put(`/biz/products/${editId}`, body) : await api.post('/biz/products', body); toast('Product saved'); setForm(null); reload() }
    catch (e: any) { toast(e.message, 'err') } finally { setBusy(false) }
  }
  async function remove(id: number) { if (!confirm('Delete this product?')) return; try { await api.del(`/biz/products/${id}`); reload() } catch (e: any) { toast(e.message, 'err') } }
  async function toggleStock(p: any) {
    try { await api.put(`/biz/products/${p.id}`, { name: p.name, category: p.category, price: Number(p.price), unit: p.unit, offerText: p.offer_text, inStock: !p.in_stock, foodId: p.food_id }); reload() } catch (e: any) { toast(e.message, 'err') }
  }
  const set = (k: string, v: any) => setForm({ ...form, [k]: v })
  return (
    <div>
      <PageHeader title="Products & prices" subtitle="Link a product to a ChakulaSmart food so it matches shoppers' lists."
        actions={<button className="btn btn-primary" onClick={openNew}><Plus className="h-4 w-4" />Add product</button>} />
      {loading && <Spinner />}{error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && <Empty emoji="🥬" title="No products yet">Add what you sell, with prices.</Empty>}
      {data && data.length > 0 && <div className="card overflow-x-auto p-0"><table className="w-full min-w-[640px] text-left text-sm">
        <thead><tr className="border-b border-gray-100 bg-forest-50 text-xs uppercase tracking-wide text-forest-800"><th className="px-5 py-3">Product</th><th>Category</th><th>Price</th><th>Offer</th><th>Stock</th><th /></tr></thead>
        <tbody>{data.map((p) => (
          <tr key={p.id} className="border-b border-gray-50"><td className="px-5 py-3 font-semibold">{p.name}</td><td className="text-gray-500">{p.category}</td>
            <td className="font-bold text-forest">{ksh(p.price)} <span className="font-normal text-gray-400">/ {p.unit}</span></td><td>{p.offer_text ? <Tag tone="orange">{p.offer_text}</Tag> : '·'}</td>
            <td><button onClick={() => toggleStock(p)} className={`badge ${p.in_stock ? 'bg-forest-100 text-forest-800' : 'bg-gray-100 text-gray-500'}`}>{p.in_stock ? 'In stock' : 'Out'}</button></td>
            <td className="pr-4 text-right"><button className="rounded-full p-1.5 text-gray-500 hover:bg-gray-100" aria-label="Edit" onClick={() => openEdit(p)}><Pencil className="h-4 w-4" /></button><button className="rounded-full p-1.5 text-gray-400 hover:bg-red-50 hover:text-red-600" aria-label="Delete" onClick={() => remove(p.id)}><Trash2 className="h-4 w-4" /></button></td></tr>))}</tbody></table></div>}
      <Modal open={!!form} onClose={() => setForm(null)} title={editId ? 'Edit product' : 'Add a product'}>
        {form && <form onSubmit={save} className="space-y-4">
          <Field label="Product name"><input className="input" required value={form.name} onChange={(e) => set('name', e.target.value)} /></Field>
          <div className="grid gap-4 sm:grid-cols-2">
            <Field label="Category"><select className="input" value={form.category} onChange={(e) => set('category', e.target.value)}>{CATS.map((c) => <option key={c}>{c}</option>)}</select></Field>
            <Field label="Matches food"><select className="input" value={form.foodId} onChange={(e) => set('foodId', e.target.value ? Number(e.target.value) : '')}><option value="">None</option>{(foods.data ?? []).map((f) => <option key={f.id} value={f.id}>{f.emoji} {f.name}</option>)}</select></Field>
            <Field label="Price (KSh)"><input className="input" type="number" min={0} required value={form.price} onChange={(e) => set('price', e.target.value)} /></Field>
            <Field label="Per unit"><input className="input" required value={form.unit} onChange={(e) => set('unit', e.target.value)} placeholder="kg, bunch, tray" /></Field>
          </div>
          <Field label="Offer (optional)"><input className="input" value={form.offerText} onChange={(e) => set('offerText', e.target.value)} placeholder="e.g. 3 for KSh 60" /></Field>
          <label className="flex items-center gap-2 text-sm font-semibold"><input type="checkbox" className="h-4 w-4 accent-forest" checked={form.inStock} onChange={(e) => set('inStock', e.target.checked)} />In stock</label>
          <button className="btn btn-primary w-full" disabled={busy}>{busy ? 'Saving…' : 'Save product'}</button>
        </form>}
      </Modal>
    </div>
  )
}

export function BizEnquiries() {
  const { data, error, loading, reload } = useApi<any[]>('/biz/enquiries')
  const toast = useToast()
  async function setStatus(id: number, status: string) { try { await api.patch(`/biz/enquiries/${id}`, { status }); reload() } catch (e: any) { toast(e.message, 'err') } }
  return (
    <div>
      <PageHeader title="Customer enquiries" subtitle="You see only the customer's name and the contact they chose to share." />
      {loading && <Spinner />}{error && <ErrorBox message={error} onRetry={reload} />}
      {data && data.length === 0 && <Empty emoji="📭" title="No enquiries yet" />}
      <div className="space-y-4">{(data ?? []).map((e) => (
        <div key={e.id} className="card"><div className="flex items-start justify-between gap-3"><div><h3 className="font-display font-extrabold">{e.from_name}</h3><div className="text-xs text-gray-500">{timeAgo(String(e.created_at))}{e.contact ? ` · ${e.contact}` : ''}</div></div>
          <Tag tone={e.status === 'NEW' ? 'orange' : e.status === 'REPLIED' ? 'green' : 'gray'}>{e.status}</Tag></div>
          <p className="mt-3 text-sm text-gray-700">{e.message}</p>
          <div className="mt-4 flex gap-2">{e.status !== 'REPLIED' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(e.id, 'REPLIED')}>Mark replied</button>}{e.status !== 'CLOSED' && <button className="btn btn-ghost btn-sm" onClick={() => setStatus(e.id, 'CLOSED')}>Close</button>}</div></div>))}</div>
    </div>
  )
}

export function BizProfile() {
  const { data, error, loading, reload } = useApi<any>('/biz/profile')
  const toast = useToast()
  const [f, setF] = useState<any>(null)
  const cur = f ?? data
  if (loading && !data) return <Spinner />
  if (error || !cur) return <ErrorBox message={error ?? 'Failed'} onRetry={reload} />
  const set = (k: string, v: any) => setF({ ...cur, [k]: v })
  async function save(e: FormEvent) {
    e.preventDefault()
    try { await api.put('/biz/profile', { businessName: cur.business_name, category: cur.category, description: cur.description, city: cur.city, phone: cur.phone, whatsapp: cur.whatsapp }); toast('Business profile saved'); setF(null); reload() }
    catch (e: any) { toast(e.message, 'err') }
  }
  return (
    <div className="max-w-2xl">
      <PageHeader title="Business profile" subtitle="Shown in the public vendor directory." />
      <form onSubmit={save} className="card space-y-4">
        <Field label="Business name"><input className="input" required value={cur.business_name ?? ''} onChange={(e) => set('business_name', e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Type"><select className="input" value={cur.category ?? 'Grocery'} onChange={(e) => set('category', e.target.value)}>{['Grocery', 'Vegetable vendor', 'Supplier', 'Meal prep', 'Healthy food'].map((c) => <option key={c}>{c}</option>)}</select></Field>
          <Field label="Town / city"><input className="input" value={cur.city ?? ''} onChange={(e) => set('city', e.target.value)} /></Field>
          <Field label="Phone"><input className="input" value={cur.phone ?? ''} onChange={(e) => set('phone', e.target.value)} /></Field>
          <Field label="WhatsApp number" hint="With country code, e.g. 254712345678"><input className="input" value={cur.whatsapp ?? ''} onChange={(e) => set('whatsapp', e.target.value)} /></Field>
        </div>
        <Field label="Description"><textarea className="input min-h-[110px]" value={cur.description ?? ''} onChange={(e) => set('description', e.target.value)} /></Field>
        <button className="btn btn-primary">Save profile</button>
      </form>
    </div>
  )
}

export function BizCustomers() {
  return <RosterManager kind="biz" />
}
