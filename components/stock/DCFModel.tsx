'use client'
import { fmt, fmtPct } from '@/lib/utils'

interface CFRow { year: number; cashFlow: number; discounted: number }
interface FairValue {
  ev: number; cash: number; debt: number; marketCap: number
  equityValue: number; sharesOutstanding: number
  fairValuePerShare: number; currentPrice: number; upsidePct: number; irr: number
}
interface Scenarios {
  bull: { fairValue: number; wacc: number; cagr: number }
  base: { fairValue: number; wacc: number; cagr: number }
  bear: { fairValue: number; wacc: number; cagr: number }
}
interface Props {
  projections: CFRow[]; terminalValue: number; terminalValueDiscounted: number
  sumPV: number; ev: number; fairValue: FairValue
  wacc: number; cagr: number; terminalG: number; scenarios: Scenarios
}

export default function DCFModel({ projections, terminalValue, terminalValueDiscounted, fairValue, wacc, cagr, terminalG, scenarios }: Props) {
  const up = fairValue.upsidePct >= 0

  return (
    <div className="space-y-4">
      <div className="overflow-x-auto rounded-2xl border border-black/[0.06] bg-white shadow-sm dark:border-white/8 dark:bg-[#111]">
        <div className="px-6 pt-5 pb-2">
          <div className="flex flex-wrap items-center gap-4">
            <h2 className="text-sm font-semibold text-gray-700 dark:text-white/70">DCF Model</h2>
            <div className="flex gap-4 text-xs text-gray-500 dark:text-white/30">
              <span>WACC <strong className="text-gray-800 dark:text-white/70">{fmtPct(wacc)}</strong></span>
              <span>CAGR <strong className="text-gray-800 dark:text-white/70">{fmtPct(cagr)}</strong></span>
              <span>Terminal g <strong className="text-gray-800 dark:text-white/70">{fmtPct(terminalG)}</strong></span>
            </div>
          </div>
        </div>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50 dark:bg-white/5">
            <tr>
              <td className="px-4 py-2 text-xs font-medium text-gray-500 dark:text-white/25">DCF MODEL</td>
              {(projections ?? []).map((p) => (
                <td key={p.year} className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-white/25">{p.year}</td>
              ))}
              <td className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-white/25">TV</td>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100 dark:border-white/5">
              <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-white/25">CF (M)</td>
              {(projections ?? []).map((p) => (
                <td key={p.year} className="px-3 py-2.5 text-center text-sm font-medium text-gray-800 dark:text-white/80">{fmt(p.cashFlow, 0)}</td>
              ))}
              <td className="px-3 py-2.5 text-center text-sm font-medium text-gray-800 dark:text-white/80">{fmt(terminalValue, 0)}</td>
            </tr>
            <tr className="border-t border-gray-100 bg-gray-50 dark:border-white/5 dark:bg-white/[0.03]">
              <td className="px-4 py-2.5 text-xs text-gray-500 dark:text-white/25">DCF (M)</td>
              {(projections ?? []).map((p) => (
                <td key={p.year} className="px-3 py-2.5 text-center text-sm text-gray-600 dark:text-white/50">{fmt(p.discounted, 0)}</td>
              ))}
              <td className="px-3 py-2.5 text-center text-sm text-gray-600 dark:text-white/50">{fmt(terminalValueDiscounted, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#111]">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/25">Enterprise Value Bridge</h3>
          <div className="mt-4 space-y-2 text-sm">
            {[
              { label: 'EV',           value: `$ ${fmt(fairValue.ev / 1000, 2)}B`,        g: false, r: false, b: false },
              { label: 'CASH (+)',     value: `$ ${fmt(fairValue.cash, 0)}M`,              g: true,  r: false, b: false },
              { label: 'DEBT (−)',     value: `$ ${fmt(fairValue.debt, 0)}M`,              g: false, r: true,  b: false },
              { label: 'MKT CAP',     value: `$ ${fmt(fairValue.marketCap / 1000, 2)}B`,  g: false, r: false, b: false },
              { label: 'SHARES OUT.', value: `${fmt(fairValue.sharesOutstanding, 0)}M`,   g: false, r: false, b: false },
              { label: 'FAIR VALUE',  value: `$ ${fmt(fairValue.fairValuePerShare)}`,      g: false, r: false, b: true },
              { label: 'PRICE',       value: `$ ${fmt(fairValue.currentPrice)}`,           g: false, r: false, b: false },
            ].map((row) => (
              <div key={row.label} className={`flex justify-between border-b border-gray-100 pb-1.5 dark:border-white/5 ${row.b ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-600 dark:text-white/50'}`}>
                <span className={row.g ? 'text-emerald-600 dark:text-emerald-400' : row.r ? 'text-red-500 dark:text-red-400' : ''}>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
            <div className={`flex justify-between pt-1 font-bold text-base ${up ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-600 dark:text-red-400'}`}>
              <span>UPSIDE POTENTIAL</span>
              <span>{up ? '+' : ''}{fmtPct(fairValue.upsidePct)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500 dark:text-white/30">
              <span>IRR (5Y)</span><span>{fmtPct(fairValue.irr)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-black/[0.06] bg-white p-5 shadow-sm dark:border-white/8 dark:bg-[#111]">
          <h3 className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/25">Scenarios</h3>
          <div className="mt-4 space-y-3">
            {([
              { label: 'Bull', key: 'bull', cls: 'text-emerald-600 bg-emerald-50 dark:bg-emerald-500/10 dark:text-emerald-400' },
              { label: 'Base', key: 'base', cls: 'text-blue-600 bg-blue-50 dark:bg-blue-500/10 dark:text-blue-400' },
              { label: 'Bear', key: 'bear', cls: 'text-red-600 bg-red-50 dark:bg-red-500/10 dark:text-red-400' },
            ] as const).map((s) => {
              const sc = scenarios[s.key]
              const upside = ((sc.fairValue - fairValue.currentPrice) / fairValue.currentPrice) * 100
              return (
                <div key={s.key} className={`rounded-xl px-4 py-3 ${s.cls}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span className="text-lg font-bold" style={{ letterSpacing: '-0.02em' }}>${fmt(sc.fairValue)}</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-xs opacity-70">
                    <span>WACC {fmtPct(sc.wacc)}</span>
                    <span>CAGR {fmtPct(sc.cagr)}</span>
                    <span className="ml-auto font-medium">{upside >= 0 ? '+' : ''}{upside.toFixed(1)}%</span>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
