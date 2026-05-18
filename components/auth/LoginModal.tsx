'use client'
import { signIn } from 'next-auth/react'
import { X } from 'lucide-react'
import { useEffect } from 'react'

interface Props {
  onClose: () => void
  /** Optional custom headline — defaults to the analysis-ready copy */
  headline?: string
}

export default function LoginModal({ onClose, headline }: Props) {
  // Close on Escape
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8 text-center"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <svg className="h-7 w-7 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.8}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>

        <h2 className="text-lg font-bold text-slate-900 leading-snug">
          {headline ?? 'Your analysis is ready — sign in to unlock it.'}
        </h2>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          Free to join. No credit card. 30 seconds.
        </p>

        <button
          onClick={() => signIn('google')}
          className="mt-6 flex w-full items-center justify-center gap-3 rounded-xl border border-slate-200 bg-white py-3 px-4 text-sm font-semibold text-slate-800 shadow-sm hover:bg-slate-50 active:scale-[0.98] transition-all"
        >
          {/* Google G logo */}
          <svg className="h-5 w-5" viewBox="0 0 24 24">
            <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" fill="#4285F4"/>
            <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#34A853"/>
            <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z" fill="#FBBC05"/>
            <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#EA4335"/>
          </svg>
          Continue with Google
        </button>

        <p className="mt-5 text-[11px] text-slate-400">
          Unlimited stock analysis is always free.
        </p>
      </div>
    </div>
  )
}
