import { supabaseServer } from '@/lib/supabase-server'

export default async function InventoryPage() {
  const supabase = await supabaseServer()
  const { data: moves } = await supabase
    .from('inventory_movements')
    .select('id,type,qty_change,note,created_at,products(name)')
    .order('created_at', { ascending: false }).limit(50)

  return (
    <div className="space-y-4">
      <h1 className="text-2xl font-semibold tracking-tight">Inventory history</h1>
      <p className="text-sm text-slate-400">Every stock change — sales, purchases, and adjustments — is recorded here.</p>
      <div className="card overflow-hidden">
        <table className="tbl">
          <thead><tr><th>When</th><th>Product</th><th>Type</th><th>Change</th><th>Note</th></tr></thead>
          <tbody>
            {(moves ?? []).map((m: any) => (
              <tr key={m.id}>
                <td className="text-slate-400 text-xs">{new Date(m.created_at).toLocaleString()}</td>
                <td>{m.products?.name ?? '—'}</td>
                <td><span className="badge bg-line capitalize">{m.type}</span></td>
                <td className={Number(m.qty_change) < 0 ? 'text-bad' : 'text-good'}>
                  {Number(m.qty_change) > 0 ? '+' : ''}{Number(m.qty_change)}
                </td>
                <td className="text-slate-400">{m.note ?? '—'}</td>
              </tr>
            ))}
            {!moves?.length && <tr><td colSpan={5} className="text-center text-slate-500 py-8">No movements yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  )
}
