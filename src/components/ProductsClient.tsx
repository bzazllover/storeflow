'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

type Cat = { id: string; name: string }
type Product = {
  id: string; name: string; sku: string; barcode: string | null
  cost_price: number; selling_price: number; stock_qty: number; min_stock: number
  category_id: string | null; categories?: { name: string } | { name: string }[] | null
}
const catName = (c: Product['categories']) => Array.isArray(c) ? c[0]?.name : c?.name

const blank = { name: '', sku: '', barcode: '', cost_price: 0, selling_price: 0, stock_qty: 0, min_stock: 0, category_id: '' }

export default function ProductsClient({ products, categories }: { products: Product[]; categories: Cat[] }) {
  const supabase = supabaseBrowser()
  const router = useRouter()
  const [open, setOpen] = useState(false)
  const [form, setForm] = useState<any>(blank)
  const [err, setErr] = useState<string | null>(null)

  function genSku(name: string) {
    const base = name.replace(/[^a-zA-Z0-9]/g, '').slice(0, 4).toUpperCase() || 'PRD'
    return `${base}-${Math.floor(1000 + Math.random() * 9000)}`
  }

  function edit(p: Product) {
    setForm({ ...p, barcode: p.barcode ?? '', category_id: p.category_id ?? '' }); setOpen(true)
  }
  function create() {
    setForm({ ...blank, sku: genSku('') }); setOpen(true)
  }

  async function save() {
    setErr(null)
    const payload = {
      name: form.name,
      sku: form.sku || genSku(form.name),
      barcode: form.barcode || null,
      cost_price: Number(form.cost_price),
      selling_price: Number(form.selling_price),
      stock_qty: Number(form.stock_qty),
      min_stock: Number(form.min_stock),
      category_id: form.category_id || null,
    }
    const res = form.id
      ? await supabase.from('products').update(payload).eq('id', form.id)
      : await supabase.from('products').insert(payload)
    if (res.error) return setErr(res.error.message)
    setOpen(false); router.refresh()
  }

  async function remove(id: string) {
    if (!confirm('Delete this product?')) return
    await supabase.from('products').update({ active: false }).eq('id', id)
    router.refresh()
  }

  const margin = (c: number, s: number) => s ? Math.round((s - c) / s * 100) : 0

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-semibold tracking-tight">Products</h1>
        <button className="btn-primary" onClick={create}>Add product</button>
      </div>

      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr>
            <th>Name</th><th>SKU</th><th>Category</th><th>Cost</th><th>Price</th><th>Margin</th><th>Stock</th><th></th>
          </tr></thead>
          <tbody>
            {products.map(p => (
              <tr key={p.id}>
                <td className="font-medium">{p.name}</td>
                <td className="font-mono text-xs text-slate-400">{p.sku}</td>
                <td className="text-slate-400">{catName(p.categories) ?? '—'}</td>
                <td>{Number(p.cost_price)}</td>
                <td>{Number(p.selling_price)}</td>
                <td><span className="badge bg-line text-good">{margin(p.cost_price, p.selling_price)}%</span></td>
                <td className={Number(p.stock_qty) <= Number(p.min_stock) ? 'text-warn' : ''}>{Number(p.stock_qty)}</td>
                <td className="text-right whitespace-nowrap">
                  <button className="text-xs text-accent mr-3" onClick={() => edit(p)}>Edit</button>
                  <button className="text-xs text-bad" onClick={() => remove(p.id)}>Delete</button>
                </td>
              </tr>
            ))}
            {!products.length && <tr><td colSpan={8} className="text-center text-slate-500 py-8">No products yet. Add your first one.</td></tr>}
          </tbody>
        </table>
      </div>

      {open && (
        <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 p-4" onClick={() => setOpen(false)}>
          <div className="card p-6 w-full max-w-md" onClick={e => e.stopPropagation()}>
            <div className="text-lg font-semibold mb-4">{form.id ? 'Edit product' : 'New product'}</div>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="label">Name</label>
                <input className="input" value={form.name}
                  onChange={e => setForm({ ...form, name: e.target.value, sku: form.sku || genSku(e.target.value) })} />
              </div>
              <div><label className="label">SKU</label><input className="input font-mono" value={form.sku} onChange={e => setForm({ ...form, sku: e.target.value })} /></div>
              <div><label className="label">Barcode</label><input className="input" value={form.barcode} onChange={e => setForm({ ...form, barcode: e.target.value })} /></div>
              <div><label className="label">Cost price</label><input type="number" className="input" value={form.cost_price} onChange={e => setForm({ ...form, cost_price: e.target.value })} /></div>
              <div><label className="label">Selling price</label><input type="number" className="input" value={form.selling_price} onChange={e => setForm({ ...form, selling_price: e.target.value })} /></div>
              <div><label className="label">Stock qty</label><input type="number" className="input" value={form.stock_qty} onChange={e => setForm({ ...form, stock_qty: e.target.value })} /></div>
              <div><label className="label">Min stock</label><input type="number" className="input" value={form.min_stock} onChange={e => setForm({ ...form, min_stock: e.target.value })} /></div>
              <div className="col-span-2">
                <label className="label">Category</label>
                <select className="input" value={form.category_id} onChange={e => setForm({ ...form, category_id: e.target.value })}>
                  <option value="">Uncategorized</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
            </div>
            {err && <p className="text-bad text-sm mt-3">{err}</p>}
            <div className="flex gap-2 mt-5">
              <button className="btn-ghost flex-1" onClick={() => setOpen(false)}>Cancel</button>
              <button className="btn-primary flex-1" onClick={save}>Save</button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
