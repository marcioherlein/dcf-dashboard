'use client'
import { signIn } from 'next-auth/react'
import { Check } from 'lucide-react'

interface Props {
  ticker: string
  companyName: string
  price: number | null
  currency: string
  fairValue: number | null
  upsidePct: number | null
  scenarios: {
    bull: { fairValue: number }
    base: { fairValue: number }
    bear: { fairValue: number }
  } | null
  grade: string | null
}

const FEATURES = [
  'Full DCF & 5 valuation methods',
  'Bear / Base / Bull scenarios',
  'Financial health scores',
  'Risk signals & insider data',
  'News & analyst sentiment',
]

function fmt(n: number, currency: string) {
  return `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function StockLoginWall({ ticker, companyName, price, currency, fairValue, upsidePct, scenarios, grade }: Props) {
  const upside = upsidePct ?? 0
  const isUndervalued = upside > 0

  return (
    <div className="pt-6 pb-16 px-1 max-w-md mx-auto flex flex-col gap-6">

      {/* Teaser card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-blue-600 to-indigo-600 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-blue-100 text-[11px] font-semibold uppercase tracking-wider mb-0.5">{ticker}</p>
              <h2 className="text-white font-bold text-[17px] leading-tight">{companyName}</h2>
              {price != null && (
                <p className="text-blue-100 text-[14px] font-medium mt-0.5">
                  {fmt(price, currency)}
                </p>
              )}
            </div>
            {grade && (
              <span className="shrink-0 text-[13px] font-bold px-2.5 py-1 rounded-lg bg-white/20 text-white border border-white/30">
                {grade}
              </span>
            )}
          </div>
        </div>

        <div className="px-5 py-4 space-y-3">
          {fairValue != null && (
            <div className="flex items-center justify-between gap-2 rounded-xl bg-slate-50 border border-slate-100 px-4 py-3">
              <div>
                <p className="text-[11px] text-slate-500 font-medium">Fair Value</p>
                <p className="text-[16px] font-bold text-slate-800 tabular-nums">{fmt(fairValue, currency)}</p>
              </div>
              {upsidePct != null && (
                <span className={`text-[13px] font-bold px-2.5 py-1 rounded-lg ${isUndervalued ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {isUndervalued ? '+' : ''}{upside.toFixed(1)}% {isUndervalued ? 'upside' : 'downside'}
                </span>
              )}
            </div>
          )}

          {scenarios && (
            <div className="grid grid-cols-3 gap-2">
              {(['bear', 'base', 'bull'] as const).map(s => (
                <div key={s} className={`rounded-lg border px-3 py-2 text-center ${
                  s === 'bull' ? 'border-emerald-100 bg-emerald-50' :
                  s === 'bear' ? 'border-red-100 bg-red-50' :
                  'border-blue-100 bg-blue-50'
                }`}>
                  <p className={`text-[10px] font-semibold uppercase tracking-wide mb-0.5 ${
                    s === 'bull' ? 'text-emerald-600' : s === 'bear' ? 'text-red-500' : 'text-blue-600'
                  }`}>{s}</p>
                  <p className="text-[13px] font-bold text-slate-800 tabular-nums blur-sm select-none">{fmt(scenarios[s].fairValue, currency)}</p>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Sign in CTA */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-5 space-y-4">
        <div>
          <h3 className="text-[16px] font-bold text-slate-900 mb-1">Sign in free to unlock</h3>
          <p className="text-[13px] text-slate-500">5 free analyses per month — no credit card required</p>
        </div>

        <ul className="space-y-2">
          {FEATURES.map(f => (
            <li key={f} className="flex items-center gap-2.5">
              <Check size={14} className="text-emerald-500 shrink-0" strokeWidth={2.5} />
              <span className="text-[13px] text-slate-700">{f}</span>
            </li>
          ))}
        </ul>

        <button
          onClick={() => signIn('google', { callbackUrl: window.location.href })}
          className="w-full flex items-center justify-center gap-2.5 rounded-xl bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white font-semibold text-[14px] py-3 transition-colors shadow-sm"
        >
          <svg viewBox="0 0 24 24" className="w-4 h-4" aria-hidden="true">
            <path fill="#fff" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/>
            <path fill="#fff" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/>
            <path fill="#fff" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l3.66-2.84z"/>
            <path fill="#fff" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/>
          </svg>
          Continue with Google
        </button>
        <p className="text-center text-[11px] text-slate-400">No credit card — free forever</p>
      </div>
    </div>
  )
}
