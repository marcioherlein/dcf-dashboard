'use client'
import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

// ─── Sector peer group definitions ────────────────────────────────────────────
// Each group is a curated peer set relevant to a DIY valuation investor.
// Tickers are chosen for coverage breadth and name recognition.

export const SECTOR_GROUPS = [
  {
    id: 'ai_cloud',
    label: 'AI & Cloud',
    color: '#2563EB',
    colorLight: '#EAF1FF',
    tickers: ['NVDA', 'MSFT', 'GOOGL', 'AMZN', 'META', 'PLTR'],
  },
  {
    id: 'semiconductors',
    label: 'Semiconductors',
    color: '#7C3AED',
    colorLight: '#EDE9FE',
    tickers: ['TSM', 'ASML', 'AVGO', 'AMD', 'QCOM', 'INTC'],
  },
  {
    id: 'software',
    label: 'Enterprise Software',
    color: '#0891B2',
    colorLight: '#CFFAFE',
    tickers: ['SAP', 'CRM', 'NOW', 'ORCL', 'WDAY', 'INTU'],
  },
  {
    id: 'consumer',
    label: 'Consumer & Retail',
    color: '#D97706',
    colorLight: '#FEF3C7',
    tickers: ['AMZN', 'WMT', 'COST', 'TGT', 'MCD', 'SBUX'],
  },
  {
    id: 'financials',
    label: 'Financials',
    color: '#059669',
    colorLight: '#D1FAE5',
    tickers: ['JPM', 'BAC', 'GS', 'MS', 'V', 'MA'],
  },
  {
    id: 'healthcare',
    label: 'Healthcare & Pharma',
    color: '#DC2626',
    colorLight: '#FEE2E2',
    tickers: ['LLY', 'JNJ', 'UNH', 'ABBV', 'MRK', 'PFE'],
  },
  {
    id: 'energy',
    label: 'Energy',
    color: '#CA8A04',
    colorLight: '#FEF9C3',
    tickers: ['XOM', 'CVX', 'COP', 'SLB', 'EOG', 'OXY'],
  },
  {
    id: 'ev_auto',
    label: 'EV & Autos',
    color: '#16A34A',
    colorLight: '#DCFCE7',
    tickers: ['TSLA', 'TM', 'GM', 'F', 'RIVN', 'NIO'],
  },
]

// ─── Types ────────────────────────────────────────────────────────────────────

interface StockQuote {
  symbol: string
  shortName: string | null
  price: number | null
  changePct: number | null      // 1D
  ytdChangePct: number | null
  sparkline: number[]           // ~20 intraday or recent closes
}

// ─── Sparkline ────────────────────────────────────────────────────────────────

