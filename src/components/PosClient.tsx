'use client'
import { useMemo, useRef, useState } from 'react'
import { supabaseBrowser } from '@/lib/supabase-browser'

type Product = { id: string; name: string; sku: string; barcode: string | null; selling_price: number; stock_qty: number }
type Customer = { id: string; name: string }
type Line = { product: Product; qty: number }

export default function PosClient({ products, customers, taxRate, currency }:
  { products: Product[]; customers: Customer[]; taxRate: number; currency: string }) {
  const supabase = supabaseBrowser()
  const [query, setQuery] = useState('')
  const [cart, setCart] = useState<Line[]>([])
  const [discount, setDiscount] = useState(0)
  const [customer, setCustomer] = useState('')
  const [pay, setPay] = useState<'cash' | 'card' | 'mobile'>('cash')
  const [receipt, setReceipt] = useState<any>(null)
  const [err, setErr] = useState<string | null>(null)
  const searchRef = useRef<HTMLInputElement>(null)

  const results = useMemo(() => {
    const q = query.trim().toLowerCase()
    if (!q) return []
    return products.filter(p =>
      p.name.toLowerCase().includes(q) || p.sku.toLowerCase().includes(q) || p.barcode?.includes(q)
    ).slice(0, 8)
  }, [query, products])

  function add(p: Product) {
    setCart(c => {
      const found = c.find(l => l.product.id === p.id)
      if (found) return c.map(l => l.product.id === p.id ? { ...l, qty: l.qty + 1 } : l)
      return [...c, { product: p, qty: 1 }]
    })
    setQuery(''); searchRef.current?.focus()
  }

  // barcode scanners type fast then hit Enter — exact match auto-adds
  function onSearchKey(e: React.KeyboardEvent) {
    if (e.key !== 'Enter') return
    const exact = products.find(p => p.barcode === query.trim() || p.sku === query.trim())
    if (exact) add(exact)
    else if (results[0]) add(results[0])
  }

  const subtotal = cart.reduce((s, l) => s + l.qty * l.product.selling_price, 0)
  const tax = Math.round((subtotal - discount) * taxRate) / 100
  const total = subtotal - discount + tax

  async function checkout() {
    setErr(null)
    if (!cart.length) return
    const { data, error } = await supabase.rpc('checkout', {
      cart: {
        customer_id: customer || null,
        payment_method: pay,
        discount,
        tax_rate: taxRate,
        amount_paid: total,
        items: cart.map(l => ({ product_id: l.product.id, qty: l.qty, unit_price: l.product.selling_price })),
      },
    })
    if (error) return setErr(error.message)
    setReceipt({ ...data, items: cart, tax, discount, subtotal })
    setCart([]); setDiscount(0); setCustomer('')
  }

  const fmt = (n: number) => new Intl.NumberFormat('en').format(n) + ' ' + currency

  return (
    <div className="grid lg:grid-cols-[1fr_380px] gap-6 h-[calc(100vh-3rem)]">
      {/* left: search + results */}
      <div className="space-y-4">
        <h1 className="text-2xl font-semibold tracking-tight">Point of Sale</h1>
        <input ref={searchRef} className="input text-base" autoFocus
          placeholder="Scan barcode or search product…"
          value={query} onChange={e => setQuery(e.target.value)} onKeyDown={onSearchKey} />
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {results.map(p => (
            <button key={p.id} onClick={() => add(p)}
              className="card p-3 text-left hover:border-accent transition disabled:opacity-40"
              disabled={p.stock_qty <= 0}>
              <div className="text-sm font-medium truncate">{p.name}</div>
              <div className="text-xs text-slate-400 mt-1">{fmt(p.selling_price)}</div>
              <div className="text-[11px] text-slate-500 mt-0.5">Stock: {p.stock_qty}</div>
            </button>
          ))}
          {query && !results.length && <p className="text-sm text-slate-500">No match.</p>}
        </div>
      </div>

      {/* right: cart */}
      <div className="card flex flex-col">
        <div className="p-4 border-b border-line font-medium">Cart</div>
        <div className="flex-1 overflow-auto p-4 space-y-2">
          {cart.map(l => (
            <div key={l.product.id} className="flex items-center gap-2 text-sm">
              <div className="flex-1 truncate">{l.product.name}</div>
              <input type="number" min={1} value={l.qty}
                onChange={e => setCart(c => c.map(x => x.product.id === l.product.id
                  ? { ...x, qty: Math.max(1, Number(e.target.value)) } : x))}
                className="input w-16 py-1" />
              <div className="w-24 text-right">{fmt(l.qty * l.product.selling_price)}</div>
              <button className="text-bad text-xs"
                onClick={() => setCart(c => c.filter(x => x.product.id !== l.product.id))}>✕</button>
            </div>
          ))}
          {!cart.length && <p className="text-sm text-slate-500">Cart is empty.</p>}
        </div>
        <div className="p-4 border-t border-line space-y-2 text-sm">
          <select className="input" value={customer} onChange={e => setCustomer(e.target.value)}>
            <option value="">Walk-in customer</option>
            {customers.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="flex gap-2">
            {(['cash', 'card', 'mobile'] as const).map(m => (
              <button key={m} onClick={() => setPay(m)}
                className={`btn flex-1 capitalize ${pay === m ? 'bg-accent text-white' : 'border border-line'}`}>{m}</button>
            ))}
          </div>
          <div className="flex justify-between"><span className="text-slate-400">Subtotal</span><span>{fmt(subtotal)}</span></div>
          <div className="flex justify-between items-center">
            <span className="text-slate-400">Discount</span>
            <input type="number" min={0} value={discount}
              onChange={e => setDiscount(Math.max(0, Number(e.target.value)))} className="input w-24 py-1 text-right" />
          </div>
          <div className="flex justify-between"><span className="text-slate-400">Tax ({taxRate}%)</span><span>{fmt(tax)}</span></div>
          <div className="flex justify-between text-lg font-semibold pt-1"><span>Total</span><span>{fmt(total)}</span></div>
          {err && <p className="text-bad text-xs">{err}</p>}
          <button className="btn-primary w-full" onClick={checkout} disabled={!cart.length}>Charge {fmt(total)}</button>
        </div>
      </div>

      {receipt && <Receipt r={receipt} fmt={fmt} onClose={() => setReceipt(null)} />}
    </div>
  )
}

function Receipt({ r, fmt, onClose }: { r: any; fmt: (n: number) => string; onClose: () => void }) {
  return (
    <div className="fixed inset-0 bg-black/60 grid place-items-center z-50 print:bg-white" onClick={onClose}>
      <div className="bg-white text-black rounded-lg p-6 w-80 print:shadow-none" onClick={e => e.stopPropagation()} id="receipt">
        <div className="text-center font-semibold">StoreFlow</div>
        <div className="text-center text-xs text-gray-500 mb-3">Receipt #{r.receipt_no}</div>
        <div className="text-sm space-y-1">
          {r.items.map((l: any) => (
            <div key={l.product.id} className="flex justify-between">
              <span>{l.qty}× {l.product.name}</span>
              <span>{fmt(l.qty * l.product.selling_price)}</span>
            </div>
          ))}
        </div>
        <hr className="my-2" />
        <div className="text-sm flex justify-between"><span>Subtotal</span><span>{fmt(r.subtotal)}</span></div>
        {r.discount > 0 && <div className="text-sm flex justify-between"><span>Discount</span><span>-{fmt(r.discount)}</span></div>}
        <div className="text-sm flex justify-between"><span>Tax</span><span>{fmt(r.tax)}</span></div>
        <div className="font-semibold flex justify-between mt-1"><span>Total</span><span>{fmt(Number(r.total))}</span></div>
        <div className="mt-4 flex gap-2 print:hidden">
          <button className="btn-ghost flex-1 text-black border-gray-300" onClick={() => window.print()}>Print</button>
          <button className="btn-primary flex-1" onClick={onClose}>New sale</button>
        </div>
      </div>
    </div>
  )
}
