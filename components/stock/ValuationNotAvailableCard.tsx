'use client'

interface Props {
  vetoReasons: string[]
  ticker: string
}

export default function ValuationNotAvailableCard({ vetoReasons, ticker }: Props) {
  return (
    <div className="rounded-xl border border-amber-200 bg-amber-50/60 px-6 py-5 flex flex-col gap-3">
      <div className="flex items-center gap-2">
        <span className="text-amber-500 text-base">⚠</span>
        <p className="text-sm font-semibold text-amber-800">
          DCF valuation not available for {ticker}
        </p>
      </div>
      <ul className="space-y-1.5">
        {vetoReasons.map((r, i) => (
          <li key={i} className="text-xs text-amber-700 leading-relaxed">• {r}</li>
        ))}
      </ul>
      <p className="text-[11px] text-slate-500 border-t border-amber-100 pt-3">
        Price data, financials, and analyst estimates are still available on the other tabs.
      </p>
    </div>
  )
}