function MiniSparkline({ values, color }: { values: number[]; color: string }) {
  if (values.length < 2) return <div className="h-10 w-full" />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.001
  const W = 120, H = 40
  const coords = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - ((v - min) / range) * (H - 6) - 3,
  }))
  const pts = coords.map(p => `${p.x},${p.y}`).join(' ')
  const fillPath = [
    `M ${coords[0].x},${H}`,
    ...coords.map(p => `L ${p.x},${p.y}`),
    `L ${coords[coords.length - 1].x},${H}`,
    'Z',
  ].join(' ')

  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="w-full overflow-visible" aria-hidden="true">
      <defs>
        <linearGradient id={`sg-fill-${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.15" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#sg-fill-${color.replace('#', '')})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  )
}

// ─── Single stock card ────────────────────────────────────────────────────────

function StockCard({ quote, color }: { quote: StockQuote; color: string }) {
  const up1d  = (quote.changePct ?? 0) >= 0
  const upYtd = (quote.ytdChangePct ?? 0) >= 0

  const fmt = (v: number | null, decimals = 2) => {
    if (v == null) return '—'
    return (v >= 0 ? '+' : '') + v.toFixed(decimals) + '%'
  }

  return (
    <Link
      href={`/stock/${quote.symbol}`}
      className="group flex flex-col rounded-xl border border-[#E5E5E5] bg-white p-3 hover:border-[#C8C8C8] hover:shadow-sm transition-all"
      style={{ minWidth: 0 }}
    >
      {/* Header: ticker + company */}
      <div className="flex items-start justify-between gap-1 mb-1">
        <div className="min-w-0">
          <p className="text-[11px] font-[800] text-[#111111] leading-tight">{quote.symbol}</p>
          <p className="text-[10px] text-[#9B9B9B] leading-tight truncate">{quote.shortName ?? quote.symbol}</p>
        </div>
      </div>

      {/* Price */}
      <p className="text-[16px] font-[800] tabular-nums text-[#111111] leading-tight mb-1.5">
        {quote.price != null ? quote.price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) : '—'}
      </p>

      {/* 1D + YTD badges */}
      <div className="flex items-center gap-1 mb-2 flex-wrap">
        {/* 1D */}
        <span className={cn(
          'text-[9px] font-[700] px-1.5 py-0.5 rounded-full border flex items-center gap-0.5',
          up1d
            ? 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]'
            : 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
        )}>
          {up1d ? '▲' : '▼'}{fmt(quote.changePct)} 1D
        </span>
        {/* YTD */}
        {quote.ytdChangePct != null && (
          <span className={cn(
            'text-[9px] font-[700] px-1.5 py-0.5 rounded-full border',
            upYtd
              ? 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]'
              : 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
          )}>
            {upYtd ? '▲' : '▼'}{fmt(quote.ytdChangePct)} YTD
          </span>
        )}
      </div>

      {/* Sparkline */}
      {quote.sparkline.length >= 2 && (
        <div className="mt-auto -mx-1">
          <MiniSparkline values={quote.sparkline} color={color} />
        </div>
      )}
    </Link>
  )
}

// ─── Single group row ─────────────────────────────────────────────────────────

function GroupRow({ group }: { group: typeof SECTOR_GROUPS[number] }) {
  const [quotes, setQuotes] = useState<StockQuote[]>([])
  const [loading, setLoading] = useState(true)
  const fetchedRef = useRef(false)

  useEffect(() => {
    if (fetchedRef.current) return
    fetchedRef.current = true
    fetch(`/api/markets/sector-stocks?tickers=${group.tickers.join(',')}`)
      .then(r => r.json())
      .then(d => { if (Array.isArray(d)) setQuotes(d) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [group.tickers])

  return (
    <div className="mb-5">
      {/* Group header */}
      <div className="flex items-center gap-2 mb-2.5">
        <span
          className="w-2.5 h-2.5 rounded-full shrink-0"
          style={{ background: group.color }}
          aria-hidden="true"
        />
        <h3 className="text-[12px] font-[800] uppercase tracking-[0.06em]" style={{ color: group.color }}>
          {group.label}
        </h3>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
        {loading
          ? group.tickers.map(t => (
              <div key={t} className="rounded-xl border border-[#E5E5E5] bg-white p-3 h-[140px] motion-safe:animate-pulse" />
            ))
          : (quotes.length > 0 ? quotes : group.tickers.map(t => ({
              symbol: t, shortName: null, price: null, changePct: null, ytdChangePct: null, sparkline: []
            }))).map(q => (
              <StockCard key={q.symbol} quote={q} color={group.color} />
            ))
        }
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface Props {
  groups?: typeof SECTOR_GROUPS
}

export default function SectorStocksCard({ groups = SECTOR_GROUPS }: Props) {
  const [activeGroup, setActiveGroup] = useState<string | null>(null)

  const visibleGroups = activeGroup
    ? groups.filter(g => g.id === activeGroup)
    : groups

  return (
    <div>
      {/* Group filter pills */}
      <div className="flex flex-wrap gap-1.5 mb-4 -mx-1 px-1 overflow-x-auto scrollbar-hide">
        <button
          onClick={() => setActiveGroup(null)}
          className={cn(
            'text-[11px] font-[650] px-3 py-1 rounded-full border transition-all whitespace-nowrap',
            activeGroup === null
              ? 'bg-[#111111] text-white border-[#111111]'
              : 'bg-white text-[#6B6B6B] border-[#E5E5E5] hover:border-[#C8C8C8]'
          )}
        >
          All sectors
        </button>
        {groups.map(g => (
          <button
            key={g.id}
            onClick={() => setActiveGroup(activeGroup === g.id ? null : g.id)}
            className="text-[11px] font-[650] px-3 py-1 rounded-full border transition-all whitespace-nowrap"
            style={activeGroup === g.id ? {
              background: g.color,
              color: 'white',
              borderColor: g.color,
            } : {
              background: 'white',
              color: '#6B6B6B',
              borderColor: '#E5E5E5',
            }}
          >
            {g.label}
          </button>
        ))}
      </div>

      {/* Group rows */}
      {visibleGroups.map(g => (
        <GroupRow key={g.id} group={g} />
      ))}
    </div>
  )
}
