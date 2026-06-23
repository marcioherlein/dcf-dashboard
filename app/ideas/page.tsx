'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion } from 'motion/react'
import { TrendingUp, TrendingDown, Zap, Target, BarChart2, Star, RefreshCw, ExternalLink } from 'lucide-react'
import type { IdeaStock, SignalId, IdeasResponse } from '@/app/api/ideas/route'
import { fmtPrice } from '@/lib/formatters'

// ─── Signal metadata ──────────────────────────────────────────────────────────

const SIGNALS: {
  id: SignalId
  label: string
  shortLabel: string
  description: string
  icon: React.ElementType
  cardBg: string
  accentColor: string
  emptyMsg: string
}[] = [
  {
    id: 'undervalued',
    label: 'Most Undervalued',
    shortLabel: 'Undervalued',
    description: 'Stocks where the analyst consensus target price is more than 20% above the current price and analyst consensus is neutral or better. Fair value = median analyst 12-month target.',
    icon: TrendingUp,
    cardBg: 'linear-gradient(145deg, #1a2a06 0%, #2d4a0f 100%)',
    accentColor: '#a3e635',
    emptyMsg: 'No strongly undervalued stocks found today.',
  },
  {
    id: 'margin_of_safety',
    label: 'Widest Margin of Safety',
    shortLabel: 'Margin of Safety',
    description: 'Stocks ranked by the gap between analyst consensus target price and current price. The larger the gap, the bigger the cushion if your assumptions are wrong.',
    icon: Target,
    cardBg: 'linear-gradient(145deg, #0f1e3a 0%, #1a3158 100%)',
    accentColor: '#7eb8f7',
    emptyMsg: 'No margin-of-safety candidates found today.',
  },
  {
    id: 'priced_for_perfection',
    label: 'Priced for Perfection',
    shortLabel: 'Priced for Perfection',
    description: 'Stocks where forward EPS growth expectations exceed 25%. High expectations already in the price — small misses get punished hard.',
    icon: Zap,
    cardBg: 'linear-gradient(145deg, #271500 0%, #3d2200 100%)',
    accentColor: '#fcd34d',
    emptyMsg: 'No stocks priced for perfection today.',
  },
  {
    id: 'contrarian',
    label: 'Market Underestimates',
    shortLabel: 'Contrarian',
    description: 'Stocks where forward EPS growth is well below the recent TTM revenue growth track record. The market may be underpricing the fundamentals.',
    icon: BarChart2,
    cardBg: 'linear-gradient(145deg, #0a1f12 0%, #133d20 100%)',
    accentColor: '#4ade80',
    emptyMsg: 'No contrarian signals found today.',
  },
  {
    id: 'near_52w_low',
    label: 'Near 52-Week Low',
    shortLabel: '52W Low',
    description: 'Stocks more than 25% below their 52-week high where the analyst consensus target still implies positive upside. Price under pressure, but analysts see value.',
    icon: TrendingDown,
    cardBg: 'linear-gradient(145deg, #1a0a3a 0%, #1e0f3d 100%)',
    accentColor: '#c4b5fd',
    emptyMsg: 'No near-52W-low candidates today.',
  },
  {
    id: 'high_conviction',
    label: 'High Conviction',
    shortLabel: 'High Conviction',
    description: 'Stocks where analyst consensus is Buy or Strong Buy (rating ≤ 2.2/5) and the analyst target implies at least 10% upside. Two signals aligned.',
    icon: Star,
    cardBg: 'linear-gradient(145deg, #0a2929 0%, #134040 100%)',
    accentColor: '#5eead4',
    emptyMsg: 'No high-conviction picks today.',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtUpside(v: number | null): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
}

function fmtCAGR(v: number | null): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}%`
}

function fmtPctLow(v: number | null): string {
  if (v == null) return '—'
  return `${v.toFixed(1)}% from high`
}

function _upsideColor(v: number | null): string {
  if (v == null) return 'text-[rgba(255,255,255,0.40)]'
  return v >= 0 ? 'text-[#a3e635]' : 'text-[#fca5a5]'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div
      className="rounded-2xl p-5 animate-pulse"
      style={{
        background: 'linear-gradient(145deg, #1a2a06 0%, #2d4a0f 100%)',
        border: '1px solid rgba(163,230,53,0.12)',
        minHeight: '220px',
      }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-16 rounded-full bg-[rgba(255,255,255,0.10)]" />
        <div className="h-5 w-20 rounded-full bg-[rgba(255,255,255,0.08)]" />
      </div>
      <div className="h-10 w-20 rounded-lg bg-[rgba(255,255,255,0.10)] mb-3" />
      <div className="h-3 w-full rounded bg-[rgba(255,255,255,0.06)] mb-2" />
      <div className="h-3 w-3/4 rounded bg-[rgba(255,255,255,0.06)]" />
    </div>
  )
}

// ─── Idea Card ────────────────────────────────────────────────────────────────

function IdeaCard({
  stock,
  signalId,
  index,
}: {
  stock: IdeaStock
  signalId: SignalId
  index: number
}) {
  const sig = SIGNALS.find(s => s.id === signalId)!

  return (
    <motion.div
      initial={{ opacity: 0, y: 16 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1], delay: index * 0.04 }}
    >
      <Link
        href={`/stock/${stock.ticker}`}
        className="group block rounded-2xl p-5 transition-all hover:-translate-y-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9A19]"
        style={{
          background: sig.cardBg,
          border: `1px solid ${sig.accentColor}22`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.30)',
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <span
              className="text-[11px] font-[800] tracking-[0.06em] px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}
            >
              {stock.ticker}
            </span>
            {stock.sector && (
              <span className="text-[10px] text-[rgba(255,255,255,0.35)] truncate" style={{ maxWidth: 100 }}>
                {stock.sector}
              </span>
            )}
          </div>
          <ExternalLink size={13} className="text-[rgba(255,255,255,0.20)] group-hover:text-[rgba(255,255,255,0.55)] transition-colors shrink-0" />
        </div>

        {/* Company name */}
        <p className="text-[12px] text-[rgba(255,255,255,0.50)] mb-1 truncate">{stock.name}</p>

        {/* Price + upside vs analyst target */}
        <div className="flex items-baseline gap-3 mb-4">
          <span className="text-[26px] font-[900] leading-none tabular-nums" style={{ color: sig.accentColor, letterSpacing: '-0.02em' }}>
            {fmtUpside(stock.upsidePct)}
          </span>
          <div className="flex flex-col">
            <span className="text-[11px] text-[rgba(255,255,255,0.35)] leading-tight">vs analyst target</span>
            {stock.price != null && (
              <span className="text-[11px] text-[rgba(255,255,255,0.55)] tabular-nums leading-tight">
                {fmtPrice(stock.price, 'USD')} today
              </span>
            )}
          </div>
        </div>

        {/* Signal-specific metrics */}
        <div
          className="rounded-lg px-3 py-2 space-y-1.5"
          style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {/* Implied vs historical */}
          {(signalId === 'undervalued' || signalId === 'margin_of_safety' || signalId === 'contrarian' || signalId === 'high_conviction') && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[rgba(255,255,255,0.40)]">Fwd EPS growth</span>
              <span className="text-[11px] font-[700] tabular-nums text-white">{fmtCAGR(stock.impliedCAGR)}</span>
            </div>
          )}
          {(signalId === 'priced_for_perfection') && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[rgba(255,255,255,0.40)]">Fwd EPS growth</span>
              <span className="text-[11px] font-[700] tabular-nums text-[#fcd34d]">{fmtCAGR(stock.impliedCAGR)}</span>
            </div>
          )}
          {(signalId === 'near_52w_low') && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[rgba(255,255,255,0.40)]">52W position</span>
              <span className="text-[11px] font-[700] tabular-nums text-[#c4b5fd]">{fmtPctLow(stock.pctFrom52WHigh)}</span>
            </div>
          )}

          {stock.historicalCagr3y != null && signalId !== 'near_52w_low' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[rgba(255,255,255,0.40)]">TTM rev growth</span>
              <span className="text-[11px] font-[700] tabular-nums" style={{ color: sig.accentColor }}>
                {fmtCAGR(stock.historicalCagr3y)}
              </span>
            </div>
          )}

          {/* Analyst target shown as a price for context — clearly labelled */}
          {stock.analystTarget != null && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[rgba(255,255,255,0.40)]">Analyst 12m target</span>
              <span className="text-[11px] font-[700] tabular-nums text-[rgba(255,255,255,0.65)]">{fmtPrice(stock.analystTarget, 'USD')}</span>
            </div>
          )}

          {/* Explicit separator — insic DCF is on the stock page */}
          <p className="text-[9px] text-[rgba(255,255,255,0.22)] pt-0.5">
            Open for insic DCF fair value →
          </p>
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const [data, setData] = useState<IdeasResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeSignal, setActiveSignal] = useState<SignalId>('undervalued')

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch('/api/ideas')
      .then(r => r.json())
      .then((d: IdeasResponse) => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const activeSig = SIGNALS.find(s => s.id === activeSignal)!
  const stocks = data?.signals[activeSignal] ?? []

  return (
    <div className="min-h-dvh bg-[#F0F1F6]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-[calc(120px+env(safe-area-inset-bottom,0px))] lg:pb-12">

        {/* Hero */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-1">
            <activeSig.icon size={18} className="text-[#5F790B]" strokeWidth={2} />
            <h1 className="text-[22px] sm:text-[26px] font-bold text-[#111111] leading-tight" style={{ letterSpacing: '-0.025em' }}>
              Today&apos;s Ideas
            </h1>
          </div>
          <p className="text-[13px] text-[#6B6B6B]">
            Daily signals from DCF fair value estimates and market-implied growth rates.{' '}
            {data && (
              <span className="text-[#9B9B9B]">{data.totalAnalyzed} stocks analyzed</span>
            )}
          </p>
        </div>

        {/* Signal tabs */}
        <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scrollbar-hide mb-6">
          <div className="flex gap-2 w-max sm:w-auto sm:flex-wrap">
            {SIGNALS.map(sig => {
              const Icon = sig.icon
              const isActive = activeSignal === sig.id
              return (
                <button
                  key={sig.id}
                  onClick={() => setActiveSignal(sig.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap"
                  style={isActive ? {
                    background: '#5F790B',
                    color: 'white',
                    boxShadow: '0 2px 10px rgba(95,121,11,0.28)',
                  } : {
                    background: 'white',
                    color: '#6B6B6B',
                    border: '1px solid #E3E1DA',
                  }}
                >
                  <Icon size={12} strokeWidth={2.2} />
                  {sig.shortLabel}
                </button>
              )
            })}
          </div>
        </div>

        {/* Active signal description */}
        <div className="mb-5 rounded-xl bg-white border border-[#E3E1DA] px-4 py-3">
          <p className="text-[13px] text-[#444444] leading-relaxed">{activeSig.description}</p>
          <p className="text-[11px] text-[#9B9B9B] mt-2 leading-snug">
            <span className="font-[600]">Note:</span> Upside % and target prices here are based on analyst consensus 12-month targets — not insic&apos;s DCF model. Open any stock for the full intrinsic value analysis.
          </p>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl bg-[#FCEAEA] border border-[#F0B8B8] px-5 py-4 text-[13px] text-[#C41E1E] flex items-center gap-2">
            <RefreshCw size={14} />
            Failed to load ideas. Please try again.
          </div>
        )}

        {/* Cards grid */}
        {!error && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
            {loading
              ? Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)
              : stocks.length > 0
                ? stocks.map((stock, i) => (
                    <IdeaCard key={stock.ticker} stock={stock} signalId={activeSignal} index={i} />
                  ))
                : (
                  <div className="col-span-full rounded-2xl bg-white border border-[#E3E1DA] px-6 py-10 text-center">
                    <p className="text-[14px] text-[#9B9B9B]">{activeSig.emptyMsg}</p>
                  </div>
                )
            }
          </div>
        )}

        {/* Footer */}
        {data && (
          <div className="mt-6 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-[#9B9B9B]">
              Updated {new Date(data.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · Refreshes every 6 hours
            </p>
            <p className="text-[11px] text-[#9B9B9B]">
              Upside % is vs analyst 12-month consensus target — not insic&apos;s DCF. Open each stock for the full model.
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
