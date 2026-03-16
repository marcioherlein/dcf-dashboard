'use client'
import { fmtPct } from '@/lib/utils'

interface CAGRAnalysis {
  historicalCagr3y: number; analystEstimate1y: number; analystEstimate2y: number
  blended: number; confidence: number; confidenceLabel: 'High' | 'Medium' | 'Low'
  numAnalysts: number; drivers: string[]
}
interface Props { cagrAnalysis: CAGRAnalysis; isNegativeFCF: boolean }

const confColor: Record<string, string> = {
  High:   'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  Low:    'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
}

export default function CAGRAnalysis({ cagrAnalysis, isNegativeFCF }: Props) {
  const { historicalCagr3y, analystEstimate1y, analystEstimate2y, blended, confidence, confidenceLabel, numAnalysts, drivers } = cagrAnalysis
  const rows = [
    { label: 'Historical 3Y Revenue CAGR', value: historicalCagr3y,  note: 'From income statement',                       bold: false },
    { label: 'Analyst Estimate +1Y',        value: analystEstimate1y, note: `${numAnalysts} analyst${numAnalysts !== 1 ? 's' : ''}`, bold: false },
    { label: 'Analyst Estimate +2Y',        value: analystEstimate2y, note: 'Fade assumption',                             bold: false },
    { label: 'Blended CAGR (Model Input)',  value: blended,           note: 'Used in DCF',                                bold: true },
  ]

  return (
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700 dark:text-white/70">CAGR Analysis</h2>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${confColor[confidenceLabel]}`}>
          {confidenceLabel} confidence · {Math.round(confidence * 100)}%
        </span>
      </div>

      {isNegativeFCF && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700 dark:border-amber-500/20 dark:bg-amber-500/10 dark:text-amber-400">
          <span className="font-semibold">⚠ Negative free cash flow detected.</span>{' '}
          Model uses operating cash flow or revenue base as proxy.
        </div>
      )}

      <div className="mb-4 overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100 dark:border-white/8">
              <th className="pb-2 text-left text-xs font-medium text-gray-400 dark:text-white/25">Source</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-400 dark:text-white/25">Growth Rate</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-400 dark:text-white/25">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={`border-b border-gray-50 dark:border-white/5 ${row.bold ? 'bg-gray-50 dark:bg-white/5' : ''}`}>
                <td className={`py-2 ${row.bold ? 'font-semibold text-gray-800 dark:text-white' : 'text-gray-600 dark:text-white/50'}`}>{row.label}</td>
                <td className={`py-2 text-right tabular-nums ${row.bold ? 'font-bold text-gray-900 dark:text-white' : 'text-gray-700 dark:text-white/60'}`}>{fmtPct(row.value)}</td>
                <td className="py-2 text-right text-xs text-gray-400 dark:text-white/25">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400 dark:text-white/25">Growth Drivers &amp; Assumptions</p>
      <ul className="space-y-1.5">
        {drivers.map((driver, i) => (
          <li key={i} className="flex items-start gap-2 text-xs text-gray-600 dark:text-white/40">
            <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400 dark:bg-white/25" />
            {driver}
          </li>
        ))}
      </ul>
    </div>
  )
}
