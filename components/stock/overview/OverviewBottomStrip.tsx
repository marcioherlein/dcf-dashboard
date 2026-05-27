'use client'
import { cn } from '@/lib/utils'

interface Props {
  // Drivers for "What supports"
  drivers: string[]
  // Ratings for risk bullets
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ratings: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  cagrAnalysis: any
  // Callbacks
  onViewValuation: () => void
  onViewRisks: () => void
  onSave?: () => void
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function buildRiskBullets(ratings: any, cagrAnalysis: any): string[] {
  const bullets: string[] = []
  if (cagrAnalysis?.drivers) {
    const riskDrivers = (cagrAnalysis.drivers as string[]).filter(d =>
      /risk|slow|compet|decline|margin|debt|regul|geopolit|uncertain|challeng|pressur/i.test(d)
    )
    bullets.push(...riskDrivers.slice(0, 2))
  }
  const cats = ['growth', 'profitability', 'moat', 'liquidity', 'valuation'] as const
  for (const key of cats) {
    if (bullets.length >= 4) break
    const cat = ratings?.[key]
    if (!cat) continue
    if (cat.score < 55 && cat.summary) bullets.push(cat.summary)
  }
  if (bullets.length === 0 && cagrAnalysis?.drivers?.length) {
    bullets.push(...(cagrAnalysis.drivers as string[]).slice(0, 2))
  }
  return bullets.slice(0, 4)
}

export default function OverviewBottomStrip({ drivers, ratings, cagrAnalysis, onViewValuation, onViewRisks, onSave }: Props) {
  const riskBullets = buildRiskBullets(ratings, cagrAnalysis)
  const supportDrivers = (drivers ?? []).slice(0, 4)

  return (
    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">

      {/* ── Column 1: What supports ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-emerald-500 text-base leading-none">🛡</span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">What Supports the Valuation?</p>
        </div>
        {supportDrivers.length > 0 ? (
          <ul className="space-y-2">
            {supportDrivers.map((d, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="text-emerald-500 mt-0.5 shrink-0">✓</span>
                <span className="text-[12px] text-slate-600 leading-relaxed">{d}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-slate-400">No drivers available.</p>
        )}
        {ratings?.moat?.summary && (
          <p className="text-[10px] text-slate-400 mt-3 leading-relaxed border-t border-slate-100 pt-2">
            {ratings.moat.summary}
          </p>
        )}
      </div>

      {/* ── Column 2: What could go wrong ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-red-500 text-base leading-none">⚠</span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">What Could Go Wrong?</p>
        </div>
        {riskBullets.length > 0 ? (
          <ul className="space-y-2">
            {riskBullets.map((b, i) => (
              <li key={i} className="flex items-start gap-2">
                <span className="w-1.5 h-1.5 rounded-full bg-red-400 mt-1.5 shrink-0" />
                <span className="text-[12px] text-slate-600 leading-relaxed">{b}</span>
              </li>
            ))}
          </ul>
        ) : (
          <p className="text-[12px] text-slate-400">No risk data available.</p>
        )}
        <button
          onClick={onViewRisks}
          className="mt-3 text-[11px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
        >
          View risks →
        </button>
      </div>

      {/* ── Column 3: Next step ── */}
      <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-sm flex flex-col">
        <div className="flex items-center gap-2 mb-3">
          <span className="text-blue-500 text-base leading-none">🚩</span>
          <p className="text-[11px] font-bold uppercase tracking-widest text-slate-600">Next Step</p>
        </div>
        <p className="text-[12px] text-slate-500 leading-relaxed mb-4">
          Dig deeper or track this idea over time.
        </p>
        <div className="space-y-2 mt-auto">
          <button
            onClick={onViewValuation}
            className={cn(
              'w-full rounded-xl py-2.5 text-[12px] font-semibold text-white transition-all',
              'bg-gradient-to-r from-blue-600 to-blue-500 hover:from-blue-700 hover:to-blue-600 active:scale-95 shadow-sm'
            )}
          >
            View valuation tab →
          </button>
          <button
            onClick={onViewValuation}
            className="w-full rounded-xl py-2.5 text-[12px] font-semibold text-blue-600 border border-blue-200 bg-blue-50 hover:bg-blue-100 transition-colors"
          >
            Review assumptions
          </button>
          {onSave && (
            <button
              onClick={onSave}
              className="w-full rounded-xl py-2.5 text-[12px] font-semibold text-slate-600 border border-slate-200 hover:bg-slate-50 transition-colors"
            >
              Add to watchlist
            </button>
          )}
        </div>
      </div>

    </div>
  )
}
