'use client'
import { fmtPct } from '@/lib/utils'

interface CAGRAnalysis {
  historicalCagr3y: number
  analystEstimate1y: number
  analystEstimate2y: number
  blended: number
  confidence: number
  confidenceLabel: 'High' | 'Medium' | 'Low'
  numAnalysts: number
  drivers: string[]
}

interface Props {
  cagrAnalysis: CAGRAnalysis
  isNegativeFCF: boolean
}

const confidenceColors: Record<string, string> = {
  High: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200',
  Low: 'bg-red-50 text-red-600 border-red-200',
}

export default function CAGRAnalysis({ cagrAnalysis, isNegativeFCF }: Props) {
  const { historicalCagr3y, analystEstimate1y, analystEstimate2y, blended, confidence, confidenceLabel, numAnalysts, drivers } = cagrAnalysis

  const rows = [
    { label: 'Historical 3Y Revenue CAGR', value: historicalCagr3y, note: 'From income statement' },
    { label: 'Analyst Estimate +1Y', value: analystEstimate1y, note: `${numAnalysts} analyst${numAnalysts !== 1 ? 's' : ''}` },
    { label: 'Analyst Estimate +2Y', value: analystEstimate2y, note: 'Fade assumption' },
    { label: 'Blended CAGR (Model Input)', value: blended, note: 'Used in DCF', bold: true },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-semibold text-gray-700">CAGR Analysis</h2>
        <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${confidenceColors[confidenceLabel]}`}>
          {confidenceLabel} confidence · {Math.round(confidence * 100)}%
        </span>
      </div>

      {isNegativeFCF && (
        <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-700">
          <span className="font-semibold">⚠ Negative free cash flow detected.</span> Model uses operating cash flow or revenue base as a proxy. DCF projections represent path-to-profitability assumptions.
        </div>
      )}

      {/* CAGR breakdown table */}
      <div className="overflow-x-auto mb-4">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-gray-100">
              <th className="pb-2 text-left text-xs font-medium text-gray-400">Source</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-400">Growth Rate</th>
              <th className="pb-2 text-right text-xs font-medium text-gray-400">Note</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.label} className={`border-b border-gray-50 ${row.bold ? 'bg-gray-50' : ''}`}>
                <td className={`py-2 ${row.bold ? 'font-semibold text-gray-800' : 'text-gray-600'}`}>{row.label}</td>
                <td className={`py-2 text-right tabular-nums ${row.bold ? 'font-bold text-gray-900' : 'text-gray-700'}`}>
                  {fmtPct(row.value)}
                </td>
                <td className="py-2 text-right text-xs text-gray-400">{row.note}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Growth drivers */}
      <div>
        <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-400">Growth Drivers & Assumptions</p>
        <ul className="space-y-1.5">
          {drivers.map((driver, i) => (
            <li key={i} className="flex items-start gap-2 text-xs text-gray-600">
              <span className="mt-0.5 h-1.5 w-1.5 shrink-0 rounded-full bg-gray-400" />
              {driver}
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
