'use client'
import { useState } from 'react'
import { fmtPct, fmt } from '@/lib/utils'

interface WACCResult {
  wacc: number; costOfEquity: number; afterTaxCostOfDebt: number
  weightEquity: number; weightDebt: number
  inputs: { rfRate: number; beta: number; erp: number; costOfDebt: number; taxRate: number; debtToEquity: number }
}
interface Props { wacc: WACCResult; onWACCChange?: (wacc: number) => void }

export default function WACCBreakdown({ wacc, onWACCChange }: Props) {
  const [overrideWACC, setOverrideWACC] = useState('')
  const rows = [
    { label: 'Risk-Free Rate (10Y Treasury)', value: fmtPct(wacc.inputs.rfRate),       formula: 'RF',                note: 'FRED DGS10' },
    { label: 'Beta (5Y weekly vs SPY)',        value: fmt(wacc.inputs.beta, 2),          formula: 'β',                 note: 'OLS regression' },
    { label: 'Equity Risk Premium',            value: fmtPct(wacc.inputs.erp),           formula: 'ERP',               note: 'Damodaran 2025' },
    { label: 'Cost of Equity',                 value: fmtPct(wacc.costOfEquity),         formula: 'Ke = RF + β × ERP', note: 'CAPM' },
    { label: 'Cost of Debt (pre-tax)',          value: fmtPct(wacc.inputs.costOfDebt),    formula: 'Kd',                note: '3Y avg' },
    { label: 'Tax Rate',                        value: fmtPct(wacc.inputs.taxRate),       formula: 'T',                 note: '3Y eff. avg' },
    { label: 'After-tax Cost of Debt',          value: fmtPct(wacc.afterTaxCostOfDebt),  formula: 'Kd × (1−T)',        note: '' },
    { label: 'Debt / Equity',                   value: fmt(wacc.inputs.debtToEquity, 2), formula: 'D/E',               note: 'Mkt cap basis' },
    { label: 'Weight Equity',                   value: fmtPct(wacc.weightEquity),         formula: 'E/V',               note: '' },
    { label: 'Weight Debt',                     value: fmtPct(wacc.weightDebt),           formula: 'D/V',               note: '' },
  ]

  return (
    <div className="rounded-xl bg-surface-container-lowest dark:bg-[#111] shadow-card border border-outline-variant/10 dark:border-white/8 p-6">
      <div className="mb-4 flex items-center justify-between">
        <h2 className="text-sm font-headline font-semibold text-on-surface dark:text-white/70">WACC Breakdown</h2>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900 dark:text-white" style={{ letterSpacing: '-0.03em' }}>{fmtPct(wacc.wacc)}</span>
          <span className="text-xs text-gray-400 dark:text-white/25">auto-calculated</span>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-100 dark:border-white/6">
        <table className="w-full text-sm">
          <thead className="bg-surface-container-low dark:bg-white/5">
            <tr>
              {['Variable', 'Formula', 'Value', 'Source'].map((h, i) => (
                <th key={h} className={`px-4 py-2 text-xs font-medium text-gray-400 dark:text-white/25 ${i > 1 ? 'text-right' : 'text-left'}`}>{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className={`border-t border-gray-100 dark:border-white/5 ${i === rows.length - 1 ? 'bg-gray-50 font-medium dark:bg-white/5' : ''}`}>
                <td className="px-4 py-2 text-gray-700 dark:text-white/60">{r.label}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-400 dark:text-white/25">{r.formula}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-800 dark:text-white/80">{r.value}</td>
                <td className="px-4 py-2 text-right text-xs text-gray-400 dark:text-white/25">{r.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-emerald-50 dark:border-emerald-500/20 dark:bg-emerald-500/10">
              <td colSpan={2} className="px-4 py-3 text-xs font-bold text-gray-900 dark:text-white">
                WACC = E/V × Ke + D/V × Kd × (1−T)
              </td>
              <td colSpan={2} className="px-4 py-3 text-right text-lg font-bold text-emerald-700 dark:text-emerald-400">
                {fmtPct(wacc.wacc)}
              </td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <label className="text-xs text-gray-500 dark:text-white/30">Override WACC:</label>
        <input
          type="number" placeholder={`${(wacc.wacc * 100).toFixed(2)}`} value={overrideWACC}
          onChange={(e) => setOverrideWACC(e.target.value)} step="0.1" min="1" max="30"
          className="w-24 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-300 dark:border-white/10 dark:bg-white/5 dark:text-white dark:placeholder-white/25 dark:focus:ring-white/20"
        />
        <span className="text-xs text-gray-400 dark:text-white/25">%</span>
        <button
          onClick={() => onWACCChange?.(parseFloat(overrideWACC) / 100)}
          disabled={!overrideWACC}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white transition hover:bg-gray-700 disabled:opacity-40 dark:bg-white dark:text-black dark:hover:bg-white/80"
        >
          Apply
        </button>
        <p className="text-xs text-gray-400 dark:text-white/25">Use this if auto-calculated values look wrong.</p>
      </div>
    </div>
  )
}
