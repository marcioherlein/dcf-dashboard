'use client'
import { useState, useEffect } from 'react'

interface Transaction {
  filerName: string
  transactionDescription: string
  startDate: string | { raw: number; fmt: string }
  shares: { raw: number; fmt: string } | null
  value: { raw: number; fmt: string } | null
  ownership: string
}

function fmt(v: number): string {
  const abs = Math.abs(v)
  const sign = v < 0 ? '-' : ''
  if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(2)  + 'B'
  if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(1)  + 'M'
  if (abs >= 1e3)  return sign + '$' + (abs / 1e3).toFixed(0)  + 'K'
  return sign + '$' + abs.toLocaleString()
}

function fmtShares(v: number): string {
  const abs = Math.abs(v)
  if (abs >= 1e6) return (abs / 1e6).toFixed(2) + 'M'
  if (abs >= 1e3) return (abs / 1e3).toFixed(0) + 'K'
  return abs.toLocaleString()
}

function parseDate(d: Transaction['startDate']): string {
  if (typeof d === 'string') return d
  if (typeof d === 'object' && d?.fmt) return d.fmt
  if (typeof d === 'object' && d?.raw) return new Date(d.raw * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: '2-digit' })
  return '—'
}

function isBuy(desc: string): boolean {
  return /buy|purchase|acquire/i.test(desc)
}

function isSell(desc: string): boolean {
  return /sell|sale|sold/i.test(desc)
}

export default function InsiderTransactionsWidget({ ticker }: { ticker: string }) {
  const [transactions, setTransactions] = useState<Transaction[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch(`/api/insiders?ticker=${ticker}`)
      .then(r => r.json())
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      .then((data: any) => {
        if (Array.isArray(data)) setTransactions(data)
        else setError(true)
        setLoading(false)
      })
      .catch(() => { setError(true); setLoading(false) })
  }, [ticker])

  if (loading) {
    return (
      <div className="space-y-2 motion-safe:animate-pulse">
        {[1, 2, 3].map(i => <div key={i} className="h-12 rounded-lg bg-slate-100" />)}
      </div>
    )
  }

  if (error || transactions.length === 0) {
    return (
      <p className="text-[12px] text-slate-400 text-center py-4">
        No insider transaction data available.
      </p>
    )
  }

  const buyCount  = transactions.filter(t => isBuy(t.transactionDescription ?? '')).length
  const sellCount = transactions.filter(t => isSell(t.transactionDescription ?? '')).length

  return (
    <div className="space-y-3">
      {/* Summary bar */}
      {(buyCount > 0 || sellCount > 0) && (
        <div className="flex items-center gap-3 text-[11px]">
          {buyCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-emerald-50 border border-emerald-200 text-emerald-700 font-semibold">
              {buyCount} buy{buyCount !== 1 ? 's' : ''}
            </span>
          )}
          {sellCount > 0 && (
            <span className="px-2 py-0.5 rounded-md bg-red-50 border border-red-200 text-red-600 font-semibold">
              {sellCount} sell{sellCount !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-slate-400">last {transactions.length} filings</span>
        </div>
      )}

      {/* Transaction rows */}
      <div className="rounded-xl border border-slate-200 overflow-hidden divide-y divide-slate-100">
        {transactions.slice(0, 8).map((t, i) => {
          const desc = t.transactionDescription ?? ''
          const buy = isBuy(desc)
          const sell = isSell(desc)
          const sharesRaw = typeof t.shares === 'object' && t.shares ? t.shares.raw : null
          const valueRaw  = typeof t.value  === 'object' && t.value  ? t.value.raw  : null

          return (
            <div key={i} className="flex items-center gap-3 px-4 py-3 bg-white">
              {/* Direction indicator */}
              <div className={`w-1.5 h-8 rounded-full shrink-0 ${buy ? 'bg-emerald-400' : sell ? 'bg-red-400' : 'bg-slate-300'}`} />

              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-semibold text-slate-800 truncate">{t.filerName ?? '—'}</p>
                <p className="text-[11px] text-slate-400 truncate">{desc}</p>
              </div>

              <div className="text-right shrink-0">
                {sharesRaw != null && (
                  <p className="text-[12px] font-semibold text-slate-700 tabular-nums">
                    {fmtShares(Math.abs(sharesRaw))} shares
                  </p>
                )}
                {valueRaw != null && Math.abs(valueRaw) > 0 && (
                  <p className="text-[11px] text-slate-400 tabular-nums">{fmt(valueRaw)}</p>
                )}
                <p className="text-[10px] text-slate-400">{parseDate(t.startDate)}</p>
              </div>
            </div>
          )
        })}
      </div>
      <p className="text-[10px] text-slate-400">Source: SEC Form 4 filings via Yahoo Finance. Typically reported within 2 business days of transaction.</p>
    </div>
  )
}
