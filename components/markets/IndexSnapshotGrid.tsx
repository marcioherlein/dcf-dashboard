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
  marketStatus?: { label: string; tone: 'green' | 'amber' | 'blue' | 'gray' } | null
}

// ── Chip tone → Tailwind classes (mirrors DESIGN.md semantic tokens) ──────────
const STATUS_CLS: Record<'green' | 'amber' | 'blue' | 'gray', string> = {
  green: 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]',
  amber: 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]',
  blue:  'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]',
  gray:  'bg-[#F5F5F5] text-[#6B6B6B] border-[#E5E5E5]',
}

// ── Interpretation chips ─────────────────────────────────────────────────────
function chip(label: string, tone: 'green' | 'red' | 'amber' | 'blue' | 'gray') {
  const cls = {
    green: 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]',
    red:   'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]',
    amber: 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]',
    blue:  'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]',
    gray:  'bg-[#F5F5F5] text-[#6B6B6B] border-[#E5E5E5]',
  }[tone]
  return (
    <span className={cn('text-[10px] font-[700] px-1.5 py-px rounded-full border whitespace-nowrap leading-none', cls)}>
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

function fmtPrice(v: number | null, decimals = 2) {
  if (v == null) return '—'
  return v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals })
}
function pct(v: number | null) {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + v.toFixed(2) + '%'
}
function changeCls(v: number | null, rateMode = false) {
  if (v == null) return 'text-[#9B9B9B]'
  const positive = rateMode ? v < 0 : v >= 0
  return positive ? 'text-[#11875D]' : 'text-[#D83B3B]'
}

// ── Micro sparkline (inline, 48×20) ──────────────────────────────────────────
function MicroSparkline({ values, positive, id: _id }: { values: number[]; positive: boolean; id: string }) {
  if (values.length < 2) return <div className="w-12 h-5 rounded bg-[#F5F5F5]" />
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = max - min || 0.001
  const W = 48, H = 20
  const coords = values.map((v, i) => ({
    x: (i / (values.length - 1)) * W,
    y: H - ((v - min) / range) * (H - 4) - 2,
  }))
  const pts = coords.map(p => `${p.x},${p.y}`).join(' ')
  const color = positive ? '#11875D' : '#D83B3B'
  const last = coords[coords.length - 1]
  return (
    <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true" className="shrink-0">
      <polyline points={pts} fill="none" stroke={color} strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" opacity="0.8" />
      <circle cx={last.x} cy={last.y} r="2" fill={color} />
    </svg>
  )
}

// ── Single ticker row item ────────────────────────────────────────────────────
interface TickerProps {
  label: string
  value: string
  rawChangePct: number | null
  sparkValues: number[]
  sparkLoading: boolean
  interpretation: React.ReactNode
  rateMode?: boolean
  href?: string
  divider?: boolean
  compact?: boolean
}

function TickerItem({ label, value, rawChangePct, sparkValues, sparkLoading, interpretation, rateMode, href, divider, compact }: TickerProps) {
  const positive = rateMode ? (rawChangePct ?? 0) < 0 : (rawChangePct ?? 0) >= 0
  const pctCls = changeCls(rawChangePct, rateMode)
  const sparkId = label.replace(/[^a-z0-9]/gi, '-').toLowerCase()

  const inner = compact ? (
    /* Compact layout for 3-col mobile grid */
    <div className="flex flex-col gap-0.5 py-2.5 px-2.5 group min-w-0 min-h-[56px] justify-center">
      <span className="text-[10px] font-[600] text-[#566174] leading-tight">{label}</span>
      <span className="text-[13px] font-[700] tabular-nums text-[#111111] leading-tight tracking-tight">{value}</span>
      <div className="flex items-center gap-1 flex-wrap">
        <span className={cn('text-[10px] font-[600] tabular-nums', pctCls)}>{pct(rawChangePct)}</span>
        <div className="shrink-0">{interpretation}</div>
      </div>
    </div>
  ) : (
    /* Full layout for desktop strip */
    <div className="flex items-center gap-2.5 py-3 px-3 sm:px-4 group min-w-0">
      {/* Label */}
      <span className="text-[11px] font-[600] text-[#566174] whitespace-nowrap shrink-0 group-hover:text-[#111111] transition-colors">
        {label}
      </span>
      {/* Value */}
      <span className="text-[13px] font-[700] tabular-nums text-[#111111] whitespace-nowrap shrink-0 tracking-tight">
        {value}
      </span>
      {/* Change */}
      <span className={cn('text-[11px] font-[600] tabular-nums whitespace-nowrap shrink-0', pctCls)}>
        {pct(rawChangePct)}
      </span>
      {/* Chip */}
      <div className="shrink-0">{interpretation}</div>
      {/* Micro sparkline */}
      <div className="shrink-0">
        {sparkLoading
          ? <div className="w-12 h-5 rounded bg-[#F5F5F5] animate-pulse" />
          : <MicroSparkline values={sparkValues} positive={positive} id={sparkId} />
        }
      </div>
    </div>
  )

  return (
    <div className={cn('flex items-stretch', divider && 'border-r border-[#E5E5E5]')}>
      {href ? (
        <Link href={href} className="flex-1 rounded-lg hover:bg-[#F5F5F5] transition-colors">
          {inner}
        </Link>
      ) : (
        <div className="flex-1">{inner}</div>
      )}
    </div>
  )
}

