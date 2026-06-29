'use client'
import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'motion/react'
import {
  TrendingUp, TrendingDown, Zap, BarChart2, Star,
  RefreshCw, ExternalLink, Cpu, ArrowUpRight, Layers, UserCheck,
  List, LayoutGrid, Bookmark,
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
  accentColor: string
  emptyMsg: string
  isPrimary?: boolean
}[] = [
  {
    id: 'insic_dcf',
    label: 'insic DCF Discount',
    shortLabel: 'insic DCF',
    description: 'Stocks trading most below insic\'s DCF intrinsic value estimate. This uses a single-model DCF — open any stock for the full 4-model blended verdict with editable assumptions.',
    icon: Cpu,
    accentColor: '#60a5fa',
    emptyMsg: 'No DCF discount opportunities found today.',
    isPrimary: true,
  },
  {
    id: 'estimate_upgrades',
    label: 'Estimate Upgrades',
    shortLabel: 'Est. Upgrades',
    description: 'Stocks where analyst EPS estimates were revised up at least 2% over the last 90 days, and the stock still trades below insic\'s DCF fair value.',
    icon: ArrowUpRight,
    accentColor: '#4ade80',
    emptyMsg: 'No estimate-upgrade candidates found today.',
    isPrimary: true,
  },
  {
    id: 'insider_buying',
    label: 'Insider Buying',
    shortLabel: 'Insiders',
    description: 'Stocks where company insiders made net purchases in the last 90 days and the stock still trades below insic\'s DCF fair value or analyst consensus target.',
    icon: UserCheck,
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
    accentColor: '#a3e635',
    emptyMsg: 'No strongly undervalued stocks found today.',
  },
  {
    id: 'high_conviction',
    label: 'High Conviction',
    shortLabel: 'High Conviction',
    description: 'Stocks where analyst consensus is Buy or Strong Buy (rating ≤ 2.2/5) and the stock trades below insic\'s DCF fair value or analyst target implies at least 10% upside.',
    icon: Star,
    accentColor: '#5eead4',
    emptyMsg: 'No high-conviction picks today.',
  },
  {
    id: 'contrarian',
    label: 'Market Underestimates',
    shortLabel: 'Contrarian',
    description: 'Stocks where forward EPS growth expectations are well below the recent TTM revenue growth track record. The market may be underpricing the fundamentals.',
    icon: BarChart2,
    accentColor: '#86efac',
    emptyMsg: 'No contrarian signals found today.',
  },
  {
    id: 'priced_for_perfection',
    label: 'Priced for Perfection',
    shortLabel: 'Priced for Perfection',
    description: 'Stocks where forward EPS growth expectations exceed 25%. High expectations already in the price — small misses get punished hard.',
    icon: Zap,
    accentColor: '#fcd34d',
    emptyMsg: 'No stocks priced for perfection today.',
  },
  {
    id: 'near_52w_low',
    label: 'Near 52-Week Low',
    shortLabel: '52W Low',
    description: 'Stocks more than 25% below their 52-week high where insic DCF or analyst consensus still implies positive upside.',
    icon: TrendingDown,
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

function fmtMarketCap(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(1)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  return `$${(v / 1e6).toFixed(0)}M`
}

function relativeTime(iso: string): string {
  const ms = Date.now() - new Date(iso).getTime()
  const h = Math.floor(ms / 3600000)
  if (h < 1) return 'just now'
  if (h === 1) return '1h ago'
  if (h < 24) return `${h}h ago`
  const d = Math.floor(h / 24)
  return d === 1 ? '1d ago' : `${d}d ago`
}

// ─── Score Badge ──────────────────────────────────────────────────────────────

function ScoreBadge({ score }: { score: number }) {
  const color  = score >= 70 ? '#4ade80' : score >= 50 ? '#fbbf24' : 'rgba(255,255,255,0.40)'
  const bg     = score >= 70 ? 'rgba(74,222,128,0.12)' : score >= 50 ? 'rgba(251,191,36,0.12)' : 'rgba(255,255,255,0.07)'
  const border = score >= 70 ? 'rgba(74,222,128,0.30)' : score >= 50 ? 'rgba(251,191,36,0.25)' : 'rgba(255,255,255,0.12)'
  return (
    <span
      className="inline-flex items-center text-[11px] font-[800] px-2 py-0.5 rounded-full tabular-nums"
      style={{ background: bg, color, border: `1px solid ${border}` }}
      title={`Idea Score: ${score}/100`}
    >
      {score}
    </span>
  )
}

// ─── EPS Revision Badge ───────────────────────────────────────────────────────

function RevisionBadge({ revision }: { revision: IdeaStock['epsRevision'] }) {
  if (!revision) return null
  const { direction, magnitude } = revision
  if (direction === 'up') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-[700] px-1.5 py-0.5 rounded-full"
        style={{ background: 'rgba(74,222,128,0.12)', color: '#4ade80', border: '1px solid rgba(74,222,128,0.25)' }}>
        ↑ EPS {(magnitude * 100).toFixed(0)}%
      </span>
    )
  }
  if (direction === 'down') {
    return (
      <span className="inline-flex items-center gap-0.5 text-[10px] font-[700] px-1.5 py-0.5 rounded-full"
        style={{ background: 'rgba(248,113,113,0.12)', color: '#f87171', border: '1px solid rgba(248,113,113,0.25)' }}>
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
    A: { label: 'A', bg: 'rgba(96,165,250,0.12)', color: '#60a5fa', border: 'rgba(96,165,250,0.25)' },
    B: { bg: 'rgba(74,222,128,0.10)', color: '#4ade80', border: 'rgba(74,222,128,0.22)', label: 'B' },
    C: { bg: 'rgba(251,191,36,0.10)', color: '#fbbf24', border: 'rgba(251,191,36,0.22)', label: 'C' },
  }
  const style = map[band as 'A' | 'B' | 'C']
  return (
    <span className="inline-flex items-center text-[10px] font-[800] px-1.5 py-0.5 rounded-full"
      style={{ background: style.bg, color: style.color, border: `1px solid ${style.border}` }}>
      {style.label}
    </span>
  )
}

// ─── Evidence Chips ───────────────────────────────────────────────────────────

function EvidenceChips({ evidence }: { evidence: IdeaStock['evidenceList'] }) {
  if (!evidence || evidence.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {evidence.slice(0, 4).map(e => {
        const color = e.positive === true
          ? { text: '#86efac', bg: 'rgba(74,222,128,0.08)', border: 'rgba(74,222,128,0.18)' }
          : e.positive === false
          ? { text: '#fca5a5', bg: 'rgba(248,113,113,0.08)', border: 'rgba(248,113,113,0.18)' }
          : { text: 'rgba(255,255,255,0.50)', bg: 'rgba(255,255,255,0.05)', border: 'rgba(255,255,255,0.10)' }
        return (
          <span
            key={e.label}
            className="inline-flex items-center gap-1 text-[9px] font-[600] px-1.5 py-0.5 rounded-full leading-none"
            style={{ color: color.text, background: color.bg, border: `1px solid ${color.border}` }}
          >
            <span className="text-[rgba(255,255,255,0.30)] font-[500]">{e.label}</span>
            <span>{e.value}</span>
          </span>
        )
      })}
    </div>
  )
}

// ─── Risk Flag Chips ──────────────────────────────────────────────────────────

function RiskChips({ flags }: { flags: IdeaStock['riskFlags'] }) {
  if (!flags || flags.length === 0) return null
  return (
    <div className="flex flex-wrap gap-1 mb-2">
      {flags.map(f => (
        <span
          key={f.type}
          className="inline-flex items-center gap-0.5 text-[9px] font-[600] px-1.5 py-0.5 rounded-full leading-none"
          style={{ color: '#fca5a5', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)' }}
        >
          ⚠ {f.message}
        </span>
      ))}
    </div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function CardSkeleton() {
  return (
    <div
      className="rounded-xl p-4 animate-pulse"
      style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)', minHeight: '200px' }}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="h-5 w-14 rounded-full bg-[rgba(255,255,255,0.08)]" />
        <div className="h-5 w-8 rounded-full bg-[rgba(255,255,255,0.06)]" />
      </div>
      <div className="h-8 w-20 rounded bg-[rgba(255,255,255,0.07)] mb-2" />
      <div className="h-3 w-full rounded bg-[rgba(255,255,255,0.04)] mb-1.5" />
      <div className="h-3 w-4/5 rounded bg-[rgba(255,255,255,0.04)]" />
    </div>
  )
}

// ─── Idea Card ────────────────────────────────────────────────────────────────

function IdeaCard({ stock, signalId, index, accentColor }: {
  stock: IdeaStock
  signalId: SignalId
  index: number
  accentColor: string
}) {
  const [saved, setSaved] = useState(false)

  const primaryUpside = stock.insicUpsidePct ?? stock.upsidePct
  const primarySource = stock.insicUpsidePct != null ? 'vs insic DCF' : 'vs analyst target'
  const signalsAligned = stock.insicUpsidePct != null && stock.insicUpsidePct > 0 &&
    stock.upsidePct != null && stock.upsidePct > 0

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25, ease: [0.16, 1, 0.3, 1], delay: index * 0.03 }}
      className="flex flex-col h-full"
    >
      <div
        className="flex flex-col flex-1 rounded-xl overflow-hidden"
        style={{
          background: '#111827',
          border: `1px solid ${accentColor}25`,
          boxShadow: '0 1px 8px rgba(0,0,0,0.20)',
        }}
      >
        {/* Accent top bar */}
        <div className="h-[3px] shrink-0" style={{ background: `linear-gradient(90deg, ${accentColor}70 0%, transparent 70%)` }} />

        <div className="flex flex-col flex-1 p-4">
          {/* Header */}
          <div className="flex items-start justify-between mb-1.5 gap-2">
            <div className="flex flex-wrap items-center gap-1.5 min-w-0">
              <span
                className="text-[11px] font-[800] tracking-[0.04em] px-2 py-0.5 rounded-md"
                style={{ background: 'rgba(255,255,255,0.09)', color: 'rgba(255,255,255,0.90)' }}
              >
                {stock.ticker}
              </span>
              {stock.sector && (
                <span className="text-[10px] text-[rgba(255,255,255,0.38)] truncate max-w-[80px]">
                  {stock.sector}
                </span>
              )}
              <RevisionBadge revision={stock.epsRevision} />
              {stock.insiderSentiment?.sentiment === 'net_buyer' && (
                <span className="inline-flex items-center gap-0.5 text-[10px] font-[700] px-1.5 py-0.5 rounded-full"
                  style={{ background: 'rgba(167,139,250,0.10)', color: '#a78bfa', border: '1px solid rgba(167,139,250,0.20)' }}>
                  insider ↑
                </span>
              )}
            </div>
            <div className="flex items-center gap-1 shrink-0">
              {stock.ideaScore != null && <ScoreBadge score={stock.ideaScore} />}
              <ConvictionBadge band={stock.convictionBand} />
              <Link href={`/stock/${stock.ticker}`} tabIndex={-1}>
                <ExternalLink size={11} className="text-[rgba(255,255,255,0.18)] hover:text-[rgba(255,255,255,0.55)] transition-colors" />
              </Link>
            </div>
          </div>

          {/* Company name */}
          <p className="text-[11px] text-[rgba(255,255,255,0.40)] mb-1.5 truncate leading-tight">{stock.name}</p>

          {/* Primary metric */}
          <div className="flex items-baseline gap-2 mb-2">
            <span className="text-[22px] font-[900] leading-none tabular-nums" style={{ color: accentColor, letterSpacing: '-0.02em' }}>
              {fmtUpside(primaryUpside)}
            </span>
            <div className="flex flex-col">
              <span className="text-[10px] text-[rgba(255,255,255,0.32)] leading-tight">{primarySource}</span>
              <span className="text-[9px] text-[rgba(255,255,255,0.18)] leading-tight">single-model est.</span>
              {stock.insicFairValue != null && (
                <span className="text-[10px] text-[rgba(255,255,255,0.50)] tabular-nums leading-tight">
                  FV ${stock.insicFairValue.toFixed(2)}
                </span>
              )}
              {stock.price != null && (
                <span className="text-[10px] text-[rgba(255,255,255,0.32)] tabular-nums leading-tight">
                  {fmtPrice(stock.price, 'USD')} today
                </span>
              )}
            </div>
          </div>

          {/* Aligned badge */}
          {signalsAligned && (
            <div className="mb-1.5">
              <span className="inline-flex items-center gap-1 text-[9px] font-[700] px-1.5 py-0.5 rounded-full"
                style={{ background: 'rgba(96,165,250,0.08)', color: '#93c5fd', border: '1px solid rgba(96,165,250,0.18)' }}>
                ✓ DCF + analyst aligned
              </span>
            </div>
          )}

          {/* Evidence chips */}
          <EvidenceChips evidence={stock.evidenceList} />

          {/* Risk flags */}
          <RiskChips flags={stock.riskFlags} />

          {/* Signal metrics */}
          <div
            className="rounded-lg px-2.5 py-2 space-y-1 mt-auto"
            style={{ background: 'rgba(0,0,0,0.18)', border: '1px solid rgba(255,255,255,0.06)' }}
          >
            {(signalId === 'undervalued' || signalId === 'insic_dcf' || signalId === 'estimate_upgrades' || signalId === 'contrarian' || signalId === 'high_conviction') && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[rgba(255,255,255,0.32)]">Fwd EPS growth</span>
                <span className="text-[11px] font-[700] tabular-nums text-[rgba(255,255,255,0.70)]">{fmtCAGR(stock.impliedCAGR)}</span>
              </div>
            )}
            {signalId === 'priced_for_perfection' && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[rgba(255,255,255,0.32)]">Fwd EPS growth</span>
                <span className="text-[11px] font-[700] tabular-nums text-[#fcd34d]">{fmtCAGR(stock.impliedCAGR)}</span>
              </div>
            )}
            {signalId === 'near_52w_low' && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[rgba(255,255,255,0.32)]">52W position</span>
                <span className="text-[11px] font-[700] tabular-nums" style={{ color: accentColor }}>{fmtPctLow(stock.pctFrom52WHigh)}</span>
              </div>
            )}
            {stock.historicalCagr3y != null && signalId !== 'near_52w_low' && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[rgba(255,255,255,0.32)]">TTM rev growth</span>
                <span className="text-[11px] font-[700] tabular-nums" style={{ color: accentColor }}>
                  {fmtCAGR(stock.historicalCagr3y)}
                </span>
              </div>
            )}
            {stock.analystTarget != null && signalId !== 'insic_dcf' && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[rgba(255,255,255,0.32)]">Analyst 12m target</span>
                <span className="text-[11px] font-[700] tabular-nums text-[rgba(255,255,255,0.60)]">{fmtPrice(stock.analystTarget, 'USD')}</span>
              </div>
            )}
            {signalId === 'insider_buying' && stock.insiderSentiment && (
              <div className="flex items-center justify-between">
                <span className="text-[10px] text-[rgba(255,255,255,0.32)]">90-day transactions</span>
                <span className="text-[11px] font-[700] tabular-nums text-[#a78bfa]">
                  {stock.insiderSentiment.buyCount}B · {stock.insiderSentiment.sellCount}S
                </span>
              </div>
            )}
          </div>

          {/* Narrative hook */}
          {stock.narrativeHook && (
            <p className="text-[10px] text-[rgba(255,255,255,0.35)] mt-1.5 leading-snug">
              {stock.narrativeHook}
            </p>
          )}
        </div>

        {/* Action row */}
        <div className="flex items-center gap-2 px-4 py-2 border-t border-[rgba(255,255,255,0.06)]">
          {/* TODO: implement idea persistence via /api/ideas/save */}
          <button
            onClick={() => setSaved(v => !v)}
            className={cn(
              'flex items-center gap-1 text-[10px] font-[650] px-2 py-1 rounded-md transition-colors min-h-[28px]',
              saved
                ? 'bg-[rgba(96,165,250,0.12)] text-[#93c5fd]'
                : 'bg-[rgba(255,255,255,0.05)] text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.60)]'
            )}
          >
            <Bookmark size={10} />
            {saved ? 'Saved' : 'Save'}
          </button>
          <Link
            href={`/stock/${stock.ticker}`}
            className="ml-auto text-[10px] font-[650] text-[rgba(255,255,255,0.35)] hover:text-[rgba(255,255,255,0.70)] transition-colors flex items-center gap-1 min-h-[28px]"
          >
            Open model →
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Table View ───────────────────────────────────────────────────────────────

