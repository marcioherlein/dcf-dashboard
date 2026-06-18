'use client'
import { signIn } from 'next-auth/react'
import { X, Check } from 'lucide-react'

interface Props {
  ticker: string
  name: string | null
  valueScore: number | null
  onClose: () => void
}

function scoreLabel(score: number | null): { text: string; color: string } {
  if (score == null) return { text: '—', color: '#8A95A6' }
  if (score >= 70)   return { text: 'Deep Value',  color: '#11875D' }
  if (score >= 50)   return { text: 'Fair Value',  color: '#2563EB' }
  if (score >= 30)   return { text: 'Stretched',   color: '#B56A00' }
  return               { text: 'Expensive',  color: '#D83B3B' }
}

export default function ETFLoginToSaveModal({ ticker, name, valueScore, onClose }: Props) {
  const { text: scoreText, color: scoreColor } = scoreLabel(valueScore)

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4" onClick={onClose}>
      <div className="absolute inset-0 bg-black/30 backdrop-blur-[2px]" />
      <div
        className="relative w-full max-w-sm rounded-2xl bg-white shadow-xl border border-[#E3E1DA] overflow-hidden"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-3">
          <h2 className="text-[16px] font-bold text-[#06101F]">Sign in to save your watchlist</h2>
          <button
            onClick={onClose}
            className="min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg text-[#8A95A6] hover:text-[#06101F] hover:bg-[#F0F1F6] transition-colors"
          >
            <X size={16} strokeWidth={2.5} />
          </button>
        </div>

        {/* Preview of what gets saved */}
        <div className="px-5 pb-4">
          <div className="rounded-xl bg-[#F0F1F6] border border-[#E3E1DA] px-4 py-3 flex items-center justify-between gap-3">
            <div className="min-w-0">
              <p className="text-[13px] font-bold text-[#06101F] tabular-nums">{ticker}</p>
              {name && <p className="text-[11px] text-[#566174] truncate">{name}</p>}
            </div>
            {valueScore != null && (
              <div className="text-right shrink-0">
                <p className="text-[11px] text-[#566174]">Value Score</p>
                <p className="text-[20px] font-[800] tabular-nums leading-none" style={{ color: scoreColor }}>{valueScore}</p>
                <p className="text-[11px] font-semibold" style={{ color: scoreColor }}>{scoreText}</p>
              </div>
            )}
          </div>
        </div>

        <div className="px-5 pb-2 space-y-1.5">
          {[
            'Watchlist syncs across all your devices',
            'Access your ETFs when you log in anywhere',
            'Your scores and history stay with you',
          ].map(f => (
            <div key={f} className="flex items-center gap-2">
              <Check size={13} className="text-[#11875D] shrink-0" strokeWidth={2.5} />
              <span className="text-[12px] text-[#566174]">{f}</span>
            </div>
          ))}
        </div>

        <div className="px-5 py-4">
          <button
            onClick={() => {
              try {
                localStorage.setItem('etf_pre_login', JSON.stringify({ intent: 'watchlist', ticker }))
              } catch {}
              signIn('google', { callbackUrl: window.location.href })
            }}
            className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-[#5F790B] hover:bg-[#6F8F12] active:bg-[#5F790B] text-white font-semibold text-[14px] py-3 transition-colors shadow-sm"
          >
            <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
              <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
              <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
              <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
              <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84z"/>
            </svg>
            Continue with Google
          </button>
          <p className="text-center text-[11px] text-[#8A95A6] mt-2">Free to sign in — no credit card</p>
        </div>
      </div>
    </div>
  )
}
