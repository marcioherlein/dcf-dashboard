'use client'
import { useState, useEffect } from 'react'
import { fmtLarge } from '@/lib/utils'

interface Transaction {
  filerName: string; transactionText: string; shares: number
  value?: number; startDate?: string; filerRelation?: string
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
    <div className="rounded-2xl border border-black/[0.06] bg-white p-6 shadow-sm dark:border-white/8 dark:bg-[#111]">
      <h2 className="text-sm font-semibold text-gray-700 dark:text-white/70">Insider Transactions</h2>
      {loading ? (
        <p className="mt-4 text-sm text-gray-400 dark:text-white/25">Loading…</p>
      ) : data.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 dark:text-white/25">No insider transactions available.</p>
      ) : (
        <div className="mt-4 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 dark:border-white/8">
                {['Name', 'Relation', 'Transaction', 'Shares', 'Value', 'Date'].map((h, i) => (
                  <th key={h} className={`pb-2 text-xs font-medium text-gray-400 dark:text-white/25 ${i >= 3 ? 'text-right' : 'text-left'}`}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((t, i) => (
                <tr key={i} className="border-b border-gray-50 dark:border-white/5">
                  <td className="py-2 font-medium text-gray-800 dark:text-white/70">{t.filerName}</td>
                  <td className="py-2 text-xs text-gray-400 dark:text-white/25">{t.filerRelation ?? '—'}</td>
                  <td className="py-2">
                    <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${isBuy(t) ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' : 'bg-red-50 text-red-600 dark:bg-red-500/10 dark:text-red-400'}`}>
                      {t.transactionText ?? '—'}
                    </span>
                  </td>
                  <td className="py-2 text-right text-gray-600 dark:text-white/50">{t.shares?.toLocaleString() ?? '—'}</td>
                  <td className="py-2 text-right text-gray-600 dark:text-white/50">{t.value ? fmtLarge(t.value) : '—'}</td>
                  <td className="py-2 text-right text-xs text-gray-400 dark:text-white/25">
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