function IdeasTable({ stocks, accentColor }: { stocks: IdeaStock[]; accentColor: string }) {
  return (
    <div className="rounded-xl overflow-hidden" style={{ border: '1px solid rgba(255,255,255,0.10)' }}>
      <div className="overflow-x-auto">
        <table className="w-full min-w-[860px] text-[11px]">
          <thead>
            <tr style={{ background: 'rgba(255,255,255,0.05)', borderBottom: '1px solid rgba(255,255,255,0.08)' }}>
              {['Ticker', 'Score', 'Price', 'DCF FV', 'DCF ↑', 'Analyst ↑', 'EPS Rev', 'Insider', 'Rating', 'Sector', 'Mkt Cap', '52W'].map(h => (
                <th key={h} className="px-3 py-2 text-left font-[600] text-[rgba(255,255,255,0.45)] whitespace-nowrap first:pl-4">
                  {h}
                </th>
              ))}
              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {stocks.map(s => (
              <tr
                key={s.ticker}
                className="border-b border-[rgba(255,255,255,0.05)] hover:bg-[rgba(255,255,255,0.03)] transition-colors"
              >
                <td className="px-3 py-2.5 pl-4 whitespace-nowrap">
                  <div className="flex items-center gap-2">
                    <span className="font-[800] text-[rgba(255,255,255,0.90)] font-mono tracking-tight">{s.ticker}</span>
                    <span className="text-[rgba(255,255,255,0.30)] text-[10px] truncate max-w-[90px] hidden lg:block">{s.name}</span>
                  </div>
                </td>
                <td className="px-3 py-2.5">{s.ideaScore != null && <ScoreBadge score={s.ideaScore} />}</td>
                <td className="px-3 py-2.5 tabular-nums text-[rgba(255,255,255,0.70)]">
                  {s.price != null ? fmtPrice(s.price, 'USD') : '—'}
                </td>
                <td className="px-3 py-2.5 tabular-nums text-[rgba(255,255,255,0.55)]">
                  {s.insicFairValue != null ? `$${s.insicFairValue.toFixed(2)}` : '—'}
                </td>
                <td className="px-3 py-2.5 tabular-nums font-[700]" style={{ color: s.insicUpsidePct != null ? (s.insicUpsidePct > 0 ? accentColor : '#f87171') : 'rgba(255,255,255,0.25)' }}>
                  {fmtUpside(s.insicUpsidePct)}
                </td>
                <td className="px-3 py-2.5 tabular-nums" style={{ color: s.upsidePct != null ? (s.upsidePct > 0 ? '#86efac' : '#fca5a5') : 'rgba(255,255,255,0.25)' }}>
                  {fmtUpside(s.upsidePct)}
                </td>
                <td className="px-3 py-2.5">
                  {s.epsRevision ? (
                    <span style={{ color: s.epsRevision.direction === 'up' ? '#4ade80' : s.epsRevision.direction === 'down' ? '#f87171' : 'rgba(255,255,255,0.35)' }}>
                      {s.epsRevision.direction === 'up' ? '↑' : s.epsRevision.direction === 'down' ? '↓' : '—'}
                      {' '}{(Math.abs(s.epsRevision.magnitude) * 100).toFixed(0)}%
                    </span>
                  ) : <span className="text-[rgba(255,255,255,0.22)]">—</span>}
                </td>
                <td className="px-3 py-2.5">
                  {s.insiderSentiment ? (
                    <span style={{ color: s.insiderSentiment.sentiment === 'net_buyer' ? '#a78bfa' : s.insiderSentiment.sentiment === 'net_seller' ? '#f87171' : 'rgba(255,255,255,0.35)' }}>
                      {s.insiderSentiment.sentiment === 'net_buyer' ? '↑ buy' : s.insiderSentiment.sentiment === 'net_seller' ? '↓ sell' : 'neutral'}
                    </span>
                  ) : <span className="text-[rgba(255,255,255,0.22)]">—</span>}
                </td>
                <td className="px-3 py-2.5 tabular-nums" style={{ color: s.analystRating != null ? (s.analystRating <= 2.5 ? '#86efac' : s.analystRating >= 3.5 ? '#fca5a5' : 'rgba(255,255,255,0.60)') : 'rgba(255,255,255,0.22)' }}>
                  {s.analystRating != null ? s.analystRating.toFixed(1) : '—'}
                </td>
                <td className="px-3 py-2.5 text-[rgba(255,255,255,0.40)] truncate max-w-[90px]">{s.sector ?? '—'}</td>
                <td className="px-3 py-2.5 tabular-nums text-[rgba(255,255,255,0.50)]">{fmtMarketCap(s.marketCap)}</td>
                <td className="px-3 py-2.5 tabular-nums" style={{ color: s.pctFrom52WHigh != null ? (s.pctFrom52WHigh < -25 ? '#a78bfa' : 'rgba(255,255,255,0.45)') : 'rgba(255,255,255,0.22)' }}>
                  {s.pctFrom52WHigh != null ? `${s.pctFrom52WHigh.toFixed(0)}%` : '—'}
                </td>
                <td className="px-3 py-2.5">
                  <Link href={`/stock/${s.ticker}`} className="text-[rgba(255,255,255,0.25)] hover:text-[rgba(255,255,255,0.65)] transition-colors">
                    <ExternalLink size={11} />
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

// ─── Filter/Sort types ────────────────────────────────────────────────────────

type SortBy = 'score' | 'dcfUpside' | 'analystUpside' | 'epsRevision' | 'marketCap'
type MinUpside = 0 | 10 | 20 | 30
type ConvictionFilter = 'all' | 'A' | 'B' | 'C'

interface FilterState {
  sortBy: SortBy
  minUpside: MinUpside
  conviction: ConvictionFilter
  dcfOnly: boolean
}

function applyFiltersAndSort(stocks: IdeaStock[], f: FilterState): IdeaStock[] {
  let out = [...stocks]
  if (f.dcfOnly) out = out.filter(s => s.insicFairValue != null)
  if (f.conviction !== 'all') out = out.filter(s => s.convictionBand === f.conviction)
  if (f.minUpside > 0) {
    const threshold = f.minUpside / 100
    out = out.filter(s => (s.insicUpsidePct ?? s.upsidePct ?? -1) >= threshold)
  }
  out.sort((a, b) => {
    switch (f.sortBy) {
      case 'score':        return (b.ideaScore ?? 0) - (a.ideaScore ?? 0)
      case 'dcfUpside':    return (b.insicUpsidePct ?? -99) - (a.insicUpsidePct ?? -99)
      case 'analystUpside':return (b.upsidePct ?? -99) - (a.upsidePct ?? -99)
      case 'epsRevision':  return (b.epsRevision?.magnitude ?? -99) - (a.epsRevision?.magnitude ?? -99)
      case 'marketCap':    return (b.marketCap ?? 0) - (a.marketCap ?? 0)
      default: return 0
    }
  })
  return out
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function IdeasPage() {
  const [data, setData]               = useState<IdeasResponse | null>(null)
  const [loading, setLoading]         = useState(true)
  const [error, setError]             = useState(false)
  const [activeSignal, setActiveSignal] = useState<SignalId>('insic_dcf')
  const [groupBySector, setGroupBySector] = useState(false)
  const [viewMode, setViewMode]       = useState<'cards' | 'table'>('cards')
  const [filters, setFilters]         = useState<FilterState>({
    sortBy: 'score', minUpside: 0, conviction: 'all', dcfOnly: false,
  })

  useEffect(() => {
    setLoading(true)
    setError(false)
    fetch('/api/ideas')
      .then(async r => {
        if (!r.ok) throw new Error(`API error ${r.status}`)
        return r.json()
      })
      .then((d: IdeasResponse) => { setData(d); setLoading(false) })
      .catch(() => { setError(true); setLoading(false) })
  }, [])

  const activeSig  = SIGNALS.find(s => s.id === activeSignal)!
  const rawStocks  = useMemo(() => data?.signals[activeSignal] ?? [], [data, activeSignal])
  const stocks     = useMemo(() => applyFiltersAndSort(rawStocks, filters), [rawStocks, filters])

  const grouped: Record<string, IdeaStock[]> = useMemo(() => {
    if (!groupBySector) return {}
    const g: Record<string, IdeaStock[]> = {}
    for (const s of stocks) {
      const sec = s.sector ?? 'Other'
      if (!g[sec]) g[sec] = []
      g[sec].push(s)
    }
    return g
  }, [stocks, groupBySector])

  const setFilter = <K extends keyof FilterState>(key: K, value: FilterState[K]) =>
    setFilters(prev => ({ ...prev, [key]: value }))

  return (
    <div className="min-h-dvh" style={{ background: '#0d1117' }}>
      <div className="max-w-[1280px] mx-auto px-4 sm:px-6 lg:px-8 py-5 pb-[calc(80px+env(safe-area-inset-bottom,0px))] lg:pb-10">

        {/* Header */}
        <div className="mb-4">
          <div className="flex items-center gap-2 mb-1">
            <activeSig.icon size={17} style={{ color: activeSig.accentColor }} strokeWidth={2} />
            <h1 className="text-[20px] sm:text-[24px] font-bold text-white leading-tight" style={{ letterSpacing: '-0.025em' }}>
              Today&apos;s Ideas
            </h1>
          </div>
          <p className="text-[11px] text-[rgba(255,255,255,0.38)]">
            {data
              ? `${data.totalAnalyzed} stocks analyzed · ${data.dataCoverage != null ? `${data.dataCoverage.dataCoveragePct.toFixed(0)}% full data coverage · ` : ''}refreshed ${relativeTime(data.updatedAt)}`
              : 'Loading…'}
          </p>
        </div>

        {/* Disclaimer */}
        <div className="flex items-start gap-2 rounded-lg border border-[rgba(255,255,255,0.07)] bg-[rgba(255,255,255,0.02)] px-3.5 py-2.5 mb-4">
          <svg className="w-3 h-3 text-[rgba(255,255,255,0.22)] shrink-0 mt-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10"/><path strokeLinecap="round" d="M12 8v4m0 4h.01"/>
          </svg>
          <p className="text-[11px] text-[rgba(255,255,255,0.32)] leading-relaxed">
            Ideas are generated by insic&apos;s valuation models, not by human analysts. This is not investment advice.
            Past model outputs do not guarantee future returns.{' '}
            <a href="/methodology" className="underline hover:text-[rgba(255,255,255,0.55)]">How it works →</a>
          </p>
        </div>

        {/* Signal tabs */}
        <div className="-mx-4 sm:mx-0 px-4 sm:px-0 overflow-x-auto scrollbar-hide mb-4">
          <div className="flex gap-1.5 w-max sm:w-auto sm:flex-wrap">
            {SIGNALS.map(sig => {
              const Icon = sig.icon
              const isActive = activeSignal === sig.id
              return (
                <button
                  key={sig.id}
                  onClick={() => setActiveSignal(sig.id)}
                  className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-[600] transition-all whitespace-nowrap min-h-[40px]"
                  style={isActive ? {
                    background: 'rgba(255,255,255,0.11)',
                    color: 'rgba(255,255,255,0.90)',
                    border: `1px solid ${sig.accentColor}35`,
                  } : {
                    background: 'rgba(255,255,255,0.04)',
                    color: 'rgba(255,255,255,0.42)',
                    border: '1px solid rgba(255,255,255,0.07)',
                  }}
                >
                  <Icon size={11} strokeWidth={2.2} />
                  {sig.shortLabel}
                  {sig.isPrimary && !isActive && (
                    <span className="w-1.5 h-1.5 rounded-full ml-0.5" style={{ background: sig.accentColor }} />
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Description + view controls */}
        <div className="mb-3 flex flex-col sm:flex-row sm:items-start gap-2">
          <p className="text-[11px] text-[rgba(255,255,255,0.42)] leading-relaxed flex-1">{activeSig.description}</p>
          <div className="flex items-center gap-1.5 shrink-0">
            <div className="flex items-center gap-0.5 p-0.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.05)' }}>
              <button
                onClick={() => setViewMode('cards')}
                title="Card view"
                className={cn('p-1.5 rounded-md transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center', viewMode === 'cards' ? 'bg-[rgba(255,255,255,0.11)] text-white' : 'text-[rgba(255,255,255,0.32)] hover:text-[rgba(255,255,255,0.55)]')}
              >
                <LayoutGrid size={12} />
              </button>
              <button
                onClick={() => setViewMode('table')}
                title="Table view"
                className={cn('p-1.5 rounded-md transition-colors min-h-[32px] min-w-[32px] flex items-center justify-center', viewMode === 'table' ? 'bg-[rgba(255,255,255,0.11)] text-white' : 'text-[rgba(255,255,255,0.32)] hover:text-[rgba(255,255,255,0.55)]')}
              >
                <List size={12} />
              </button>
            </div>
            {viewMode === 'cards' && (
              <button
                onClick={() => setGroupBySector(v => !v)}
                className={cn(
                  'flex items-center gap-1 text-[11px] font-[600] px-2.5 py-1.5 rounded-lg transition-colors min-h-[32px]',
                  groupBySector ? 'bg-[rgba(255,255,255,0.11)] text-[rgba(255,255,255,0.85)]' : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.38)] hover:text-[rgba(255,255,255,0.62)]'
                )}
                style={{ border: '1px solid rgba(255,255,255,0.08)' }}
              >
                <Layers size={11} />
                Sector
              </button>
            )}
          </div>
        </div>

        {/* Filter bar */}
        <div className="flex flex-wrap items-center gap-2 mb-4 px-3 py-2.5 rounded-lg" style={{ background: 'rgba(255,255,255,0.03)', border: '1px solid rgba(255,255,255,0.07)' }}>
          {/* Sort */}
          <div className="flex items-center gap-1.5">
            <span className="text-[10px] text-[rgba(255,255,255,0.32)] shrink-0">Sort</span>
            <select
              value={filters.sortBy}
              onChange={e => setFilter('sortBy', e.target.value as SortBy)}
              className="text-[11px] font-[600] bg-[rgba(255,255,255,0.07)] text-[rgba(255,255,255,0.72)] border border-[rgba(255,255,255,0.10)] rounded-md px-2 py-1 focus:outline-none focus:border-[rgba(255,255,255,0.22)] cursor-pointer"
              style={{ fontSize: '11px' }}
            >
              <option value="score">Score</option>
              <option value="dcfUpside">DCF Upside</option>
              <option value="analystUpside">Analyst Upside</option>
              <option value="epsRevision">EPS Revision</option>
              <option value="marketCap">Market Cap</option>
            </select>
          </div>

          <div className="w-px h-4 bg-[rgba(255,255,255,0.08)] hidden sm:block" />

          {/* Min upside */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[rgba(255,255,255,0.32)] shrink-0">Min upside</span>
            {([0, 10, 20, 30] as MinUpside[]).map(v => (
              <button key={v} onClick={() => setFilter('minUpside', v)}
                className={cn('text-[10px] font-[650] px-2 py-0.5 rounded-md transition-colors min-h-[26px]',
                  filters.minUpside === v
                    ? 'bg-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.90)]'
                    : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.38)] hover:text-[rgba(255,255,255,0.62)]'
                )}>
                {v === 0 ? 'Any' : `≥${v}%`}
              </button>
            ))}
          </div>

          <div className="w-px h-4 bg-[rgba(255,255,255,0.08)] hidden sm:block" />

          {/* Conviction */}
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-[rgba(255,255,255,0.32)] shrink-0">Band</span>
            {(['all', 'A', 'B', 'C'] as ConvictionFilter[]).map(v => (
              <button key={v} onClick={() => setFilter('conviction', v)}
                className={cn('text-[10px] font-[650] px-2 py-0.5 rounded-md transition-colors min-h-[26px]',
                  filters.conviction === v
                    ? 'bg-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.90)]'
                    : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.38)] hover:text-[rgba(255,255,255,0.62)]'
                )}>
                {v === 'all' ? 'All' : v}
              </button>
            ))}
          </div>

          {/* DCF only */}
          <button
            onClick={() => setFilter('dcfOnly', !filters.dcfOnly)}
            className={cn('flex items-center gap-1 text-[10px] font-[650] px-2 py-0.5 rounded-md transition-colors min-h-[26px]',
              filters.dcfOnly
                ? 'bg-[rgba(96,165,250,0.12)] text-[#93c5fd]'
                : 'bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.38)] hover:text-[rgba(255,255,255,0.62)]'
            )}>
            DCF only
          </button>

          <span className="ml-auto text-[10px] text-[rgba(255,255,255,0.25)] tabular-nums">
            {stocks.length} result{stocks.length !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-lg px-4 py-3 text-[12px] flex items-center gap-2 mb-4"
            style={{ background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.18)', color: '#fca5a5' }}>
            <RefreshCw size={13} />
            Failed to load ideas. The API returned an error — please try refreshing.
          </div>
        )}

        {/* Content */}
        {!error && (
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div key="sk" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {Array.from({ length: 6 }).map((_, i) => <CardSkeleton key={i} />)}
              </motion.div>
            ) : stocks.length === 0 ? (
              <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="rounded-xl px-6 py-10 text-center"
                style={{ background: 'rgba(255,255,255,0.02)', border: '1px solid rgba(255,255,255,0.07)' }}>
                <p className="text-[13px] text-[rgba(255,255,255,0.32)]">
                  {rawStocks.length === 0 ? activeSig.emptyMsg : 'No results match your current filters.'}
                </p>
              </motion.div>
            ) : viewMode === 'table' ? (
              <motion.div key="table" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                <IdeasTable stocks={stocks} accentColor={activeSig.accentColor} />
              </motion.div>
            ) : groupBySector ? (
              <motion.div key="grouped" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="space-y-5">
                {Object.entries(grouped).map(([sector, ss]) => (
                  <div key={sector}>
                    <p className="text-[10px] font-[700] uppercase tracking-[0.08em] text-[rgba(255,255,255,0.28)] mb-2">{sector}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                      {ss.map((stock, i) => (
                        <IdeaCard key={stock.ticker} stock={stock} signalId={activeSignal} index={i} accentColor={activeSig.accentColor} />
                      ))}
                    </div>
                  </div>
                ))}
              </motion.div>
            ) : (
              <motion.div key="grid" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3">
                {stocks.map((stock, i) => (
                  <IdeaCard key={stock.ticker} stock={stock} signalId={activeSignal} index={i} accentColor={activeSig.accentColor} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        )}

        {/* Footer */}
        {data && !loading && (
          <div className="mt-6 flex items-center justify-between flex-wrap gap-2">
            <p className="text-[10px] text-[rgba(255,255,255,0.20)]">
              {data.totalAnalyzed} stocks analyzed
              {data.dataCoverage != null && ` · ${data.dataCoverage.dataCoveragePct.toFixed(0)}% full data coverage`}
              {data.dataCoverage != null && ` · ${data.dataCoverage.quoteSuccessCount} quotes · ${data.dataCoverage.summarySuccessCount} fundamentals · ${data.dataCoverage.dcfAvailableCount} DCF models`}
            </p>
            <p className="text-[10px] text-[rgba(255,255,255,0.16)]">
              single-model DCF · open each stock for the full 4-model blended analysis
            </p>
          </div>
        )}

      </div>
    </div>
  )
}
