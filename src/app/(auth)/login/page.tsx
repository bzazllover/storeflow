'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabaseBrowser } from '@/lib/supabase-browser'

export default function LoginPage() {
  const router = useRouter()
  const supabase = supabaseBrowser()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [mode, setMode] = useState<'login' | 'reset'>('login')
  const [err, setErr] = useState<string | null>(null)
  const [msg, setMsg] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)

  async function submit() {
    setErr(null); setMsg(null); setBusy(true)
    if (mode === 'reset') {
      const { error } = await supabase.auth.resetPasswordForEmail(email)
      setBusy(false)
      if (error) return setErr(error.message)
      return setMsg('Check your email for a reset link.')
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    setBusy(false)
    if (error) return setErr(error.message)
    router.push('/dashboard'); router.refresh()
  }

  return (
    <div className="min-h-screen grid place-items-center p-6">
      <div className="card w-full max-w-sm p-8">
        <div className="mb-6">
          <div className="text-2xl font-semibold tracking-tight">StoreFlow</div>
          <p className="text-sm text-slate-400 mt-1">Sign in to your store.</p>
        </div>
        <div className="space-y-3">
          <div>
            <label className="label">Email</label>
            <input className="input" type="email" value={email}
              onChange={e => setEmail(e.target.value)} placeholder="you@store.com" />
          </div>
          {mode === 'login' && (
            <div>
              <label className="label">Password</label>
              <input className="input" type="password" value={password}
                onChange={e => setPassword(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && submit()} />
            </div>
          )}
          {err && <p className="text-bad text-sm">{err}</p>}
          {msg && <p className="text-good text-sm">{msg}</p>}
          <button className="btn-primary w-full" onClick={submit} disabled={busy}>
            {busy ? 'Working…' : mode === 'login' ? 'Sign in' : 'Send reset link'}
          </button>
          <button className="text-xs text-slate-400 hover:text-slate-200"
            onClick={() => setMode(mode === 'login' ? 'reset' : 'login')}>
            {mode === 'login' ? 'Forgot password?' : 'Back to sign in'}
          </button>
        </div>
      </div>
    </div>
  )
}
