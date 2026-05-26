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
function SparklineSkeleton() {
  return <div className="h-8 w-full rounded-lg bg-slate-200/70 animate-pulse" />
}

function Sparkline({ values, positive }: { values: number[]; positive: boolean }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.001
  const W = 80
  const H = 32
  const coords = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - ((v - min) / range) * (H - 6) - 3,
  }))
  const pts      = coords.map(p => `${p.x},${p.y}`).join(' ')
  const fillPath = [
    `M ${coords[0].x},${H}`,
    ...coords.map(p => `L ${p.x},${p.y}`),
    `L ${coords[coords.length - 1].x},${H}`,
    'Z',
  ].join(' ')
  const color  = positive ? '#16a34a' : '#dc2626'
  const fillId = `sf-${positive ? 'g' : 'r'}`
  const last   = coords[coords.length - 1]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} className="overflow-visible w-full">
      <defs>
        <linearGradient id={fillId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%"   stopColor={color} stopOpacity="0.20" />
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
  if (changePct > 0.5)  return chip('Strengthening', 'amber')
  if (changePct < -0.5) return chip('Weakening', 'blue')
  return chip('Stable', 'gray')
}

function pct(v: number | null) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}

// Standard equity color: green up / red down
function equityCls(v: number | null) {
  if (v == null) return 'text-slate-400'
  return v > 0 ? 'text-emerald-600' : v < 0 ? 'text-red-500' : 'text-slate-500'
}

// Rate color: rising yield = amber warning, falling yield = blue (good for DCF)
function rateCls(v: number | null) {
  if (v == null) return 'text-slate-400'
  if (v > 0) return 'text-amber-600'
  if (v < 0) return 'text-blue-600'
  return 'text-slate-500'
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
  sparkLoading: boolean
  interpretation: React.ReactNode
  accent: string         // left-border accent color
  rateMode?: boolean     // inverts change color logic (for rate instruments)
  href?: string
  note?: string
}

function IndexCard({ label, value, changePct, sparklineValues, sparkLoading, interpretation, accent, rateMode, href, note }: CardProps) {
  const positive = rateMode
    ? (changePct ?? 0) < 0    // rate falling = "positive" for valuations
    : (changePct ?? 0) >= 0
  const changeCls = rateMode ? rateCls(changePct) : equityCls(changePct)

  const inner = (
    <div
      className="glass-card-light rounded-2xl px-4 pt-4 pb-3 flex flex-col gap-1 h-full transition-all hover:shadow-md cursor-pointer"
      style={{ borderLeft: `3px solid ${accent}` }}
    >
      <div className="flex items-start justify-between gap-1">
        <p className="text-[10.5px] font-bold text-slate-500 uppercase tracking-wider leading-tight">{label}</p>
        {interpretation}
      </div>
      <p className="text-2xl font-bold tabular-nums text-slate-900 leading-none mt-1">{value}</p>
      <div className="flex items-center justify-between mt-0.5">
        <span className={cn('text-[12px] font-semibold tabular-nums', changeCls)}>
          {pct(changePct)}
        </span>
        {note && <span className="text-[10px] text-slate-400">{note}</span>}
      </div>
      <div className="mt-2 min-h-[32px] flex items-end">
        {sparkLoading
          ? <SparklineSkeleton />
          : <Sparkline values={sparklineValues} positive={positive} />
        }
      </div>
    </div>
  )
  if (href) return <Link href={href} className="block h-full">{inner}</Link>
  return inner
}

// ── Grid ───────────────────────────────────────────────────────────────────────
type ChartPoint = Record<string, number | string>

// null = still loading; Record = loaded (may be empty if API failed)
type SparklinesState = Record<string, number[]> | null

export default function IndexSnapshotGrid({ spx, ndx, dji, vix, tnx, dxy }: Props) {
  const [sparklines, setSparklines] = useState<SparklinesState>(null)
  const sparkLoading = sparklines === null

  const fetchSparklines = useCallback(async () => {
    try {
      const symbols = ['^GSPC', '^NDX', '^DJI', '^VIX', '^TNX', 'DX-Y.NYB'].join(',')
      const res = await fetch(`/api/markets/chart?symbols=${encodeURIComponent(symbols)}&period=5D`)
      if (!res.ok) { setSparklines({}); return }
      const json = await res.json()
      const data: ChartPoint[] = json.points ?? []
      if (!Array.isArray(data) || data.length === 0) { setSparklines({}); return }
      const result: Record<string, number[]> = {}
      for (const sym of ['^GSPC', '^NDX', '^DJI', '^VIX', '^TNX', 'DX-Y.NYB']) {
        const vals = data
          .map(d => d[sym])
          .filter((v): v is number => typeof v === 'number')
        if (vals.length > 1) result[sym] = vals
      }
      setSparklines(result)
    } catch {
      setSparklines({}) // mark done, no data
    }
  }, [])

  useEffect(() => { fetchSparklines() }, [fetchSparklines])

  const CARDS: CardProps[] = [
    {
      label: 'S&P 500',
      value: spx?.price != null ? fmtPrice(spx.price) : '—',
      changePct: spx?.changePct ?? null,
      sparklineValues: sparklines?.['^GSPC'] ?? [],
      sparkLoading,
      interpretation: spxChip(spx?.changePct ?? null),
      accent: '#2563EB',
      href: spx ? `/markets/${encodeURIComponent(spx.symbol)}` : undefined,
    },
    {
      label: 'Nasdaq 100',
      value: ndx?.price != null ? fmtPrice(ndx.price) : '—',
      changePct: ndx?.changePct ?? null,
      sparklineValues: sparklines?.['^NDX'] ?? [],
      sparkLoading,
      interpretation: spxChip(ndx?.changePct ?? null),
      accent: '#2563EB',
      href: ndx ? `/markets/${encodeURIComponent(ndx.symbol)}` : undefined,
    },
    {
      label: 'Dow Jones',
      value: dji?.price != null ? fmtPrice(dji.price) : '—',
      changePct: dji?.changePct ?? null,
      sparklineValues: sparklines?.['^DJI'] ?? [],
      sparkLoading,
      interpretation: spxChip(dji?.changePct ?? null),
      accent: '#2563EB',
      href: dji ? `/markets/${encodeURIComponent(dji.symbol)}` : undefined,
    },
    {
      label: 'VIX',
      value: vix?.price != null ? fmtPrice(vix.price, 2) : '—',
      changePct: vix?.changePct ?? null,
      sparklineValues: sparklines?.['^VIX'] ?? [],
      sparkLoading,
      interpretation: vixChip(vix?.price ?? null),
      accent: '#7C3AED',
      note: 'Volatility',
    },
    {
      label: '10Y Treasury',
      value: tnx?.price != null ? fmtPrice(tnx.price, 2) + '%' : '—',
      changePct: tnx?.changePct ?? null,
      sparklineValues: sparklines?.['^TNX'] ?? [],
      sparkLoading,
      interpretation: tnxChip(tnx?.price ?? null),
      accent: '#D97706',
      rateMode: true,
      note: 'Discount rate',
    },
    {
      label: 'USD Index',
      value: dxy?.price != null ? fmtPrice(dxy.price, 2) : '—',
      changePct: dxy?.changePct ?? null,
      sparklineValues: sparklines?.['DX-Y.NYB'] ?? [],
      sparkLoading,
      interpretation: dxyChip(dxy?.changePct ?? null),
      accent: '#64748B',
    },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
      {CARDS.map(c => <IndexCard key={c.label} {...c} />)}
    </div>
  )
}
