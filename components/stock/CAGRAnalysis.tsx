'use client'
import { fmtPct } from '@/lib/utils'

interface CAGRAnalysis {
  historicalCagr3y: number; analystEstimate1y: number; analystEstimate2y: number
  blended: number; confidence: number; confidenceLabel: 'High' | 'Medium' | 'Low'
  numAnalysts: number; drivers: string[]
}
interface Props {
  cagrAnalysis: CAGRAnalysis
  isNegativeFCF: boolean
  growthModel?: 'two-stage' | 'three-stage'
  terminalG?: number
}

const confColor: Record<string, string> = {
  High:   'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-500/10 dark:text-emerald-400 dark:border-emerald-500/20',
  Medium: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-500/10 dark:text-amber-400 dark:border-amber-500/20',
  Low:    'bg-red-50 text-red-600 border-red-200 dark:bg-red-500/10 dark:text-red-400 dark:border-red-500/20',
}

export default function CAGRAnalysis({ cagrAnalysis, isNegativeFCF, growthModel = 'two-stage', terminalG }: Props) {
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

      <div className="mt-4 rounded-xl border border-gray-100 dark:border-white/8 bg-gray-50 dark:bg-white/5 px-4 py-3">
        <div className="flex items-center gap-2">
          <p className="text-xs font-semibold text-gray-600 dark:text-white/50">DCF Growth Model</p>
          {growthModel === 'three-stage' ? (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-violet-50 text-violet-600 dark:bg-violet-500/15 dark:text-violet-400">
              Three-Stage (Damodaran)
            </span>
          ) : (
            <span className="rounded px-1.5 py-0.5 text-[10px] font-semibold bg-gray-100 text-gray-500 dark:bg-white/10 dark:text-white/40">
              Two-Stage (Standard)
            </span>
          )}
        </div>
        {growthModel === 'three-stage' ? (
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/25 leading-relaxed">
            <span className="text-gray-600 dark:text-white/50">Years 1–5</span> grow at full blended CAGR ({fmtPct(cagrAnalysis.blended)}).{' '}
            <span className="text-violet-500 dark:text-violet-400">Years 6–10</span> linearly fade to terminal growth
            {terminalG != null ? ` (${fmtPct(terminalG)})` : ''}.
            Applied because growth rate exceeds 15% — Damodaran&apos;s reversion-to-mean principle prevents the
            &quot;growth cliff&quot; artifact of a single-stage model.
          </p>
        ) : (
          <p className="mt-1.5 text-[11px] text-gray-400 dark:text-white/25 leading-relaxed">
            Constant CAGR ({fmtPct(cagrAnalysis.blended)}) applied for all 10 projection years, then terminal value.
            Growth is already near sustainable levels — no deceleration phase needed.
          </p>
        )}
      </div>
    </div>
  )
}
