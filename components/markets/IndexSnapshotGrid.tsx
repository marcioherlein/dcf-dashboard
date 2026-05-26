'use client'
import { useState, useEffect, useCallback } from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import type { MarketInstrument } from '@/app/api/markets/data/route'

interface Props {
  spx:  MarketInstrument | null
  ndx:  MarketInstrument | null
  dji:  MarketInstrument | null
  vix:  MarketInstrument | null
  tnx:  MarketInstrument | null
  dxy:  MarketInstrument | null
}

// ── Sparkline ──────────────────────────────────────────────────────────────────
function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return <div className="h-8 w-20" />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.001
  const W = 80
  const H = 32
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
  const color    = positive ? '#16a34a' : '#dc2626'
  const fillId   = `sf-${positive ? 'g' : 'r'}`
  const last     = coords[coords.length - 1]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible w-full">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.18" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>
      <path d={fillPath} fill={`url(#${fillId})`} />
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
      <circle cx={last.x} cy={last.y} r="2.5" fill={color} />
    </svg>
  )
}

// ── Interpretation chips ────────────────────────────────────────────────────────
function chip(label: string, tone: 'green' | 'red' | 'amber' | 'blue' | 'gray') {
  const cls = {
    green: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    red:   'bg-red-50 text-red-700 border-red-200',
    amber: 'bg-amber-50 text-amber-700 border-amber-200',
    blue:  'bg-blue-50 text-blue-700 border-blue-200',
    gray:  'bg-slate-100 text-slate-600 border-slate-200',
  }[tone]
  return (
    <span className={cn('text-[9.5px] font-bold px-1.5 py-0.5 rounded-full border', cls)}>
      {label}
    </span>
  )
}

function spxChip(changePct: number | null) {
  if (changePct == null) return chip('—', 'gray')
  if (changePct > 1)  return chip('Risk-On', 'green')
  if (changePct > 0)  return chip('Constructive', 'blue')
  if (changePct > -1) return chip('Cautious', 'amber')
  return chip('Risk-Off', 'red')
}

function vixChip(price: number | null) {
  if (price == null) return chip('—', 'gray')
  if (price < 15) return chip('Calm', 'green')
  if (price < 20) return chip('Normal', 'blue')
  if (price < 28) return chip('Elevated', 'amber')
  return chip('Stressed', 'red')
}

function tnxChip(price: number | null) {
  if (price == null) return chip('—', 'gray')
  if (price < 3.5) return chip('Low', 'green')
  if (price < 4.5) return chip('Moderate', 'blue')
  if (price < 5.5) return chip('Elevated', 'amber')
  return chip('High', 'red')
}

function dxyChip(changePct: number | null) {
  if (changePct == null) return chip('—', 'gray')
  if (changePct > 0.5) return chip('Strengthening', 'amber')
  if (changePct < -0.5) return chip('Weakening', 'blue')
  return chip('Stable', 'gray')
}

function pct(v: number | null) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

function pctCls(v: number | null) {
  if (v == null) return 'text-slate-400'
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-slate-500'
}

function fmtPrice(v: number | null, decimals = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}

// ── Single Card ────────────────────────────────────────────────────────────────
interface CardProps {
  label: string
  value: string
  changePct: number | null
  sparklineValues: number[]
  interpretation: React.ReactNode
  href?: string
  note?: string
}

function IndexCard({ label, value, changePct, sparklineValues, interpretation, href, note }: CardProps) {
  const positive = (changePct ?? 0) >= 0
  const inner = (
    <div className="glass-card-light rounded-2xl px-4 pt-4 pb-3 flex flex-col gap-1 h-full transition-all hover:shadow-md cursor-pointer">
      <div className="flex items-start justify-between">
        <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
        {interpretation}
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none mt-1">{value}</p>
      <div className="flex items-center justify-between mt-1">
        <span className={cn('text-[12px] font-semibold tabular-nums', pctCls(changePct))}>
          {pct(changePct)}
        </span>
        {note && <span className="text-[10px] text-slate-400">{note}</span>}
      </div>
      <div className="mt-2">
        <Sparkline values={sparklineValues} positive={positive} />
      </div>
    </div>
  )
  if (href) return <Link href={href} className="block">{inner}</Link>
  return inner
}

