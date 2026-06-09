'use client'
import { signIn } from 'next-auth/react'
import { Lock } from 'lucide-react'

interface Props {
  tabName: string
}

const GOOGLE_ICON = (
  <svg viewBox="0 0 24 24" className="w-4 h-4 shrink-0" aria-hidden="true">
    <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
    <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
    <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
    <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
  </svg>
)

export default function GatedTabOverlay({ tabName }: Props) {
  function handleSignIn() {
    signIn('google', {
      callbackUrl: typeof window !== 'undefined' ? window.location.href : '/',
    })
  }

  return (
    <div className="flex flex-col items-center justify-center min-h-[420px] py-14 px-4 text-center">
      {/* Lock icon */}
      <div className="w-12 h-12 rounded-xl bg-[#EEF4DD] border border-[#BFD2A1] flex items-center justify-center mb-5">
        <Lock size={20} className="text-[#5F790B]" strokeWidth={2} />
      </div>

      {/* Headline */}
      <h3 className="text-[20px] font-bold text-[#111111] tracking-tight mb-2">
        Sign in to view {tabName}
      </h3>

      {/* Sub-copy */}
      <p className="text-[14px] text-[#6B6B6B] max-w-xs leading-relaxed mb-6">
        Free account. No credit card. Takes 10 seconds with Google.
      </p>

      {/* Free feature list */}
      <ul className="text-left space-y-2 mb-7 max-w-[260px] w-full">
        {[
          'Full DCF + 5 valuation methods',
          'Bear / Base / Bull scenarios',
          'Financial health scores',
          'Risk signals and insider data',
          'News and analyst sentiment',
        ].map((f) => (
          <li key={f} className="flex items-center gap-2.5 text-[13px] text-[#566174]">
            <span className="w-4 h-4 rounded-full bg-[#E8F7EF] flex items-center justify-center shrink-0 text-[9px] font-bold text-[#11875D]">✓</span>
            {f}
          </li>
        ))}
      </ul>

      {/* CTA */}
      <button
        onClick={handleSignIn}
        className="flex items-center justify-center gap-2.5 rounded-xl bg-[#5F790B] hover:bg-[#526A08] active:scale-[0.99] text-white font-semibold text-[14px] px-7 py-3.5 min-h-[48px] transition-all"
        style={{ boxShadow: '0 4px 12px rgba(95,121,11,0.25)' }}
      >
        {GOOGLE_ICON}
        Continue with Google
      </button>

      <p className="text-[11px] text-[#9B9B9B] mt-3">
        Free forever — no credit card required
      </p>
    </div>
  )
}
