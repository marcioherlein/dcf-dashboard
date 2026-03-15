'use client'
import { useState, useEffect } from 'react'
import { fmt, fmtPct } from '@/lib/utils'

interface Snapshot {
  id: string
  saved_at: string
  price_at_save: number
  fair_value: number
  wacc: number
  cagr: number
  upside_pct: number
}

interface Props {
  ticker: string
  onSave: () => Promise<void>
  saving: boolean
}

export default function ValuationHistory({ ticker, onSave, saving }: Props) {
  const [history, setHistory] = useState<Snapshot[]>([])
  const [loading, setLoading] = useState(true)

  const load = () => {
    setLoading(true)
    fetch(`/api/valuations?ticker=${ticker}`)
      .then((r) => r.json())
      .then((d) => { setHistory(Array.isArray(d) ? d : []); setLoading(false) })
      .catch(() => setLoading(false))
  }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(() => { load() }, [ticker])

  const handleSave = async () => {
    await onSave()
    load()
  }

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-gray-700">Valuation History</h2>
        <button
          onClick={handleSave}
          disabled={saving}
          className="rounded-xl bg-gray-900 px-4 py-2 text-xs font-medium text-white hover:bg-gray-700 disabled:opacity-50"
        >
          {saving ? 'Saving…' : '+ Save snapshot'}
        </button>
      </div>

      {loading ? (
        <p className="mt-4 text-sm text-gray-400">Loading…</p>
      ) : history.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No saved valuations yet. Click &ldquo;Save snapshot&rdquo; to record today&apos;s model.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left text-xs font-medium text-gray-400">Date</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">Price</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">Fair Value</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">Upside</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">WACC</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">CAGR</th>
              </tr>
            </thead>
            <tbody>
              {history.map((s) => (
                <tr key={s.id} className="border-b border-gray-50">
                  <td className="py-2 text-gray-600">
                    {new Date(s.saved_at).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })}
                  </td>
                  <td className="py-2 text-right text-gray-700">${fmt(s.price_at_save)}</td>
                  <td className="py-2 text-right font-semibold text-gray-800">${fmt(s.fair_value)}</td>
                  <td className={`py-2 text-right font-medium ${s.upside_pct >= 0 ? 'text-emerald-600' : 'text-red-500'}`}>
                    {s.upside_pct >= 0 ? '+' : ''}{fmtPct(s.upside_pct)}
                  </td>
                  <td className="py-2 text-right text-gray-500">{fmtPct(s.wacc)}</td>
                  <td className="py-2 text-right text-gray-500">{fmtPct(s.cagr)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