// ── Sparkline data fetch (5D normalized from chart API) ─────────────────────────
type ChartPoint = Record<string, number | string>

export default function IndexSnapshotGrid({ spx, ndx, dji, vix, tnx, dxy }: Props) {
  const [sparklines, setSparklines] = useState<Record<string, number[]>>({})

  const fetchSparklines = useCallback(async () => {
    try {
      const symbols = ['^GSPC', '^NDX', '^DJI', '^VIX', '^TNX', 'DX-Y.NYB'].join(',')
      const res = await fetch(`/api/markets/chart?symbols=${encodeURIComponent(symbols)}&period=5D`)
      if (!res.ok) return
      const json = await res.json()
      const data: ChartPoint[] = json.points ?? []
      if (!Array.isArray(data) || data.length === 0) return
      const result: Record<string, number[]> = {}
      const syms = ['^GSPC', '^NDX', '^DJI', '^VIX', '^TNX', 'DX-Y.NYB']
      for (const sym of syms) {
        result[sym] = data.map(d => (d[sym] as number) ?? 0).filter(v => typeof v === 'number')
      }
      setSparklines(result)
    } catch {
      // sparklines are optional enhancement; silently ignore errors
    }
  }, [])

  useEffect(() => { fetchSparklines() }, [fetchSparklines])

  const CARDS: CardProps[] = [
    {
      label: 'S&P 500',
      value: spx?.price != null ? fmtPrice(spx.price) : '—',
      changePct: spx?.changePct ?? null,
      sparklineValues: sparklines['^GSPC'] ?? [],
      interpretation: spxChip(spx?.changePct ?? null),
      href: spx ? `/markets/${encodeURIComponent(spx.symbol)}` : undefined,
    },
    {
      label: 'Nasdaq 100',
      value: ndx?.price != null ? fmtPrice(ndx.price) : '—',
      changePct: ndx?.changePct ?? null,
      sparklineValues: sparklines['^NDX'] ?? [],
      interpretation: spxChip(ndx?.changePct ?? null),
      href: ndx ? `/markets/${encodeURIComponent(ndx.symbol)}` : undefined,
    },
    {
      label: 'Dow Jones',
      value: dji?.price != null ? fmtPrice(dji.price) : '—',
      changePct: dji?.changePct ?? null,
      sparklineValues: sparklines['^DJI'] ?? [],
      interpretation: spxChip(dji?.changePct ?? null),
      href: dji ? `/markets/${encodeURIComponent(dji.symbol)}` : undefined,
    },
    {
      label: 'VIX',
      value: vix?.price != null ? fmtPrice(vix.price, 2) : '—',
      changePct: vix?.changePct ?? null,
      sparklineValues: sparklines['^VIX'] ?? [],
      interpretation: vixChip(vix?.price ?? null),
      note: 'Volatility',
    },
    {
      label: '10Y Treasury',
      value: tnx?.price != null ? fmtPrice(tnx.price, 2) + '%' : '—',
      changePct: tnx?.changePct ?? null,
      sparklineValues: sparklines['^TNX'] ?? [],
      interpretation: tnxChip(tnx?.price ?? null),
      note: 'Discount rate',
    },
    {
      label: 'USD Index',
      value: dxy?.price != null ? fmtPrice(dxy.price, 2) : '—',
      changePct: dxy?.changePct ?? null,
      sparklineValues: sparklines['DX-Y.NYB'] ?? [],
      interpretation: dxyChip(dxy?.changePct ?? null),
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {CARDS.map(c => <IndexCard key={c.label} {...c} />)}
    </div>
  )
}
