import Link from 'next/link'
import { redirect } from 'next/navigation'
import { supabaseServer } from '@/lib/supabase-server'
import SignOut from '@/components/SignOut'

const NAV = [
  { href: '/dashboard', label: 'Dashboard' },
  { href: '/pos', label: 'Point of Sale' },
  { href: '/products', label: 'Products' },
  { href: '/inventory', label: 'Inventory' },
  { href: '/customers', label: 'Customers' },
  { href: '/reports', label: 'Reports' },
]

export default async function DashLayout({ children }: { children: React.ReactNode }) {
  const supabase = await supabaseServer()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/login')

  const { data: profile } = await supabase
    .from('profiles').select('full_name, role, stores(name)').eq('id', user.id).single()

  return (
    <div className="flex min-h-screen">
      <aside className="w-60 shrink-0 border-r border-line bg-panel flex flex-col">
        <div className="p-5 border-b border-line">
          <div className="text-lg font-semibold">StoreFlow</div>
          <div className="text-xs text-slate-400 mt-0.5">
            {(profile?.stores as any)?.name ?? 'Your store'}
          </div>
        </div>
        <nav className="flex-1 p-3 space-y-1">
          {NAV.map(n => (
            <Link key={n.href} href={n.href}
              className="block rounded-lg px-3 py-2 text-sm text-slate-300 hover:bg-line">
              {n.label}
            </Link>
          ))}
        </nav>
        <div className="p-3 border-t border-line">
          <div className="text-xs text-slate-400 mb-2">
            {profile?.full_name} · <span className="capitalize">{profile?.role}</span>
          </div>
          <SignOut />
        </div>
      </aside>
      <main className="flex-1 p-6 max-w-[1400px]">{children}</main>
    </div>
  )
}
