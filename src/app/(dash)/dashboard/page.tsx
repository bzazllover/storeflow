import { supabaseServer } from '@/lib/supabase-server'
import SalesChart from '@/components/SalesChart'

function money(n: number, cur = 'DZD') {
  return new Intl.NumberFormat('en', { maximumFractionDigits: 0 }).format(n) + ' ' + cur
}

export default async function Dashboard() {
  const supabase = await supabaseServer()
  const today = new Date(); today.setHours(0, 0, 0, 0)
  const since = new Date(Date.now() - 13 * 864e5).toISOString().slice(0, 10)

  const [{ data: todaySales }, { data: daily }, { data: low }, { data: best }] =
    await Promise.all([
      supabase.from('sales').select('total, cost_total, tax')
        .gte('created_at', today.toISOString()).eq('status', 'completed'),
      supabase.from('v_daily_sales').select('*').gte('day', since).order('day'),
      supabase.from('v_low_stock').select('*').limit(8),
      supabase.from('v_best_sellers').select('*').order('qty_sold', { ascending: false }).limit(5),
    ])

  const revToday = (todaySales ?? []).reduce((s, r) => s + Number(r.total), 0)
  const profitToday = (todaySales ?? []).reduce(
    (s, r) => s + (Number(r.total) - Number(r.cost_total) - Number(r.tax)), 0)
  const countToday = todaySales?.length ?? 0
  const chart = (daily ?? []).map(d => ({
    day: String(d.day).slice(5), revenue: Number(d.revenue), profit: Number(d.profit),
  }))

  const kpis = [
    { label: 'Sales today', value: String(countToday) },
    { label: 'Revenue today', value: money(revToday) },
    { label: 'Profit today', value: money(profitToday) },
    { label: 'Low-stock items', value: String(low?.length ?? 0), warn: (low?.length ?? 0) > 0 },
  ]

  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-semibold tracking-tight">Dashboard</h1>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {kpis.map(k => (
          <div key={k.label} className="card p-4">
            <div className="text-xs text-slate-400">{k.label}</div>
            <div className={`text-2xl font-semibold mt-1 ${k.warn ? 'text-warn' : ''}`}>{k.value}</div>
          </div>
        ))}
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="card p-5 lg:col-span-2">
          <div className="text-sm font-medium mb-4">Revenue · last 14 days</div>
          <SalesChart data={chart} />
        </div>
        <div className="card p-5">
          <div className="text-sm font-medium mb-3">Best sellers</div>
          <div className="space-y-2">
            {(best ?? []).map((b: any) => (
              <div key={b.product_id} className="flex justify-between text-sm">
                <span className="truncate">{b.name}</span>
                <span className="text-slate-400">{Number(b.qty_sold)}×</span>
              </div>
            ))}
            {!best?.length && <p className="text-sm text-slate-500">No sales yet.</p>}
          </div>
        </div>
      </div>

      <div className="card p-5">
        <div className="text-sm font-medium mb-3">Low-stock alerts</div>
        {low?.length ? (
          <table className="tbl">
            <thead><tr><th>Product</th><th>SKU</th><th>In stock</th><th>Min</th></tr></thead>
            <tbody>
              {low.map((p: any) => (
                <tr key={p.id}>
                  <td>{p.name}</td>
                  <td className="font-mono text-xs text-slate-400">{p.sku}</td>
                  <td className="text-warn">{Number(p.stock_qty)}</td>
                  <td className="text-slate-400">{Number(p.min_stock)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : <p className="text-sm text-slate-500">Everything is well stocked.</p>}
      </div>
    </div>
  )
}
