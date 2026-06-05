'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession, signIn } from 'next-auth/react'
import { CheckCircle, ArrowRight } from 'lucide-react'
import { InsicLogoLockup } from '@/components/ui/InsicLogo'

export default function RedeemPage() {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [code, setCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [error, setError] = useState('')

  const handleRedeem = async () => {
    if (!code.trim()) return
    setLoading(true)
    setError('')
    try {
      const res = await fetch('/api/promo/redeem', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ code }),
      })
      const data = await res.json()
      if (data.ok) {
        setSuccess(true)
      } else {
        setError(data.error ?? 'Something went wrong. Please try again.')
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-dvh bg-slate-50 flex items-center justify-center px-4 py-16">
      <div className="w-full max-w-sm">

        {/* Logo */}
        <div className="flex justify-center mb-8">
          <InsicLogoLockup size="md" />
        </div>

        {!session && status !== 'loading' ? (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-8 text-center space-y-4">
            <h1 className="text-[18px] font-bold text-slate-900">Redeem your Pro code</h1>
            <p className="text-[14px] text-slate-500">Sign in first to activate your Pro access.</p>
            <button
              onClick={() => signIn('google', { callbackUrl: '/redeem' })}
              className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-olive-700 hover:bg-olive-600 text-white font-semibold text-[14px] py-3 transition-colors"
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
                <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
                <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
                <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
                <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
              </svg>
              Continue with Google
            </button>
          </div>
        ) : success ? (
          <div className="bg-white rounded-2xl border border-emerald-200 shadow-sm px-6 py-8 text-center space-y-5">
            <div className="flex justify-center">
              <CheckCircle size={48} className="text-emerald-500" strokeWidth={1.5} />
            </div>
            <div>
              <h1 className="text-[18px] font-bold text-slate-900 mb-1">Pro activated!</h1>
              <p className="text-[14px] text-slate-500">You now have unlimited access to all analyses.</p>
            </div>
            <button
              onClick={() => router.push('/analyze')}
              className="w-full flex items-center justify-center gap-2 rounded-xl bg-olive-700 hover:bg-olive-600 text-white font-semibold text-[14px] py-3 transition-colors"
            >
              Go to app
              <ArrowRight size={15} strokeWidth={2.5} />
            </button>
          </div>
        ) : (
          <div className="bg-white rounded-2xl border border-slate-200 shadow-sm px-6 py-8 space-y-5">
            <div>
              <h1 className="text-[18px] font-bold text-slate-900 mb-1">Enter your Pro access code</h1>
              <p className="text-[13px] text-slate-500">Redeem a code for unlimited access to all analyses.</p>
            </div>

            <div className="space-y-3">
              <input
                type="text"
                value={code}
                onChange={e => { setCode(e.target.value.toUpperCase()); setError('') }}
                onKeyDown={e => { if (e.key === 'Enter') handleRedeem() }}
                placeholder="e.g. INSIC2024"
                className="w-full rounded-xl border border-slate-200 bg-slate-50 px-4 py-3 text-[15px] font-mono font-semibold text-slate-800 placeholder-slate-400 focus:outline-none focus:border-blue-400 focus:ring-2 focus:ring-olive-100 transition-all uppercase tracking-wider"
              />

              {error && (
                <p className="text-[12px] text-red-600 bg-red-50 border border-red-100 rounded-lg px-3 py-2">{error}</p>
              )}

              <button
                onClick={handleRedeem}
                disabled={loading || !code.trim()}
                className="w-full flex items-center justify-center gap-2 rounded-xl bg-olive-700 hover:bg-olive-600 active:bg-olive-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-semibold text-[14px] py-3 transition-colors"
              >
                {loading ? (
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                ) : 'Activate Pro'}
              </button>
            </div>

            <p className="text-center text-[12px] text-slate-400">
              Need a code?{' '}
              <a href="/pricing" className="text-olive-700 hover:underline">See pricing</a>
            </p>
          </div>
        )}
      </div>
    </div>
  )
}
