import { supabaseServer } from '@/lib/supabase-server'
import ProductsClient from '@/components/ProductsClient'

export default async function ProductsPage() {
  const supabase = await supabaseServer()
  const [{ data: products }, { data: categories }] = await Promise.all([
    supabase.from('products')
      .select('id,name,sku,barcode,cost_price,selling_price,stock_qty,min_stock,category_id,categories(name)')
      .order('created_at', { ascending: false }),
    supabase.from('categories').select('id,name').order('name'),
  ])
  return <ProductsClient products={products ?? []} categories={categories ?? []} />
}
