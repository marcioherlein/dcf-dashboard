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
  vwo?:  MarketInstrument | null
  vgk?:  MarketInstrument | null
  mchi?: MarketInstrument | null
  botz?: MarketInstrument | null
  marketStatus?: { label: string; tone: 'green' | 'amber' | 'blue' | 'gray' } | null
}

// ── Chip tone → Tailwind classes ──────────────────────────────────────────────
const TONE_CLS: Record<'green' | 'red' | 'amber' | 'blue' | 'gray', string> = {
  green: 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]',
  red:   'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]',
  amber: 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]',
  blue:  'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]',
  gray:  'bg-[#F5F5F5] text-[#6B6B6B] border-[#E5E5E5]',
}
const STATUS_CLS = TONE_CLS

function chip(label: string, tone: 'green' | 'red' | 'amber' | 'blue' | 'gray') {
  return (
    <span className={cn('text-[10px] font-[700] px-1.5 py-px rounded-full border whitespace-nowrap leading-none', TONE_CLS[tone])}>
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
function etfChip(changePct: number | null) {
  if (changePct == null) return chip('—', 'gray')
  if (changePct > 1)  return chip('↑ Strong', 'green')
  if (changePct > 0)  return chip('↑ Up', 'blue')
  if (changePct > -1) return chip('↓ Soft', 'amber')
  return chip('↓ Weak', 'red')
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
  if (v == null) return 'text-[#6B6B6B]'
  const positive = rateMode ? v < 0 : v >= 0
  return positive ? 'text-[#11875D]' : 'text-[#D83B3B]'
}

// ── Single cell ───────────────────────────────────────────────────────────────
interface CellProps {
  label: string
  sublabel?: string
  value: string
  rawChangePct: number | null
  interpretation: React.ReactNode
  rateMode?: boolean
  href?: string
  borderRight?: boolean
  borderBottom?: boolean
}

function Cell({ label, sublabel, value, rawChangePct, interpretation, rateMode, href, borderRight, borderBottom }: CellProps) {
  const pctCls = changeCls(rawChangePct, rateMode)

  const inner = (
    <div className="flex flex-col gap-0.5 py-3 px-3 min-h-[64px] justify-center">
      <div className="flex items-center gap-1">
        <span className="text-[10px] font-[600] text-[#566174] leading-tight truncate">{label}</span>
        {sublabel && (
          <span className="text-[9px] font-[500] text-[#9B9B9B] leading-tight shrink-0">{sublabel}</span>
        )}
      </div>
      <span className="text-[14px] font-[700] tabular-nums text-[#111111] leading-tight tracking-tight">{value}</span>
      <div className="flex items-center gap-1 flex-wrap">
        <span className={cn('text-[10px] font-[600] tabular-nums', pctCls)}>{pct(rawChangePct)}</span>
        <div className="shrink-0">{interpretation}</div>
      </div>
    </div>
  )

  return (
    <div className={cn(
      borderRight  && 'border-r border-[#F0F0F0]',
      borderBottom && 'border-b border-[#F0F0F0]',
    )}>
      {href ? (
        <Link href={href} className="block rounded-md hover:bg-[#F8F8F8] transition-colors h-full">
          {inner}
        </Link>
      ) : (
        inner
      )}
    </div>
  )
}

// ── Main grid ────────────────────────────────────────────────────────────────
type ChartPoint = Record<string, number | string>

export default function IndexSnapshotGrid({ spx, ndx, dji, vix, tnx, dxy, vwo, vgk, mchi, botz, marketStatus }: Props) {
  const [_sparklines, setSparklines] = useState<Record<string, number[]> | null>(null)

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

  // 10 cells: 6 indices/rates + 4 ETFs
  // Grid: 5 cols × 2 rows on md+, 2 cols × 5 rows on mobile
  const CELLS: CellProps[] = [
    {
      label: 'S&P 500',
      value: fmtPrice(spx?.price ?? null),
      rawChangePct: spx?.changePct ?? null,
      interpretation: spxChip(spx?.changePct ?? null),
      href: spx ? `/markets/${encodeURIComponent(spx.symbol)}` : undefined,
    },
    {
      label: 'Nasdaq 100',
      value: fmtPrice(ndx?.price ?? null),
      rawChangePct: ndx?.changePct ?? null,
      interpretation: spxChip(ndx?.changePct ?? null),
      href: ndx ? `/markets/${encodeURIComponent(ndx.symbol)}` : undefined,
    },
    {
      label: 'Dow Jones',
      value: fmtPrice(dji?.price ?? null),
      rawChangePct: dji?.changePct ?? null,
      interpretation: spxChip(dji?.changePct ?? null),
      href: dji ? `/markets/${encodeURIComponent(dji.symbol)}` : undefined,
    },
    {
      label: 'VIX',
      value: fmtPrice(vix?.price ?? null, 2),
      rawChangePct: vix?.changePct ?? null,
      interpretation: vixChip(vix?.price ?? null),
      rateMode: true,
    },
    {
      label: '10Y Treasury',
      value: tnx?.price != null ? fmtPrice(tnx.price, 2) + '%' : '—',
      rawChangePct: tnx?.changePct ?? null,
      interpretation: tnxChip(tnx?.price ?? null),
      rateMode: true,
    },
    {
      label: 'USD Index',
      value: fmtPrice(dxy?.price ?? null, 2),
      rawChangePct: dxy?.changePct ?? null,
      interpretation: dxyChip(dxy?.changePct ?? null),
    },
    {
      label: 'Emerging',
      sublabel: 'VWO',
      value: fmtPrice(vwo?.price ?? null),
      rawChangePct: vwo?.changePct ?? null,
      interpretation: etfChip(vwo?.changePct ?? null),
    },
    {
      label: 'Europe',
      sublabel: 'VGK',
      value: fmtPrice(vgk?.price ?? null),
      rawChangePct: vgk?.changePct ?? null,
      interpretation: etfChip(vgk?.changePct ?? null),
    },
    {
      label: 'China',
      sublabel: 'MCHI',
      value: fmtPrice(mchi?.price ?? null),
      rawChangePct: mchi?.changePct ?? null,
      interpretation: etfChip(mchi?.changePct ?? null),
    },
    {
      label: 'AI & Robotics',
      sublabel: 'BOTZ',
      value: fmtPrice(botz?.price ?? null),
      rawChangePct: botz?.changePct ?? null,
      interpretation: etfChip(botz?.changePct ?? null),
    },
  ]

  // 10 items → 5 cols × 2 rows on md+, 2 cols × 5 rows on sm, wrap naturally
  return (
    <div className="bg-white border border-[#E5E5E5] rounded-xl overflow-hidden" style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}>
      {/* Status bar */}
      {marketStatus && (
        <div className="flex items-center gap-2 px-3 py-1.5 border-b border-[#F5F5F5] bg-[#FAFAFA]">
          <span className={cn('text-[10px] font-[700] px-2 py-0.5 rounded-full border', STATUS_CLS[marketStatus.tone])}>
            {marketStatus.label}
          </span>
          <span className="text-[10px] text-[#6B6B6B]">Live snapshot</span>
        </div>
      )}
      {/* Responsive grid — 2 cols on mobile, 5 cols on md+ — no overflow, no scroll */}
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-5">
        {CELLS.map((cell, i) => {
          const col = i % 5
          const row = Math.floor(i / 5)
          const totalRows = Math.ceil(CELLS.length / 5)
          return (
            <Cell
              key={cell.label}
              {...cell}
              borderRight={col < 4}
              borderBottom={row < totalRows - 1}
            />
          )
        })}
      </div>
    </div>
  )
}
