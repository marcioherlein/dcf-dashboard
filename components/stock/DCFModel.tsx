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
  projections: CFRow[]
  terminalValue: number
  terminalValueDiscounted: number
  sumPV: number
  ev: number
  fairValue: FairValue
  wacc: number
  cagr: number
  terminalG: number
  scenarios: Scenarios
}

export default function DCFModel({
  projections, terminalValue, terminalValueDiscounted, fairValue, wacc, cagr, terminalG, scenarios,
}: Props) {
  const up = fairValue.upsidePct >= 0

  return (
    <div className="space-y-6">
      {/* DCF table — matches screenshot */}
      <div className="overflow-x-auto rounded-2xl border border-gray-200 bg-white shadow-sm">
        <div className="px-6 pt-5 pb-2">
          <div className="flex items-center gap-6">
            <h2 className="text-sm font-semibold text-gray-700">DCF Model</h2>
            <div className="flex gap-4 text-xs text-gray-500">
              <span>WACC <strong className="text-gray-800">{fmtPct(wacc)}</strong></span>
              <span>CAGR <strong className="text-gray-800">{fmtPct(cagr)}</strong></span>
              <span>Terminal g <strong className="text-gray-800">{fmtPct(terminalG)}</strong></span>
            </div>
          </div>
        </div>
        <table className="w-full min-w-[900px] text-sm">
          <thead className="bg-gray-50">
            <tr>
              <td className="px-4 py-2 text-xs font-medium text-gray-500">DCF MODEL</td>
              {projections.map((p) => (
                <td key={p.year} className="px-3 py-2 text-center text-xs font-medium text-gray-500">{p.year}</td>
              ))}
              <td className="px-3 py-2 text-center text-xs font-medium text-gray-500">TV</td>
            </tr>
          </thead>
          <tbody>
            <tr className="border-t border-gray-100">
              <td className="px-4 py-2.5 text-xs text-gray-500">CF (M)</td>
              {projections.map((p) => (
                <td key={p.year} className="px-3 py-2.5 text-center text-sm font-medium text-gray-800">
                  {fmt(p.cashFlow, 0)}
                </td>
              ))}
              <td className="px-3 py-2.5 text-center text-sm font-medium text-gray-800">{fmt(terminalValue, 0)}</td>
            </tr>
            <tr className="border-t border-gray-100 bg-gray-50">
              <td className="px-4 py-2.5 text-xs text-gray-500">DCF (M)</td>
              {projections.map((p) => (
                <td key={p.year} className="px-3 py-2.5 text-center text-sm text-gray-600">
                  {fmt(p.discounted, 0)}
                </td>
              ))}
              <td className="px-3 py-2.5 text-center text-sm text-gray-600">{fmt(terminalValueDiscounted, 0)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      {/* EV bridge — matches screenshot */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Enterprise Value Bridge</h3>
          <div className="mt-4 space-y-2 text-sm">
            {[
              { label: 'EV', value: `$ ${fmt(fairValue.ev / 1000, 2)}B`, bold: false },
              { label: 'CASH (+)', value: `$ ${fmt(fairValue.cash, 0)}M`, bold: false, green: true },
              { label: 'DEBT (−)', value: `$ ${fmt(fairValue.debt, 0)}M`, bold: false, red: true },
              { label: 'MKT CAP (ref)', value: `$ ${fmt(fairValue.marketCap / 1000, 2)}B`, bold: false },
              { label: 'SHARES OUT.', value: `${fmt(fairValue.sharesOutstanding, 0)}M`, bold: false },
              { label: 'FAIR VALUE (DCF)', value: `$ ${fmt(fairValue.fairValuePerShare)}`, bold: true },
              { label: 'PRICE', value: `$ ${fmt(fairValue.currentPrice)}`, bold: false },
            ].map((row) => (
              <div key={row.label} className={`flex justify-between border-b border-gray-100 pb-1.5 ${row.bold ? 'font-bold text-gray-900' : 'text-gray-600'}`}>
                <span className={row.green ? 'text-emerald-600' : row.red ? 'text-red-500' : ''}>{row.label}</span>
                <span>{row.value}</span>
              </div>
            ))}
            <div className={`flex justify-between pt-1 font-bold text-base ${up ? 'text-emerald-600' : 'text-red-600'}`}>
              <span>UPSIDE POTENTIAL</span>
              <span>{up ? '+' : ''}{fmtPct(fairValue.upsidePct)}</span>
            </div>
            <div className="flex justify-between text-sm text-gray-500">
              <span>IRR (5Y)</span>
              <span>{fmtPct(fairValue.irr)}</span>
            </div>
          </div>
        </div>

        {/* Scenarios */}
        <div className="rounded-2xl border border-gray-200 bg-white p-5 shadow-sm">
          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Scenarios</h3>
          <div className="mt-4 space-y-3">
            {([
              { label: 'Bull', key: 'bull', color: 'text-emerald-600 bg-emerald-50' },
              { label: 'Base', key: 'base', color: 'text-blue-600 bg-blue-50' },
              { label: 'Bear', key: 'bear', color: 'text-red-600 bg-red-50' },
            ] as const).map((s) => {
              const sc = scenarios[s.key]
              const upside = ((sc.fairValue - fairValue.currentPrice) / fairValue.currentPrice) * 100
              return (
                <div key={s.key} className={`rounded-xl px-4 py-3 ${s.color}`}>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-semibold">{s.label}</span>
                    <span className="text-lg font-bold">${fmt(sc.fairValue)}</span>
                  </div>
                  <div className="mt-1 flex gap-3 text-xs opacity-80">
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
