import { supabaseServer } from '@/lib/supabase-server'

export default async function CustomersPage() {
  const supabase = await supabaseServer()
  const { data: customers } = await supabase
    .from('customers').select('id,name,phone,loyalty_points,balance').order('name')

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Customers</h1>
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>Name</th><th>Phone</th><th>Loyalty points</th><th>Balance</th></tr></thead>
          <tbody>
            {(customers ?? []).map((c: any) => (
              <tr key={c.id}>
                <td className="font-medium">{c.name}</td>
                <td className="text-slate-400">{c.phone ?? '—'}</td>
                <td>{c.loyalty_points}</td>
                <td className={Number(c.balance) < 0 ? 'text-bad' : ''}>{Number(c.balance)}</td>
              </tr>
            ))}
            {!customers?.length && <tr><td colSpan={4} className="text-center text-slate-500 py-8">No customers yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
