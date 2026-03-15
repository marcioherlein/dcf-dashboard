'use client'
import { useState } from 'react'
import { fmtPct, fmt } from '@/lib/utils'

interface WACCResult {
  wacc: number
  costOfEquity: number
  afterTaxCostOfDebt: number
  weightEquity: number
  weightDebt: number
  inputs: {
    rfRate: number
    beta: number
    erp: number
    costOfDebt: number
    taxRate: number
    debtToEquity: number
  }
}

interface Props {
  wacc: WACCResult
  onWACCChange?: (wacc: number) => void
}

export default function WACCBreakdown({ wacc, onWACCChange }: Props) {
  const [overrideWACC, setOverrideWACC] = useState('')

  const rows = [
    { label: 'Risk-Free Rate (10Y Treasury)', value: fmtPct(wacc.inputs.rfRate), formula: 'RF', note: 'FRED DGS10' },
    { label: 'Beta (5Y weekly vs SPY)', value: fmt(wacc.inputs.beta, 2), formula: 'β', note: 'OLS regression' },
    { label: 'Equity Risk Premium', value: fmtPct(wacc.inputs.erp), formula: 'ERP', note: 'Damodaran 2025' },
    { label: 'Cost of Equity', value: fmtPct(wacc.costOfEquity), formula: 'Ke = RF + β × ERP', note: 'CAPM' },
    { label: 'Cost of Debt (pre-tax)', value: fmtPct(wacc.inputs.costOfDebt), formula: 'Kd = Interest / Debt', note: '3Y avg' },
    { label: 'Tax Rate', value: fmtPct(wacc.inputs.taxRate), formula: 'T', note: '3Y effective avg' },
    { label: 'After-tax Cost of Debt', value: fmtPct(wacc.afterTaxCostOfDebt), formula: 'Kd × (1−T)', note: '' },
    { label: 'Debt / Equity', value: fmt(wacc.inputs.debtToEquity, 2), formula: 'D/E', note: 'Mkt cap basis' },
    { label: 'Weight Equity', value: fmtPct(wacc.weightEquity), formula: 'E/V', note: '' },
    { label: 'Weight Debt', value: fmtPct(wacc.weightDebt), formula: 'D/V', note: '' },
  ]

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">WACC Breakdown</h2>
        <div className="flex items-center gap-2">
          <span className="text-2xl font-bold text-gray-900">{fmtPct(wacc.wacc)}</span>
          <span className="text-xs text-gray-400">auto-calculated</span>
        </div>
      </div>

      <div className="mt-4 overflow-hidden rounded-xl border border-gray-100">
        <table className="w-full text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Variable</th>
              <th className="px-4 py-2 text-left text-xs font-medium text-gray-400">Formula</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">Value</th>
              <th className="px-4 py-2 text-right text-xs font-medium text-gray-400">Source</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => (
              <tr key={r.label} className={`border-t border-gray-100 ${i === rows.length - 1 ? 'bg-gray-50 font-medium' : ''}`}>
                <td className="px-4 py-2 text-gray-700">{r.label}</td>
                <td className="px-4 py-2 font-mono text-xs text-gray-400">{r.formula}</td>
                <td className="px-4 py-2 text-right font-semibold text-gray-800">{r.value}</td>
                <td className="px-4 py-2 text-right text-xs text-gray-400">{r.note}</td>
              </tr>
            ))}
          </tbody>
          <tfoot>
            <tr className="border-t-2 border-gray-200 bg-emerald-50">
              <td colSpan={2} className="px-4 py-3 font-bold text-gray-900">WACC = E/V × Ke + D/V × Kd × (1−T)</td>
              <td colSpan={2} className="px-4 py-3 text-right text-lg font-bold text-emerald-700">{fmtPct(wacc.wacc)}</td>
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="mt-4 flex items-center gap-3">
        <label className="text-xs text-gray-500">Override WACC:</label>
        <input
          type="number"
          placeholder={`${(wacc.wacc * 100).toFixed(2)}`}
          value={overrideWACC}
          onChange={(e) => setOverrideWACC(e.target.value)}
          className="w-24 rounded-lg border border-gray-200 px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-gray-300"
          step="0.1"
          min="1"
          max="30"
        />
        <span className="text-xs text-gray-400">%</span>
        <button
          onClick={() => onWACCChange?.(parseFloat(overrideWACC) / 100)}
          disabled={!overrideWACC}
          className="rounded-lg bg-gray-900 px-3 py-1.5 text-xs font-medium text-white disabled:opacity-40 hover:bg-gray-700"
        >
          Apply
        </button>
        <p className="text-xs text-gray-400">Use this if auto-calculated values look wrong (e.g. unusual debt structure).</p>
      </div>
    </div>
  )
}
