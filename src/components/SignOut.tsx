'use client'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function SignOut() {
  const router = useRouter()
  return (
    <button className="btn-ghost w-full text-xs"
      onClick={async () => {
        await supabaseBrowser().auth.signOut()
        router.push('/login'); router.refresh()
      }}>
      Sign out
    </button>
  )
}
