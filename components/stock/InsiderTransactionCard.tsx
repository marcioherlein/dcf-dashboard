'use client'
import { useState, useEffect } from 'react'
import { ExternalLink } from 'lucide-react'
import type { InsidersResponse, InsiderTransaction } from '@/app/api/stock/insiders/route'

interface Props {
  ticker: string
}

function sentimentConfig(s: InsidersResponse['sentiment']) {
  switch (s) {
    case 'net_buyer':           return { label: 'Net buyer (90d)', bg: 'bg-[#E8F7EF]', text: 'text-[#11875D]', border: 'border-[#A3D9BE]' }
    case 'net_seller':          return { label: 'Net seller (90d)', bg: 'bg-[#FCEAEA]', text: 'text-[#D83B3B]', border: 'border-[#F0B8B8]' }
    case 'neutral':             return { label: 'Mixed (90d)',       bg: 'bg-[#FFF4DA]', text: 'text-[#B56A00]', border: 'border-[#F3D391]' }
    default:                   return { label: 'No recent activity', bg: 'bg-[#F5F5F5]', text: 'text-[#6B6B6B]', border: 'border-[#E5E5E5]' }
  }
}

function typeConfig(t: InsiderTransaction['transactionType']) {
  switch (t) {
    case 'buy':   return { label: 'Purchase', color: 'text-[#11875D]', bg: 'bg-[#E8F7EF]' }
    case 'sell':  return { label: 'Sale',     color: 'text-[#D83B3B]', bg: 'bg-[#FCEAEA]' }
    case 'grant': return { label: 'Grant',    color: 'text-[#6B6B6B]', bg: 'bg-[#F5F5F5]' }
    default:      return { label: 'Other',    color: 'text-[#6B6B6B]', bg: 'bg-[#F5F5F5]' }
  }
}

function fmtShares(n: number | null): string {
  if (n == null) return '—'
  if (Math.abs(n) >= 1e6) return `${(n / 1e6).toFixed(1)}M`
  if (Math.abs(n) >= 1e3) return `${(n / 1e3).toFixed(0)}K`
  return n.toLocaleString()
}

function fmtMoney(v: number | null): string {
  if (v == null) return ''
  if (Math.abs(v) >= 1e9) return ` · $${(v / 1e9).toFixed(1)}B`
  if (Math.abs(v) >= 1e6) return ` · $${(v / 1e6).toFixed(1)}M`
  if (Math.abs(v) >= 1e3) return ` · $${(v / 1e3).toFixed(0)}K`
  return ` · $${v.toLocaleString()}`
}

export default function InsiderTransactionCard({ ticker }: Props) {
  const [data, setData]       = useState<InsidersResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    if (!ticker) return
    setLoading(true)
    fetch(`/api/stock/insiders?ticker=${encodeURIComponent(ticker)}`)
      .then(r => r.json())
      .then((d: InsidersResponse | { error?: string }) => {
        if ('error' in d) return
        setData(d as InsidersResponse)
      })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [ticker])

  if (loading) {
    return (
      <div className="rounded-xl border border-[#E5E5E5] bg-white p-4 animate-pulse">
        <div className="h-4 w-40 rounded bg-[#E5E5E5] mb-2" />
        <div className="space-y-2">
          {[1,2,3].map(i => <div key={i} className="h-8 rounded-lg bg-[#E5E5E5]" />)}
        </div>
      </div>
    )
  }

  if (!data || data.transactions.length === 0) return null

  const sent = sentimentConfig(data.sentiment)
  const PREVIEW = 4
  const visible = expanded ? data.transactions : data.transactions.slice(0, PREVIEW)

  return (
    <div className="rounded-xl border border-[#E5E5E5] bg-white shadow-[0_4px_16px_rgba(0,0,0,0.04)] overflow-hidden">
      {/* Header */}
      <div className="px-4 pt-4 pb-3 border-b border-[#E5E5E5] flex items-center justify-between gap-3">
        <div>
          <p className="text-[13px] font-[700] text-[#111111]">Insider Transactions</p>
          <p className="text-[11px] text-[#9B9B9B]">
            SEC Form 4 — executives and directors buying/selling their own stock
          </p>
        </div>
        <span className={`text-[10px] font-[700] px-2.5 py-1 rounded-full border shrink-0 ${sent.bg} ${sent.text} ${sent.border}`}>
          {sent.label}
        </span>
      </div>

      {/* 90d summary */}
      {(data.buyCount90d > 0 || data.sellCount90d > 0) && (
        <div className="px-4 py-2.5 bg-[#FAFAFA] border-b border-[#E5E5E5] flex items-center gap-6 text-[11px]">
          {data.buyCount90d > 0 && (
            <span className="text-[#11875D] font-[650]">
              {data.buyCount90d} purchase{data.buyCount90d !== 1 ? 's' : ''}
            </span>
          )}
          {data.sellCount90d > 0 && (
            <span className="text-[#D83B3B] font-[650]">
              {data.sellCount90d} sale{data.sellCount90d !== 1 ? 's' : ''}
            </span>
          )}
          <span className="text-[#9B9B9B]">in the last 90 days</span>
        </div>
      )}

      {/* Context note — framing for the investor */}
      <div className="px-4 py-2.5 bg-[#EAF1FF]/40 border-b border-[#E5E5E5]">
        <p className="text-[11px] text-[#2563EB] leading-snug">
          Cluster buying by multiple insiders within 30 days is historically one of the most reliable
          non-quantitative signals. Insider selling is less informative — executives sell for many
          reasons (diversification, taxes, options). Watch for buys, not sells.
        </p>
      </div>

      {/* Transaction list */}
      <div className="divide-y divide-[#F0F0F0]">
        {visible.map((txn, i) => {
          const tc = typeConfig(txn.transactionType)
          return (
            <div key={i} className="px-4 py-3 flex items-center gap-3 min-h-[52px]">
              {/* Type badge */}
              <span className={`text-[10px] font-[700] px-2 py-0.5 rounded-full shrink-0 ${tc.bg} ${tc.color}`}>
                {tc.label}
              </span>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <p className="text-[12px] font-[650] text-[#111111] truncate">{txn.insiderName}</p>
                <p className="text-[10px] text-[#9B9B9B] truncate">
                  {txn.title}{txn.date ? ` · ${txn.date}` : ''}
                  {txn.shares != null && ` · ${fmtShares(txn.shares)} shares${fmtMoney(txn.totalValue)}`}
                </p>
              </div>

              {/* SEC link */}
              {txn.secUrl && (
                <a
                  href={txn.secUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-[#2563EB] hover:text-[#1D4ED8] transition-colors shrink-0 min-w-[32px] min-h-[32px] flex items-center justify-center"
                  aria-label="View SEC filing"
                >
                  <ExternalLink size={13} strokeWidth={1.8} />
                </a>
              )}
            </div>
          )
        })}
      </div>

      {/* Show more */}
      {data.transactions.length > PREVIEW && (
        <button
          onClick={() => setExpanded(v => !v)}
          className="w-full px-4 py-3 text-[12px] font-[650] text-[#2563EB] hover:bg-[#F5F5F5] transition-colors border-t border-[#E5E5E5] min-h-[44px]"
        >
          {expanded ? 'Show less' : `Show all ${data.transactions.length} transactions`}
        </button>
      )}
    </div>
  )
}
