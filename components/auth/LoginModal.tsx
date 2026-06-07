'use client'
import { signIn } from 'next-auth/react'
import { X } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { track } from '@/lib/analytics/events'
import type { LoginIntent } from './LoginGateProvider'

const INTENT_COPY: Record<LoginIntent, { headline: string; sub: string }> = {
  save_valuation:     { headline: 'Save your valuation',         sub: 'Keep your DCF model and assumptions in one place.'      },
  export_report:      { headline: 'Export your report',          sub: 'Download a PDF of your full analysis.'                  },
  portfolio_tracking: { headline: 'Track in your portfolio',     sub: 'Monitor positions and fair value gaps in one view.'     },
  compare_models:     { headline: 'Save for comparison',         sub: 'Come back to this model any time.'                      },
  save_thesis:        { headline: 'Save your thesis',            sub: 'Keep your investment reasoning alongside the numbers.'  },
  create_alert:       { headline: 'Create a price alert',        sub: "We'll notify you when the fair value gap changes."      },
}

interface Props {
  onClose: () => void
  intent?: LoginIntent
  headline?: string
}

export default function LoginModal({ onClose, intent, headline }: Props) {
  const copy = intent ? INTENT_COPY[intent] : null
  const displayHeadline = headline ?? copy?.headline ?? 'Sign in to save your work'
  const displaySub      = copy?.sub ?? 'Free during beta. No credit card required.'
  const titleId = 'login-modal-title'
  const ctaRef = useRef<HTMLButtonElement>(null)

  const callbackUrl = typeof window !== 'undefined'
    ? window.location.pathname + window.location.search
    : '/'

  useEffect(() => {
    ctaRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  const handleSignIn = () => {
    track('login_started', { intent: intent ?? 'unknown', method: 'google' })
    signIn('google', { callbackUrl })
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm bg-white border border-[#E5E5E5] rounded-2xl shadow-2xl p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#6B6B6B] hover:text-[#6B6B6B] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#F5F5F5]"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4DD]">
          <svg className="h-7 w-7 text-[#5F790B]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 id={titleId} className="text-lg font-bold text-[#111111] leading-snug">
          {displayHeadline}
        </h2>
        <p className="mt-2 text-sm text-[#6B6B6B] leading-relaxed">
          {displaySub}
        </p>

        <button
          ref={ctaRef}
          onClick={handleSignIn}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-[#E5E5E5] bg-white py-3 px-4 text-sm font-semibold text-[#111111] shadow-sm hover:bg-[#F6FAEA] hover:border-[#BFD2A1] active:scale-[0.98] transition-all"
        >
          <svg className="h-5 w-5 shrink-0" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-5 text-[11px] text-[#6B6B6B]">
          insic is free during beta. No credit card required.
        </p>
      </div>
    </div>
  )
}
