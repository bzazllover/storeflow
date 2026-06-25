import { supabaseServer } from '@/lib/supabase-server'

function money(n: number) { return new Intl.NumberFormat('en').format(Math.round(n)) }

export default async function ReportsPage() {
  const supabase = await supabaseServer()
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0)

  const [{ data: sales }, { data: inv }, { data: expenses }] = await Promise.all([
    supabase.from('sales').select('total,cost_total,tax').gte('created_at', monthStart.toISOString()).eq('status','completed'),
    supabase.from('v_inventory_value').select('*').single(),
    supabase.from('expenses').select('amount').gte('spent_at', monthStart.toISOString().slice(0,10)),
  ])

  const revenue = (sales ?? []).reduce((s,r)=>s+Number(r.total),0)
  const grossProfit = (sales ?? []).reduce((s,r)=>s+(Number(r.total)-Number(r.cost_total)-Number(r.tax)),0)
  const expTotal = (expenses ?? []).reduce((s,r)=>s+Number(r.amount),0)
  const net = grossProfit - expTotal

  const rows = [
    ['Revenue (this month)', money(revenue)],
    ['Gross profit', money(grossProfit)],
    ['Expenses', '-' + money(expTotal)],
    ['Net profit', money(net)],
    ['Inventory value (cost)', money(Number(inv?.value_at_cost ?? 0))],
    ['Inventory value (retail)', money(Number(inv?.value_at_retail ?? 0))],
  ]

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Reports · this month</h1>
      <p className="text-sm text-slate-400">
        Profit &amp; loss summary. PDF/Excel export hooks are wired in the API layer — see README.
      </p>
      <div className="card p-5 max-w-md">
        <table className="tbl">
          <tbody>
            {rows.map(([k,v]) => (
              <tr key={k}><td className="text-slate-400">{k}</td><td className="text-right font-medium">{v}</td></tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
