import { supabaseServer } from '@/lib/supabase-server'
import PosClient from '@/components/PosClient'

export default async function PosPage() {
  const supabase = await supabaseServer()
  const [{ data: products }, { data: customers }, { data: store }] = await Promise.all([
    supabase.from('products').select('id,name,sku,barcode,selling_price,stock_qty').eq('active', true).order('name'),
    supabase.from('customers').select('id,name').order('name'),
    supabase.from('stores').select('tax_rate,currency').limit(1).single(),
  ])
  return (
    <PosClient
      products={products ?? []}
      customers={customers ?? []}
      taxRate={Number(store?.tax_rate ?? 0)}
      currency={store?.currency ?? 'DZD'}
    />
  )
}
