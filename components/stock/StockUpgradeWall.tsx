'use client'
import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'

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
  viewCount: number
}

const LIMIT = 5

function fmt(n: number, currency: string) {
  return `${currency}${n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

export default function StockUpgradeWall({ ticker, companyName, price, currency, fairValue, upsidePct, scenarios, grade, viewCount }: Props) {
  const router = useRouter()
  const upside = upsidePct ?? 0
  const isUndervalued = upside > 0

  return (
    <div className="pt-6 pb-16 px-1 max-w-md mx-auto flex flex-col gap-6">

      {/* Teaser card */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-gradient-to-r from-slate-700 to-slate-800 px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <p className="text-slate-300 text-[11px] font-semibold uppercase tracking-wider mb-0.5">{ticker}</p>
              <h2 className="text-white font-bold text-[17px] leading-tight">{companyName}</h2>
              {price != null && (
                <p className="text-slate-300 text-[14px] font-medium mt-0.5">
                  {fmt(price, currency)}
                </p>
              )}
            </div>
            {grade && (
              <span className="shrink-0 text-[13px] font-bold px-2.5 py-1 rounded-lg bg-white/15 text-white border border-white/20">
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
                <p className="text-[16px] font-bold text-slate-800 tabular-nums blur-sm select-none">{fmt(fairValue, currency)}</p>
              </div>
              {upsidePct != null && (
                <span className={`text-[13px] font-bold px-2.5 py-1 rounded-lg blur-sm select-none ${isUndervalued ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-red-50 text-red-600 border border-red-100'}`}>
                  {isUndervalued ? '+' : ''}{upside.toFixed(1)}%
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

      {/* Upgrade CTA */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm px-5 py-5 space-y-4">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
            <Lock size={14} className="text-amber-600" strokeWidth={2.5} />
          </div>
          <div>
            <h3 className="text-[15px] font-bold text-slate-900">Monthly limit reached</h3>
            <p className="text-[12px] text-slate-500">Resets next month · Upgrade for unlimited access</p>
          </div>
        </div>

        {/* Usage indicator */}
        <div className="space-y-1.5">
          <div className="flex justify-between text-[11px] font-medium">
            <span className="text-slate-600">{viewCount} of {LIMIT} free analyses this month</span>
            <span className="text-amber-600">Limit reached</span>
          </div>
          <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
            <div
              className="h-full bg-amber-500 rounded-full transition-all"
              style={{ width: `${Math.min(100, (viewCount / LIMIT) * 100)}%` }}
            />
          </div>
        </div>

        <button
          disabled
          className="w-full flex items-center justify-center gap-2 rounded-xl bg-slate-300 text-slate-500 font-semibold text-[14px] py-3 cursor-not-allowed"
        >
          Coming soon — Pro plan launching shortly
        </button>

        <div className="flex items-center justify-center gap-4 text-[12px]">
          <button
            onClick={() => router.push('/redeem')}
            className="min-h-[44px] px-3 inline-flex items-center text-blue-600 hover:underline font-medium"
          >
            Have a code?
          </button>
          <span className="text-slate-300">·</span>
          <button
            onClick={() => router.back()}
            className="min-h-[44px] px-3 inline-flex items-center text-slate-500 hover:text-slate-700"
          >
            Go back
          </button>
        </div>
      </div>
    </div>
  )
}
