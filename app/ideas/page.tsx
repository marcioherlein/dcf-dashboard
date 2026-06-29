'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import {
  TrendingUp, TrendingDown, Zap, BarChart2, Star,
  RefreshCw, ExternalLink, Cpu, ArrowUpRight, Layers, UserCheck,
} from 'lucide-react'
import type { IdeaStock, SignalId, IdeasResponse } from '@/app/api/ideas/route'
import { fmtPrice } from '@/lib/formatters'
import { cn } from '@/lib/utils'

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
  isPrimary?: boolean
}[] = [
  {
    id: 'insic_dcf',
    label: 'insic DCF Discount',
    shortLabel: 'insic DCF',
    description: 'Stocks trading most below insic\'s own DCF intrinsic value estimate. Unlike analyst price targets, insic\'s fair value is derived from a full discounted cash flow model — WACC, free cash flow projections, terminal value — using the same methodology applied on each stock\'s detailed page.',
    icon: Cpu,
    cardBg: 'linear-gradient(145deg, #0c1a35 0%, #112252 100%)',
    accentColor: '#60a5fa',
    emptyMsg: 'No DCF discount opportunities found today.',
    isPrimary: true,
  },
  {
    id: 'estimate_upgrades',
    label: 'Estimate Upgrades',
    shortLabel: 'Est. Upgrades',
    description: 'Stocks where analyst EPS estimates were revised up at least 2% over the last 90 days, and the stock still trades below insic\'s DCF fair value. Two independent signals pointing in the same direction: the business is doing better than expected and it\'s still not priced for it.',
    icon: ArrowUpRight,
    cardBg: 'linear-gradient(145deg, #0d1f14 0%, #1a3d25 100%)',
    accentColor: '#4ade80',
    emptyMsg: 'No estimate-upgrade candidates found today.',
    isPrimary: true,
  },
  {
    id: 'insider_buying',
    label: 'Insider Buying',
    shortLabel: 'Insiders',
    description: 'Stocks where company insiders (executives, directors) made net purchases in the last 90 days and the stock still trades below insic\'s DCF fair value or analyst consensus target. Insider buying is one of the most direct signals of management conviction — insiders only buy when they believe the price is wrong.',
    icon: UserCheck,
    cardBg: 'linear-gradient(145deg, #1a1030 0%, #2d1a50 100%)',
    accentColor: '#a78bfa',
    emptyMsg: 'No net insider buying detected today.',
    isPrimary: true,
  },
  {
    id: 'undervalued',
    label: 'Most Undervalued',
    shortLabel: 'Undervalued',
    description: 'Stocks where insic\'s DCF fair value (or analyst consensus target when DCF is unavailable) is more than 20% above the current price. Analyst consensus is neutral or better.',
    icon: TrendingUp,
    cardBg: 'linear-gradient(145deg, #1a2a06 0%, #2d4a0f 100%)',
    accentColor: '#a3e635',
    emptyMsg: 'No strongly undervalued stocks found today.',
  },
  {
    id: 'high_conviction',
    label: 'High Conviction',
    shortLabel: 'High Conviction',
    description: 'Stocks where analyst consensus is Buy or Strong Buy (rating ≤ 2.2/5) and the stock trades below insic\'s DCF fair value or analyst target implies at least 10% upside. Two signals aligned.',
    icon: Star,
    cardBg: 'linear-gradient(145deg, #0a2929 0%, #134040 100%)',
    accentColor: '#5eead4',
    emptyMsg: 'No high-conviction picks today.',
  },
  {
    id: 'contrarian',
    label: 'Market Underestimates',
    shortLabel: 'Contrarian',
    description: 'Stocks where forward EPS growth expectations are well below the recent TTM revenue growth track record. The market may be underpricing the fundamentals.',
    icon: BarChart2,
    cardBg: 'linear-gradient(145deg, #0a1f12 0%, #133d20 100%)',
    accentColor: '#86efac',
    emptyMsg: 'No contrarian signals found today.',
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
    id: 'near_52w_low',
    label: 'Near 52-Week Low',
    shortLabel: '52W Low',
    description: 'Stocks more than 25% below their 52-week high where insic DCF or analyst consensus still implies positive upside. Price under pressure, but intrinsic value analysis sees opportunity.',
    icon: TrendingDown,
    cardBg: 'linear-gradient(145deg, #1a0a3a 0%, #1e0f3d 100%)',
    accentColor: '#c4b5fd',
    emptyMsg: 'No near-52W-low candidates today.',
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton({ bg }: { bg: string }) {
  return (
    <div
      className="rounded-2xl p-5 animate-pulse"
      style={{ background: bg, border: '1px solid rgba(255,255,255,0.06)', minHeight: '240px' }}
    >
      <div className="flex items-center justify-between mb-4">
        <div className="h-5 w-16 rounded-full bg-[rgba(255,255,255,0.10)]" />
        <div className="h-5 w-20 rounded-full bg-[rgba(255,255,255,0.08)]" />
      </div>
      <div className="h-10 w-24 rounded-lg bg-[rgba(255,255,255,0.10)] mb-3" />
      <div className="h-3 w-full rounded bg-[rgba(255,255,255,0.06)] mb-2" />
      <div className="h-3 w-3/4 rounded bg-[rgba(255,255,255,0.06)]" />
    </div>
  )
}

// ─── EPS Revision Badge ───────────────────────────────────────────────────────

function RevisionBadge({ revision }: { revision: IdeaStock['epsRevision'] }) {
  if (!revision) return null
  const { direction, magnitude } = revision
  if (direction === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-[700] px-1.5 py-0.5 rounded-full"
        style={{ background: 'rgba(74,222,128,0.15)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
        ↑ EPS {(magnitude * 100).toFixed(0)}%
      </span>
    )
  }
  if (direction === 'down') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-[700] px-1.5 py-0.5 rounded-full"
        style={{ background: 'rgba(248,113,113,0.15)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
        ↓ EPS {(magnitude * 100).toFixed(0)}%
      </span>
    )
  }
  return null
}

// ─── Conviction Band Badge ────────────────────────────────────────────────────

function ConvictionBadge({ band }: { band: IdeaStock['convictionBand'] }) {
  if (!band || band === 'D') return null
  const map = {
    A: { label: 'A', bg: 'rgba(96,165,250,0.15)', color: '#60a5fa', border: 'rgba(96,165,250,0.30)' },
    B: { bg: 'rgba(74,222,128,0.12)', color: '#4ade80', border: 'rgba(74,222,128,0.25)', label: 'B' },
    C: { bg: 'rgba(251,191,36,0.12)', color: '#fbbf24', border: 'rgba(251,191,36,0.25)', label: 'C' },
  }
  const style = map[band as 'A' | 'B' | 'C']
  return (
    <span className="inline-flex items-center text-[10px] font-[800] px-1.5 py-0.5 rounded-full"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
      {style.label}
    </span>
  )
}

// ─── Idea Card ────────────────────────────────────────────────────────────────

function IdeaCard({ stock, signalId, index }: { stock: IdeaStock; signalId: SignalId; index: number }) {
  const sig = SIGNALS.find(s => s.id === signalId)!

  // Primary upside: insic DCF preferred, analyst target fallback
  const primaryUpside = stock.insicUpsidePct ?? stock.upsidePct
  const primarySource = stock.insicUpsidePct != null ? 'insic DCF' : 'analyst target'

  // Signals aligned: both insic DCF and analyst target agree it's undervalued
  const signalsAligned = stock.insicUpsidePct != null && stock.insicUpsidePct > 0 &&
    stock.upsidePct != null && stock.upsidePct > 0

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
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span
              className="text-[11px] font-[800] tracking-[0.06em] px-2.5 py-0.5 rounded-full"
              style={{ background: 'rgba(255,255,255,0.12)', color: 'rgba(255,255,255,0.80)' }}
            >
              {stock.ticker}
            </span>
            {stock.sector && (
              <span className="text-[10px] text-[rgba(255,255,255,0.35)] truncate" style={{ maxWidth: 90 }}>
                {stock.sector}
              </span>
            )}
            <RevisionBadge revision={stock.epsRevision} />
            {stock.insiderSentiment?.sentiment === 'net_buyer' && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-[700] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(167,139,250,0.15)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.25)' }}>
                insider ↑
              </span>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <ConvictionBadge band={stock.convictionBand} />
            <ExternalLink size={13} className="text-[rgba(255,255,255,0.20)] group-hover:text-[rgba(255,255,255,0.55)] transition-colors" />
          </div>
        </div>

        {/* Company name */}
        <p className="text-[12px] text-[rgba(255,255,255,0.50)] mb-1 truncate">{stock.name}</p>

        {/* Primary metric */}
        <div className="flex items-baseline gap-3 mb-3">
          <span className="text-[26px] font-[900] leading-none tabular-nums" style={{ color: sig.accentColor, letterSpacing: '-0.02em' }}>
            {fmtUpside(primaryUpside)}
          </span>
          <div className="flex flex-col gap-0.5">
            <span className="text-[10px] text-[rgba(255,255,255,0.35)] leading-tight">vs {primarySource}</span>
            {stock.insicFairValue != null && (
              <span className="text-[10px] text-[rgba(255,255,255,0.50)] tabular-nums leading-tight">
                FV ${stock.insicFairValue.toFixed(2)}
              </span>
            )}
            {stock.price != null && (
              <span className="text-[10px] text-[rgba(255,255,255,0.40)] tabular-nums leading-tight">
                {fmtPrice(stock.price, 'USD')} today
              </span>
            )}
          </div>
        </div>

        {/* Aligned badge */}
        {signalsAligned && (
          <div className="mb-3">
            <span className="inline-flex items-center gap-1 text-[10px] font-[700] px-2 py-0.5 rounded-full"
              style={{ background: 'rgba(96,165,250,0.15)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.25)' }}>
              ✓ DCF + analyst aligned
            </span>
          </div>
        )}

        {/* Signal metrics */}
        <div
          className="rounded-lg px-3 py-2 space-y-1.5"
          style={{ background: 'rgba(0,0,0,0.22)', border: '1px solid rgba(255,255,255,0.07)' }}
        >
          {(signalId === 'undervalued' || signalId === 'insic_dcf' || signalId === 'estimate_upgrades' || signalId === 'contrarian' || signalId === 'high_conviction') && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[rgba(255,255,255,0.40)]">Fwd EPS growth</span>
              <span className="text-[11px] font-[700] tabular-nums text-white">{fmtCAGR(stock.impliedCAGR)}</span>
            </div>
          )}
          {signalId === 'priced_for_perfection' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[rgba(255,255,255,0.40)]">Fwd EPS growth</span>
              <span className="text-[11px] font-[700] tabular-nums text-[#fcd34d]">{fmtCAGR(stock.impliedCAGR)}</span>
            </div>
          )}
          {signalId === 'near_52w_low' && (
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
          {stock.analystTarget != null && signalId !== 'insic_dcf' && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[rgba(255,255,255,0.40)]">Analyst 12m target</span>
              <span className="text-[11px] font-[700] tabular-nums text-[rgba(255,255,255,0.65)]">{fmtPrice(stock.analystTarget, 'USD')}</span>
            </div>
          )}
          {signalId === 'insider_buying' && stock.insiderSentiment && (
            <div className="flex items-center justify-between">
              <span className="text-[10px] text-[rgba(255,255,255,0.40)]">90-day transactions</span>
              <span className="text-[11px] font-[700] tabular-nums text-[#a78bfa]">
                {stock.insiderSentiment.buyCount}B · {stock.insiderSentiment.sellCount}S
              </span>
            </div>
          )}
        </div>

        {/* Narrative hook */}
        {stock.narrativeHook && (
          <p className="text-[10px] text-[rgba(255,255,255,0.38)] mt-2 leading-snug">
            {stock.narrativeHook}
          </p>
        )}

        {/* Sector context */}
        {stock.sectorContext?.pctVsMedianFwdPE != null && Math.abs(stock.sectorContext.pctVsMedianFwdPE) >= 0.10 && (
          <div className="mt-2 flex items-center gap-1">
            <span className="text-[9px] font-[600] px-1.5 py-0.5 rounded-full"
              style={{
                background: stock.sectorContext.pctVsMedianFwdPE < 0 ? 'rgba(74,222,128,0.12)' : 'rgba(248,113,113,0.12)',
                color: stock.sectorContext.pctVsMedianFwdPE < 0 ? '#4ade80' : '#f87171',
                border: `1px solid ${stock.sectorContext.pctVsMedianFwdPE < 0 ? 'rgba(74,222,128,0.25)' : 'rgba(248,113,113,0.25)'}`,
              }}>
              {Math.abs(stock.sectorContext.pctVsMedianFwdPE * 100).toFixed(0)}%{' '}
              {stock.sectorContext.pctVsMedianFwdPE < 0 ? 'cheaper' : 'pricier'} than {stock.sector ?? 'sector'} P/E median
            </span>
          </div>
        )}
      </Link>
    </motion.div>
  )
}

// ─── Sector Group ─────────────────────────────────────────────────────────────

function SectorGroup({ sector, stocks, signalId }: { sector: string; stocks: IdeaStock[]; signalId: SignalId }) {
  return (
    <div className="col-span-full">
      <p className="text-[10px] font-[700] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.30)] mb-2 mt-2">{sector}</p>
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
        {stocks.map((stock, i) => (
          <IdeaCard key={stock.ticker} stock={stock} signalId={signalId} index={i} />
        ))}
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const [data, setData] = useState<IdeasResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [activeSignal, setActiveSignal] = useState<SignalId>('insic_dcf')
  const [groupBySector, setGroupBySector] = useState(false)

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

  // Group by sector
  const grouped: Record<string, IdeaStock[]> = {}
  if (groupBySector) {
    for (const s of stocks) {
      const sec = s.sector ?? 'Other'
      if (!grouped[sec]) grouped[sec] = []
      grouped[sec].push(s)
    }
  }

  return (
    <div className="min-h-dvh bg-[#0d1117]">
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-6 pb-[calc(120px+env(safe-area-inset-bottom,0px))] lg:pb-12">

        {/* Hero */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <activeSig.icon size={18} className="text-[#60a5fa]" strokeWidth={2} />
            <h1 className="text-[22px] sm:text-[26px] font-bold text-white leading-tight" style={{ letterSpacing: '-0.025em' }}>
              Today&apos;s Ideas
            </h1>
          </div>
          <p className="text-[13px] text-[rgba(255,255,255,0.45)]">
            Powered by insic DCF model · {data ? `${data.totalAnalyzed} stocks analyzed` : 'Loading…'}
          </p>
        </div>

        {/* Disclaimer — always visible, not dismissible */}
        <div className="flex items-start gap-2 rounded-xl border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] px-4 py-3 mb-4">
          <svg className="w-3.5 h-3.5 text-[rgba(255,255,255,0.30)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/>
            <path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
          </svg>
          <p className="text-[11px] text-[rgba(255,255,255,0.35)] leading-relaxed">
            Ideas are generated by insic&apos;s valuation models, not by human analysts. This is not investment advice.
            Past model outputs do not guarantee future returns.
          </p>
        </div>

        {/* Signal tabs */}
        <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scrollbar-hide mb-5">
          <div className="flex gap-2 w-max sm:w-auto sm:flex-wrap">
            {SIGNALS.map(sig => {
              const Icon = sig.icon
              const isActive = activeSignal === sig.id
              return (
                <button
                  key={sig.id}
                  onClick={() => setActiveSignal(sig.id)}
                  className="flex items-center gap-1.5 px-3 py-2 rounded-full text-[12px] font-semibold transition-all whitespace-nowrap min-h-[44px]"
                  style={isActive ? {
                    background: sig.isPrimary ? '#1d4ed8' : '#374151',
                    color: 'white',
                    boxShadow: sig.isPrimary ? '0 2px 12px rgba(37,99,235,0.35)' : 'none',
                  } : {
                    background: 'rgba(255,255,255,0.06)',
                    color: 'rgba(255,255,255,0.55)',
                    border: '1px solid rgba(255,255,255,0.10)',
                  }}
                >
                  <Icon size={12} strokeWidth={2.2} />
                  {sig.shortLabel}
                  {sig.isPrimary && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full bg-[#60a5fa] ml-0.5" />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Active signal description + controls */}
        <div className="mb-5 rounded-xl px-4 py-3 flex items-start justify-between gap-4"
          style={{ background: 'rgba(255,255,255,0.04)', border: '1px solid rgba(255,255,255,0.08)' }}>
          <p className="text-[12px] text-[rgba(255,255,255,0.55)] leading-relaxed">{activeSig.description}</p>
          <button
            onClick={() => setGroupBySector(v => !v)}
            className={cn(
              'shrink-0 flex items-center gap-1.5 text-[11px] font-[600] px-2.5 py-1.5 rounded-lg transition-colors min-h-[44px]',
              groupBySector
                ? 'bg-[#1d4ed8] text-white'
                : 'bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.45)] hover:text-[rgba(255,255,255,0.70)]'
            )}
          >
            <Layers size={11} />
            Sector
          </button>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl px-5 py-4 text-[13px] flex items-center gap-2"
            style={{ background: 'rgba(239,68,68,0.10)', border: '1px solid rgba(239,68,68,0.25)', color: '#fca5a5' }}>
            <RefreshCw size={14} />
            Failed to load ideas. Please try again.
          </div>
        )}

        {/* Cards */}
        {!error && (
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3"
              >
                {Array.from({ length: 6 }).map((_, i) => (
                  <CardSkeleton key={i} bg={activeSig.cardBg} />
                ))}
              </motion.div>
            ) : stocks.length === 0 ? (
              <motion.div
                key="empty"
                initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-2xl px-6 py-10 text-center"
                style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <p className="text-[14px] text-[rgba(255,255,255,0.35)]">{activeSig.emptyMsg}</p>
              </motion.div>
            ) : groupBySector ? (
              <motion.div key="grouped" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid grid-cols-1 gap-4">
                {Object.entries(grouped).map(([sector, sectorStocks]) => (
                  <SectorGroup key={sector} sector={sector} stocks={sectorStocks} signalId={activeSignal} />
                ))}
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {stocks.map((stock, i) => (
                  <IdeaCard key={stock.ticker} stock={stock} signalId={activeSignal} index={i} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Footer */}
        {data && (
          <div className="mt-6 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[11px] text-[rgba(255,255,255,0.25)]">
              Updated {new Date(data.updatedAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })} · Refreshes every 6 hours
            </p>
            <p className="text-[11px] text-[rgba(255,255,255,0.20)]">
              insic DCF · Open each stock for the full model
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
