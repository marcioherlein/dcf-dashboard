'use client'
import { useState, useEffect } from 'react'
import { fmtLarge } from '@/lib/utils'

interface Transaction {
  filerName: string
  transactionText: string
  shares: number
  value?: number
  startDate?: string
  filerRelation?: string
}

export default function InsiderTable({ ticker }: { ticker: string }) {
  const [data, setData] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/insiders?ticker=${ticker}`)
      .then((r) => r.json())
      .then((d) => { setData(d); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  const isBuy = (t: Transaction) => /purchase|buy/i.test(t.transactionText ?? '')

  return (
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700">Insider Transactions</h2>
      {loading ? (
        <p className="mt-4 text-sm text-gray-400">Loading…</p>
      ) : data.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No insider transactions available.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="pb-2 text-left text-xs font-medium text-gray-400">Name</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-400">Relation</th>
                <th className="pb-2 text-left text-xs font-medium text-gray-400">Transaction</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">Shares</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">Value</th>
                <th className="pb-2 text-right text-xs font-medium text-gray-400">Date</th>
              </tr>
            </thead>
            <tbody>
              {data.map((t, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-2 font-medium text-gray-800">{t.filerName}</td>
                  <td className="py-2 text-xs text-gray-400">{t.filerRelation ?? '—'}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isBuy(t) ? 'bg-emerald-50 text-emerald-700' : 'bg-red-50 text-red-600'}`}>
                      {t.transactionText ?? '—'}
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-600">{t.shares?.toLocaleString() ?? '—'}</td>
                  <td className="py-2 text-right text-gray-600">{t.value ? fmtLarge(t.value) : '—'}</td>
                  <td className="py-2 text-right text-xs text-gray-400">
                    {t.startDate ? new Date(t.startDate).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' }) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  )
}