// ── Main grid ────────────────────────────────────────────────────────────────
type ChartPoint = Record<string, number | string>
type SparklinesState = Record<string, number[]> | null

export default function IndexSnapshotGrid({ spx, ndx, dji, vix, tnx, dxy, marketStatus }: Props) {
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
        const vals = data.map(d => d[sym]).filter((v): v is number => typeof v === 'number')
        if (vals.length > 1) result[sym] = vals
      }
      setSparklines(result)
    } catch {
      setSparklines({})
    }
  }, [])

  useEffect(() => { fetchSparklines() }, [fetchSparklines])

  const TICKERS: TickerProps[] = [
    {
      label: 'S&P 500',
      value: spx?.price != null ? fmtPrice(spx.price) : '—',
      rawChangePct: spx?.changePct ?? null,
      sparkValues: sparklines?.['^GSPC'] ?? [],
      sparkLoading,
      interpretation: spxChip(spx?.changePct ?? null),
      href: spx ? `/markets/${encodeURIComponent(spx.symbol)}` : undefined,
      divider: true,
    },
    {
      label: 'Nasdaq 100',
      value: ndx?.price != null ? fmtPrice(ndx.price) : '—',
      rawChangePct: ndx?.changePct ?? null,
      sparkValues: sparklines?.['^NDX'] ?? [],
      sparkLoading,
      interpretation: spxChip(ndx?.changePct ?? null),
      href: ndx ? `/markets/${encodeURIComponent(ndx.symbol)}` : undefined,
      divider: true,
    },
    {
      label: 'Dow Jones',
      value: dji?.price != null ? fmtPrice(dji.price) : '—',
      rawChangePct: dji?.changePct ?? null,
      sparkValues: sparklines?.['^DJI'] ?? [],
      sparkLoading,
      interpretation: spxChip(dji?.changePct ?? null),
      href: dji ? `/markets/${encodeURIComponent(dji.symbol)}` : undefined,
      divider: true,
    },
    {
      label: 'VIX',
      value: vix?.price != null ? fmtPrice(vix.price, 2) : '—',
      rawChangePct: vix?.changePct ?? null,
      sparkValues: sparklines?.['^VIX'] ?? [],
      sparkLoading,
      interpretation: vixChip(vix?.price ?? null),
      rateMode: true,
      divider: true,
    },
    {
      label: '10Y Treasury',
      value: tnx?.price != null ? fmtPrice(tnx.price, 2) + '%' : '—',
      rawChangePct: tnx?.changePct ?? null,
      sparkValues: sparklines?.['^TNX'] ?? [],
      sparkLoading,
      interpretation: tnxChip(tnx?.price ?? null),
      rateMode: true,
      divider: true,
    },
    {
      label: 'USD Index',
      value: dxy?.price != null ? fmtPrice(dxy.price, 2) : '—',
      rawChangePct: dxy?.changePct ?? null,
      sparkValues: sparklines?.['DX-Y.NYB'] ?? [],
      sparkLoading,
      interpretation: dxyChip(dxy?.changePct ?? null),
      divider: false,
    },
  ]

  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Status bar */}
      {marketStatus && (
        <div className="flex items-center gap-2 px-3 sm:px-4 py-1.5 border-b border-[#F5F5F5] bg-[#FAFAFA]">
          <span className={cn('text-[10px] font-[700] px-2 py-0.5 rounded-full border', STATUS_CLS[marketStatus.tone])}>
            {marketStatus.label}
          </span>
          <span className="text-[10px] text-[#9B9B9B]">5-day chart</span>
        </div>
      )}
      {/* Ticker grid — 3×2 on mobile, single row on md+ */}
      <div className="grid grid-cols-3 md:hidden">
        {TICKERS.map((t, i) => (
          <div key={t.label} className={cn(
            'border-[#F0F0F0]',
            i < 3 ? 'border-b' : '',
            i % 3 !== 2 ? 'border-r' : '',
          )}>
            <TickerItem {...t} divider={false} compact />
          </div>
        ))}
      </div>
      {/* Ticker strip — single row on md+ */}
      <div className="hidden md:flex">
        {TICKERS.map((t, i) => (
          <TickerItem key={t.label} {...t} divider={i < TICKERS.length - 1} />
        ))}
      </div>
    </div>
  )
}
