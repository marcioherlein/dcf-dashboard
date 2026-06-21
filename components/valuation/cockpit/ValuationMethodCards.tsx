'use client'

import { TrendingUp, BarChart2, BarChart, Target, RotateCcw, Undo2, BookOpen, Building2, Coins, Sigma } from 'lucide-react'
import {
  LineChart, Line, XAxis, YAxis, ResponsiveContainer,
  ReferenceLine, Tooltip,
} from 'recharts'
import { fmtPrice } from '@/lib/formatters'
import type { CockpitMethodResult, ValuationAssumptions } from '@/lib/valuation/cockpit'
import InfoTooltip from '@/components/ui/InfoTooltip'
import type { SparkPoint } from './AssumptionsPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  methods: CockpitMethodResult[]
  currentPrice: number
  currency: string
  fcfMargin?: number | null
  ttmEbitdaDollars?: number | null
  assumptions: ValuationAssumptions
  historicalData?: Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>
  onChange: (next: ValuationAssumptions) => void
  onReset: () => void
  onUndo: () => void
  canUndo: boolean
  sensitivity?: Partial<Record<keyof ValuationAssumptions, number>>
  sectorBenchmarks?: { exitPE: number; exitMultiple: number; revenueMultiple: number } | null
  onScrollToFullDCF: () => void
  fcfMarginSeries?: SparkPoint[]
  blendedFairValue?: number | null
  upsidePct?: number | null
  // Ratio context for historical + NTM display inside each method card
  analystForwardPE?: number | null
  ntmEVRevenue?: number | null
  companyType?: string | null
}

type IconComp = React.ComponentType<{ size?: number; className?: string }>

interface FieldDef {
  key: keyof ValuationAssumptions
  label: string
  unit: '%' | 'x'
  step: number
  min: number
  max: number
  chartKey?: keyof ValuationAssumptions
}

// ─── Per-method input definitions ─────────────────────────────────────────────

export const METHOD_INPUTS: Record<string, FieldDef[]> = {
  forward_pe: [
    { key: 'exitPE',    label: 'Exit P/E',        unit: 'x', step: 0.5,   min: 5,     max: 80,  chartKey: 'exitPE'    },
    { key: 'netMargin', label: 'Exit net margin',  unit: '%', step: 0.005, min: -0.20, max: 0.60, chartKey: 'netMargin' },
  ],
  ev_ebitda: [
    { key: 'exitMultiple', label: 'EV/EBITDA multiple', unit: 'x', step: 0.5, min: 4, max: 35, chartKey: 'exitMultiple' },
  ],
  revenue_multiple: [
    { key: 'revenueMultiple', label: 'EV/Revenue multiple', unit: 'x', step: 0.25, min: 0.5, max: 20, chartKey: 'revenueMultiple' },
  ],
  price_to_book: [
    { key: 'priceToBookMultiple', label: 'Target P/B', unit: 'x', step: 0.1, min: 0.3, max: 5.0, chartKey: 'priceToBookMultiple' },
  ],
  p_ffo: [
    { key: 'exitPFFOMultiple', label: 'P/FFO multiple', unit: 'x', step: 0.5, min: 8, max: 30, chartKey: 'exitPFFOMultiple' },
  ],
  ddm: [],
  core_dcf: [],
  // EPV has no user-adjustable inputs — fully deterministic from WACC + operating income
  epv: [],
}

// ─── Visual config per method ─────────────────────────────────────────────────

export const METHOD_CFG: Record<string, {
  iconBg: string; iconText: string
  barBg: string; valueBg: string; valueText: string
  chartHex: string
  cardBg: string      // dark gradient background like landing cards
  cardBorder: string  // subtle border on dark bg
  Icon: IconComp
}> = {
  // Forward P/E — deep navy
  forward_pe: {
    iconBg: 'bg-[#1a2d4a]', iconText: 'text-[#7eb8f7]',
    barBg: 'bg-[#3b82f6]', valueBg: 'bg-[#1a2d4a]', valueText: 'text-[#7eb8f7]',
    chartHex: '#3b82f6',
    cardBg: 'linear-gradient(145deg, #0f1e3a 0%, #1a3158 100%)',
    cardBorder: 'rgba(59,130,246,0.20)',
    Icon: TrendingUp as IconComp,
  },
  // EV/EBITDA — dark olive (brand primary)
  ev_ebitda: {
    iconBg: 'bg-[#1e2e0a]', iconText: 'text-[#a3e635]',
    barBg: 'bg-[#6F8F12]', valueBg: 'bg-[#1e2e0a]', valueText: 'text-[#a3e635]',
    chartHex: '#7C9A19',
    cardBg: 'linear-gradient(145deg, #1a2a06 0%, #2d4a0f 100%)',
    cardBorder: 'rgba(124,154,25,0.22)',
    Icon: BarChart2 as IconComp,
  },
  // Revenue multiple — dark slate-blue
  revenue_multiple: {
    iconBg: 'bg-[#1a2540]', iconText: 'text-[#93c5fd]',
    barBg: 'bg-[#2563EB]', valueBg: 'bg-[#1a2540]', valueText: 'text-[#93c5fd]',
    chartHex: '#60a5fa',
    cardBg: 'linear-gradient(145deg, #141e36 0%, #1e2f52 100%)',
    cardBorder: 'rgba(96,165,250,0.18)',
    Icon: BarChart as IconComp,
  },
  // Price-to-book — dark amber
  price_to_book: {
    iconBg: 'bg-[#2e1a00]', iconText: 'text-[#fcd34d]',
    barBg: 'bg-[#d97706]', valueBg: 'bg-[#2e1a00]', valueText: 'text-[#fcd34d]',
    chartHex: '#f59e0b',
    cardBg: 'linear-gradient(145deg, #271500 0%, #3d2200 100%)',
    cardBorder: 'rgba(245,158,11,0.20)',
    Icon: BookOpen as IconComp,
  },
  // P/FFO — dark amber-teal
  p_ffo: {
    iconBg: 'bg-[#0a2929]', iconText: 'text-[#5eead4]',
    barBg: 'bg-[#0d9488]', valueBg: 'bg-[#0a2929]', valueText: 'text-[#5eead4]',
    chartHex: '#14b8a6',
    cardBg: 'linear-gradient(145deg, #0a2929 0%, #134040 100%)',
    cardBorder: 'rgba(20,184,166,0.20)',
    Icon: Building2 as IconComp,
  },
  // DDM — dark green
  ddm: {
    iconBg: 'bg-[#0a2218]', iconText: 'text-[#4ade80]',
    barBg: 'bg-[#16a34a]', valueBg: 'bg-[#0a2218]', valueText: 'text-[#4ade80]',
    chartHex: '#22c55e',
    cardBg: 'linear-gradient(145deg, #0a1f12 0%, #133d20 100%)',
    cardBorder: 'rgba(34,197,94,0.18)',
    Icon: Coins as IconComp,
  },
  // EPV — dark indigo
  epv: {
    iconBg: 'bg-[#1a0a3a]', iconText: 'text-[#c4b5fd]',
    barBg: 'bg-[#7c3aed]', valueBg: 'bg-[#1a0a3a]', valueText: 'text-[#c4b5fd]',
    chartHex: '#8b5cf6',
    cardBg: 'linear-gradient(145deg, #130828 0%, #1e0f3d 100%)',
    cardBorder: 'rgba(139,92,246,0.22)',
    Icon: Sigma as IconComp,
  },
  // Core DCF — dark olive (brand, highest trust)
  core_dcf: {
    iconBg: 'bg-[#1e2e0a]', iconText: 'text-[#a3e635]',
    barBg: 'bg-[#5F790B]', valueBg: 'bg-[#1e2e0a]', valueText: 'text-[#a3e635]',
    chartHex: '#5F790B',
    cardBg: 'linear-gradient(145deg, #1e3a1e 0%, #2d5a2d 100%)',
    cardBorder: 'rgba(95,121,11,0.28)',
    Icon: Target as IconComp,
  },
}

export const CONFIDENCE_CHIP = {
  high:   { bg: 'bg-[rgba(74,222,128,0.15)] border-[rgba(74,222,128,0.30)]',  text: 'text-[#4ade80]', label: 'High confidence'   },
  medium: { bg: 'bg-[rgba(252,211,77,0.15)] border-[rgba(252,211,77,0.30)]',  text: 'text-[#fcd34d]', label: 'Medium confidence' },
  low:    { bg: 'bg-[rgba(252,165,165,0.15)] border-[rgba(252,165,165,0.25)]', text: 'text-[#fca5a5]', label: 'Low confidence'    },
}

// ─── Weight rationale by company type ────────────────────────────────────────

const WEIGHT_RATIONALE: Record<string, Record<string, string>> = {
  standard: {
    forward_pe:       'Tech and consumer companies have reliable earnings estimates, making forward P/E a strong anchor.',
    ev_ebitda:        'Capital-structure-neutral and comparable to peer acquisition multiples — a key cross-check for most businesses.',
    revenue_multiple: 'Used as a secondary cross-check; revenue is less volatile than earnings but ignores margin differences.',
    core_dcf:         'Discounts projected free cash flows at WACC — the fundamental building block of intrinsic value.',
    epv:              'A conservative zero-growth floor. Useful for mature businesses where growth assumptions are uncertain.',
    ddm:              'Relevant only when dividends are a primary return mechanism and are sustainable.',
    price_to_book:    'Less informative for asset-light businesses; included as a sanity check on asset values.',
    p_ffo:            'Not the primary driver for standard companies; included for completeness.',
  },
  high_growth: {
    forward_pe:       'Early-stage companies often lack consistent earnings, making P/E less reliable as a standalone anchor.',
    ev_ebitda:        'EBITDA may not exist yet for pre-profit growth companies; weighted lower accordingly.',
    revenue_multiple: 'Revenue is typically the most reliable metric for high-growth businesses where margins are still ramping.',
    core_dcf:         'Long-duration cash flows amplify WACC sensitivity — used as a directional check, not the primary anchor.',
    epv:              'Zero-growth floor is not informative for businesses in aggressive expansion; low weight.',
    ddm:              'High-growth companies rarely pay dividends; excluded or minimal.',
    price_to_book:    'Asset-light growth businesses are not well-described by book value.',
    p_ffo:            'Not applicable.',
  },
  financial: {
    forward_pe:       'Banks and insurers are best valued on earnings power — P/E is a primary anchor for financials.',
    ev_ebitda:        'EV/EBITDA is less meaningful for financials where debt is a product input, not pure leverage.',
    revenue_multiple: 'Revenue multiples are uncommon for financial firms; interest income and fee income differ structurally.',
    core_dcf:         'FCFF DCF is complex for financials due to regulatory capital constraints; treated as a secondary check.',
    epv:              'Earnings Power Value works well for banks — normalized earnings at cost of equity.',
    ddm:              'Dividends are a primary shareholder return mechanism for regulated banks; DDM is highly relevant.',
    price_to_book:    'Book value reflects tangible equity; P/B is a core valuation anchor for all financial institutions.',
    p_ffo:            'Not applicable to banks or insurers.',
  },
  reit: {
    forward_pe:       'Net income is distorted by depreciation for REITs; forward P/E is a weaker signal.',
    ev_ebitda:        'EV/EBITDA is useful but NOI-based metrics are more common in real estate analysis.',
    revenue_multiple: 'Revenue multiples are uncommon for REITs; income yield is the preferred metric.',
    core_dcf:         'AFFO-based DCF is the industry standard for REIT intrinsic value.',
    epv:              'Earnings Power Value adapted for REITs using NOI.',
    ddm:              'Dividend yield is a primary return metric for income-oriented REIT investors.',
    price_to_book:    'P/B is a secondary check; NAV-based analysis is preferred.',
    p_ffo:            'P/FFO is the primary REIT valuation anchor — FFO adds back depreciation to reflect true cash earnings.',
  },
  utility: {
    forward_pe:       'Utilities have stable regulated earnings; P/E is a reasonable anchor.',
    ev_ebitda:        'EV/EBITDA is widely used for regulated utilities given predictable EBITDA.',
    revenue_multiple: 'Revenue multiples are not standard for regulated utilities.',
    core_dcf:         'Rate-base DCF is the regulatory-approved method; FCFF DCF is a cross-check.',
    epv:              'Normalized earnings at WACC — works well for utilities with stable returns on equity.',
    ddm:              'Utilities are dividend payers; DDM captures the income component of total return.',
    price_to_book:    'Rate-base P/B is common in utility valuation.',
    p_ffo:            'Not standard for traditional utilities.',
  },
  cyclical: {
    forward_pe:       'Earnings estimates at cyclical peaks are unreliable; P/E can appear cheap just before a downturn.',
    ev_ebitda:        'Mid-cycle EV/EBITDA normalizes for cyclical swings better than point-in-time P/E.',
    revenue_multiple: 'Revenue is more stable through cycles than earnings for commodity-linked businesses.',
    core_dcf:         'Mid-cycle FCF assumption reduces peak/trough distortion.',
    epv:              'Normalized NOPAT using 5Y average reduces cyclical noise; given higher weight for cyclicals.',
    ddm:              'Dividends are volatile for cyclicals; DDM is a weak anchor in this sector.',
    price_to_book:    'Asset replacement value is meaningful for capital-intensive cyclical businesses.',
    p_ffo:            'Not standard.',
  },
  bdc: {
    forward_pe:       'Net investment income (NII) is a better earnings proxy than GAAP EPS for BDCs.',
    ev_ebitda:        'Not applicable to BDCs.',
    revenue_multiple: 'Revenue multiples are uncommon for BDCs.',
    core_dcf:         'BDC intrinsic value is best estimated via NII yield, not FCFF DCF.',
    epv:              'Earnings power reflects sustainable NII; relevant for BDC valuation.',
    ddm:              'BDC distributions are required by law (90%+ of income); DDM is the primary anchor.',
    price_to_book:    'P/NAV (price-to-net-asset-value) is the dominant BDC multiple.',
    p_ffo:            'Not applicable.',
  },
  mreeit: {
    forward_pe:       'GAAP earnings are distorted by mark-to-market for mortgage REITs; P/E is unreliable.',
    ev_ebitda:        'Not meaningful for leveraged mortgage portfolios.',
    revenue_multiple: 'Not applicable.',
    core_dcf:         'Net interest spread DCF is used as a secondary check.',
    epv:              'Normalized NII-based EPV.',
    ddm:              'Distributions are the primary return; DDM is highly relevant for mREITs.',
    price_to_book:    'P/Book (book = tangible equity) is the primary mREIT anchor — reflects leverage and write-down risk.',
    p_ffo:            'Not applicable.',
  },
  mining: {
    forward_pe:       'Earnings are commodity-price-sensitive; forward P/E at spot may be misleading.',
    ev_ebitda:        'EV/EBITDA at mid-cycle commodity price is the industry standard for miners.',
    revenue_multiple: 'Revenue multiples are sometimes used on a per-unit-of-production basis.',
    core_dcf:         'NAV DCF using reserve life is the primary intrinsic value method for miners.',
    epv:              'Normalized NOPAT using mid-cycle prices reduces commodity distortion.',
    ddm:              'Dividends vary with commodity prices; DDM is a secondary input.',
    price_to_book:    'P/NAV is the preferred version; tangible book is a fallback.',
    p_ffo:            'Not applicable.',
  },
  insurance: {
    forward_pe:       'Combined ratio and reserve adequacy drive earnings quality — P/E requires careful normalization.',
    ev_ebitda:        'EBITDA is not a standard metric for insurance; operating earnings are preferred.',
    revenue_multiple: 'Premiums earned multiples exist but are uncommon in equity analysis.',
    core_dcf:         'Embedded value or free capital generation DCF is industry practice.',
    epv:              'Normalized earnings at cost of equity; useful for stable P&C books.',
    ddm:              'Dividends are a key signal of capital adequacy; DDM carries weight for insurers.',
    price_to_book:    'P/B to tangible equity (adjusted for unrealized gains) is the primary anchor.',
    p_ffo:            'Not applicable.',
  },
}

function getWeightRationale(methodId: string, companyType: string): string {
  const byType = WEIGHT_RATIONALE[companyType] ?? WEIGHT_RATIONALE.standard
  return byType[methodId] ?? WEIGHT_RATIONALE.standard[methodId] ?? 'Weight reflects data availability and model reliability for this company type.'
}

// ─── Per-method formula one-liner ────────────────────────────────────────────

const METHOD_FORMULA: Record<string, string> = {
  forward_pe:       'FV = (Revenue × netMargin × exitPE) ÷ (1 + Ke)⁵',
  ev_ebitda:        'FV = (EBITDA × exitMultiple − netDebt) ÷ shares',
  revenue_multiple: 'FV = (Revenue × exitEVRevenue − netDebt) ÷ shares',
  core_dcf:         'FV = Σ FCFt ÷ (1+WACC)ᵗ + TV ÷ (1+WACC)ⁿ − netDebt ÷ shares',
  epv:              'FV = NOPAT ÷ WACC − netDebt ÷ shares  (zero-growth floor)',
  ddm:              'FV = DPS × (1+g) ÷ (Ke − g)  (Gordon Growth)',
  price_to_book:    'FV = BookValue per share × targetP/B',
  p_ffo:            'FV = FFO per share × targetP/FFO',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

export function fmt(value: number, unit: '%' | 'x'): string {
  if (unit === '%') return `${(value * 100).toFixed(1)}%`
  return `${value.toFixed(1)}×`
}

function median(vals: number[]): number | null {
  if (vals.length === 0) return null
  const s = [...vals].sort((a, b) => a - b)
  const m = Math.floor(s.length / 2)
  return s.length % 2 !== 0 ? s[m] : (s[m - 1] + s[m]) / 2
}

function historicalHint(series: SparkPoint[] | undefined, unit: '%' | 'x'): string | null {
  if (!series || series.length === 0) return null
  const vals = series.filter(p => p.label !== 'curr').map(p => p.value)
  const med = median(vals)
  if (med == null) return null
  return `Median ~${fmt(med, unit)}`
}

// ─── TinyLineChart ────────────────────────────────────────────────────────────

export function TinyLineChart({
  data, title, color, refValue, yFormat,
}: {
  data: SparkPoint[]
  title: string
  color: string
  refValue?: number
  yFormat: (v: number) => string
}) {
  const chartData = data.filter(p => p.label !== 'curr')
  const currPoint = data.find(p => p.label === 'curr')

  if (chartData.length < 2) {
    // Show current value as a single stat when no history is available
    if (currPoint != null) {
      return (
        <div className="flex flex-col" role="img" aria-label={`${title}: current value`}>
          <p className="text-[10px] font-[600] text-[#6B6B6B] mb-2">{title}</p>
          <div className="flex flex-col items-center justify-center rounded-lg bg-[#F5F5F5] border border-[#E3E1DA]" style={{ height: 120 }}>
            <p className="text-[18px] font-[700] tabular-nums" style={{ color }}>{yFormat(currPoint.value)}</p>
            <p className="text-[9px] text-[#9B9B9B] mt-1">Current · no history</p>
          </div>
        </div>
      )
    }
    return (
      <div className="flex flex-col" role="img" aria-label={`${title}: no data`}>
        <p className="text-[10px] font-[600] text-[#6B6B6B] mb-2">{title}</p>
        <div className="flex items-center justify-center rounded-lg bg-[#F5F5F5] border border-[#E3E1DA]" style={{ height: 120 }}>
          <p className="text-[10px] text-[#9B9B9B]">No data</p>
        </div>
      </div>
    )
  }

  // Compute Y-axis width from longest formatted tick so values never clip
  const allVals = chartData.map(p => p.value)
  const [yMin, yMax] = [Math.min(...allVals), Math.max(...allVals)]
  const longestTick = [yMin, yMax].map(v => yFormat(v)).reduce((a, b) => a.length >= b.length ? a : b, '')
  const yWidth = Math.max(32, longestTick.length * 6.5 + 4)

  // For quarterly data (12 points), show one tick per year; for annual (≤6), show all
  const yearFromLabel = (label: string) => {
    const m = label.match(/'(\d{2})/)
    return m ? `20${m[1]}` : label
  }
  const tickSet = new Set<string>()
  const filteredTicks = chartData
    .map(p => p.label)
    .filter(label => {
      const yr = yearFromLabel(label)
      if (tickSet.has(yr)) return false
      tickSet.add(yr)
      return true
    })

  return (
    <div className="flex flex-col" role="img" aria-label={title}>
      <p className="text-[10px] font-[600] text-[#6B6B6B] mb-2">{title}</p>
      <ResponsiveContainer width="100%" height={120}>
        <LineChart data={chartData} margin={{ top: 8, right: 8, bottom: 4, left: 0 }}>
          <XAxis
            dataKey="label"
            tick={{ fontSize: 10, fill: '#8A95A6' }}
            tickLine={false}
            axisLine={false}
            ticks={filteredTicks}
            tickFormatter={yearFromLabel}
          />
          <YAxis
            tick={{ fontSize: 10, fill: '#8A95A6' }}
            tickLine={false}
            axisLine={false}
            tickFormatter={yFormat}
            width={yWidth}
            tickCount={4}
            domain={['auto', 'auto']}
          />
          <Tooltip
            cursor={{ stroke: '#E3E1DA', strokeWidth: 1 }}
            contentStyle={{
              background: 'white',
              border: '1px solid #E3E1DA',
              borderRadius: 6,
              fontSize: 11,
              padding: '4px 10px',
              boxShadow: '0 2px 8px rgba(0,0,0,0.08)',
            }}
            itemStyle={{ color: '#374151', padding: 0 }}
            labelStyle={{ color: '#8A95A6', fontSize: 10, marginBottom: 2 }}
            formatter={(v) => [typeof v === 'number' ? yFormat(v) : '—', '']}
          />
          {refValue != null && (
            <ReferenceLine
              y={refValue}
              stroke="#f59e0b"
              strokeDasharray="4 3"
              strokeWidth={1.5}
            />
          )}
          <Line
            type="monotone"
            dataKey="value"
            stroke={color}
            strokeWidth={2}
            dot={false}
            isAnimationActive={false}
            activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  )
}

// ─── FieldStepper ─────────────────────────────────────────────────────────────

export function FieldStepper({
  label, value, unit, step, min, max, onChange, hint, color,
  sectorBenchmark, analystValue,
}: {
  label: string; value: number; unit: '%' | 'x'
  step: number; min: number; max: number
  onChange: (v: number) => void
  hint?: string | null; color: string
  sectorBenchmark?: number | null
  analystValue?: number | null
}) {
  const atMin = value <= min
  const atMax = value >= max
  const dec = () => { if (!atMin) onChange(Math.max(min, parseFloat((value - step).toFixed(6)))) }
  const inc = () => { if (!atMax) onChange(Math.min(max, parseFloat((value + step).toFixed(6)))) }

  const provenanceParts: string[] = []
  if (hint) provenanceParts.push(hint)
  if (sectorBenchmark != null) provenanceParts.push(`Sector: ${fmt(sectorBenchmark, unit)}`)
  if (analystValue != null) provenanceParts.push(`Analysts: ${fmt(analystValue, unit)}`)
  const provenanceLine = provenanceParts.join(' · ')

  return (
    <div className="flex items-center justify-between gap-2">
      <div className="min-w-0">
        <p className="text-[10px] text-[rgba(255,255,255,0.50)] leading-none">{label}</p>
        {provenanceLine && <p className="text-[11px] text-[rgba(255,255,255,0.30)] mt-0.5 tabular-nums">{provenanceLine}</p>}
      </div>
      <div className="flex items-center gap-0.5 shrink-0">
        <button
          onClick={dec}
          disabled={atMin}
          aria-label={`Decrease ${label}`}
          className="w-11 h-11 flex items-center justify-center rounded-full disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9A19] focus-visible:ring-offset-1"
        >
          <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-[13px] font-bold select-none transition-colors ${
            atMin
              ? 'border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.20)]'
              : 'border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.70)] hover:bg-[rgba(255,255,255,0.15)]'
          }`}>
            −
          </span>
        </button>
        <span
          className="text-[13px] font-[750] tabular-nums w-[52px] text-center text-white"
          style={{ color: value !== min ? color : undefined }}
        >
          {fmt(value, unit)}
        </span>
        <button
          onClick={inc}
          disabled={atMax}
          aria-label={`Increase ${label}`}
          className="w-11 h-11 flex items-center justify-center rounded-full disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#7C9A19] focus-visible:ring-offset-1"
        >
          <span className={`w-6 h-6 rounded-full border flex items-center justify-center text-[13px] font-bold select-none transition-colors ${
            atMax
              ? 'border-[rgba(255,255,255,0.10)] bg-[rgba(255,255,255,0.04)] text-[rgba(255,255,255,0.20)]'
              : 'border-[rgba(255,255,255,0.18)] bg-[rgba(255,255,255,0.08)] text-[rgba(255,255,255,0.70)] hover:bg-[rgba(255,255,255,0.15)]'
          }`}>
            +
          </span>
        </button>
      </div>
    </div>
  )
}

// ─── SharedCAGRPanel ──────────────────────────────────────────────────────────
// Only the CAGR stepper — charts live exclusively in KeyAssumptionsSection below.

export function SharedCAGRPanel({
  value, step = 0.005, min = -0.05, max = 0.60,
  onChange, cagrSeries,
  color = '#8b5cf6',
}: {
  value: number
  step?: number
  min?: number
  max?: number
  onChange: (v: number) => void
  cagrSeries?: SparkPoint[]
  peSeries?: SparkPoint[]
  evRevSeries?: SparkPoint[]
  peAssumption?: number
  evRevAssumption?: number
  color?: string
}) {
  const hint = historicalHint(cagrSeries, '%')

  return (
    <div className="rounded-xl border border-[#E3E1DA] bg-[#FAFAFA] px-5 py-3.5 mb-3">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="min-w-0">
          <p className="text-[12px] font-[650] text-[#111111]">Revenue CAGR</p>
          <p className="text-[11px] text-[#9B9B9B]">Shared by Forward P/E and Revenue Multiple</p>
        </div>
        <FieldStepper
          label="5Y growth rate"
          value={value}
          unit="%"
          step={step}
          min={min}
          max={max}
          onChange={onChange}
          hint={hint}
          color={color}
        />
      </div>
    </div>
  )
}

// ─── DCF driver display (read-only) ───────────────────────────────────────────

function DcfDriverRow({
  fcfMargin, ttmEbitdaDollars,
}: { fcfMargin?: number | null; ttmEbitdaDollars?: number | null }) {
  return (
    <div className="space-y-1.5">
      {fcfMargin != null && fcfMargin > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#6B6B6B]">FCF margin (TTM)</span>
          <span className="text-[11px] font-[650] text-[#11875D] tabular-nums">
            {(fcfMargin * 100).toFixed(1)}%
          </span>
        </div>
      )}
      {ttmEbitdaDollars != null && ttmEbitdaDollars > 0 && (
        <div className="flex items-center justify-between">
          <span className="text-[10px] text-[#6B6B6B]">TTM EBITDA</span>
          <span className="text-[11px] font-[650] text-[#111111] tabular-nums">
            {ttmEbitdaDollars >= 1e9
              ? `$${(ttmEbitdaDollars / 1e9).toFixed(1)}B`
              : `$${(ttmEbitdaDollars / 1e6).toFixed(0)}M`
            }
          </span>
        </div>
      )}
    </div>
  )
}

// ─── SynthesisBox ─────────────────────────────────────────────────────────────
// The "Blended Fair Value (Synthesis)" header box. Shows blended FV, upside,
// WACC, model count, and a legend of method weights. Arrows drop from here
// down to the method cards below.

function SynthesisBox({
  blendedFairValue, upsidePct, currency, wacc, methods, validTotal,
}: {
  blendedFairValue: number | null
  upsidePct: number | null
  currency: string
  wacc: number
  methods: CockpitMethodResult[]
  validTotal: number
}) {
  const upColor = upsidePct != null
    ? (upsidePct >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]')
    : 'text-[#9B9B9B]'
  const validMethods = methods.filter(m => m.fairValue != null && m.fairValue > 0)

  return (
    <div className="rounded-xl border border-[#E3E1DA] bg-white px-5 py-4 shadow-sm">
      <div className="flex flex-col sm:flex-row sm:items-start gap-4">

        {/* Left: blended FV */}
        <div className="shrink-0">
          <p className="text-[10px] font-[700] uppercase tracking-widest text-[#9B9B9B] mb-1">
            Blended Fair Value <span className="normal-case font-[500] tracking-normal text-[#9B9B9B]">(Synthesis)</span>
          </p>
          <p
            className="text-[2rem] font-[800] leading-none tabular-nums text-[#111111]"
            aria-label={blendedFairValue != null ? `Blended fair value: ${fmtPrice(blendedFairValue, currency)} per share` : 'Blended fair value unavailable'}
          >
            {blendedFairValue != null ? fmtPrice(blendedFairValue, currency) : '—'}
          </p>
          <p className="text-[11px] text-[#9B9B9B] mt-0.5">Per share</p>
        </div>

        {/* Divider */}
        <div className="hidden sm:block w-px bg-[#E5E5E5] self-stretch mx-2" />

        {/* Center: description + stats */}
        <div className="flex-1 min-w-0">
          <p className="text-[12px] text-[#6B6B6B] leading-snug mb-3">
            {blendedFairValue == null || validMethods.length === 0
              ? 'Insufficient data to compute fair value.'
              : `Weighted average of ${validMethods.length} independent model${validMethods.length !== 1 ? 's' : ''}. Weights reflect model reliability, data quality, and market context.`
            }
          </p>
          <div className="flex items-center gap-4 flex-wrap">
            <div>
              <p className="text-[10px] text-[#9B9B9B] mb-0.5">Implied Return</p>
              <p className={`text-[16px] font-[750] tabular-nums ${upColor}`}>
                {upsidePct != null ? `${upsidePct >= 0 ? '+' : ''}${(upsidePct * 100).toFixed(1)}%` : '—'}
              </p>
              <p className="text-[10px] text-[#9B9B9B]">vs current price</p>
            </div>
            <div className="w-px h-10 bg-[#E5E5E5] hidden sm:block" />
            <div>
              <p className="text-[10px] text-[#9B9B9B] mb-0.5">WACC</p>
              <p className="text-[16px] font-[750] tabular-nums text-[#111111]">
                {(wacc * 100).toFixed(1)}%
              </p>
              <p className="text-[10px] text-[#9B9B9B]">Discount rate</p>
            </div>
          </div>
        </div>

        {/* Right: weight legend pills */}
        {validMethods.length > 0 && (
          <div className="flex flex-row flex-wrap gap-1 sm:flex-col sm:flex-nowrap sm:min-w-[140px] mt-1 sm:mt-0">
            {validMethods.map(m => {
              const cfg = METHOD_CFG[m.id]
              const pct = validTotal > 0 ? Math.round((m.weight / validTotal) * 100) : 0
              return (
                <div key={m.id} className="flex items-center gap-1.5 min-w-0">
                  <span
                    className="w-2 h-2 rounded-full shrink-0"
                    style={{ backgroundColor: cfg?.chartHex ?? '#9B9B9B' }}
                  />
                  <span className="text-[10px] sm:text-[11px] text-[#6B6B6B] truncate max-w-[80px] sm:max-w-none flex-1">{m.method}</span>
                  <span className="text-[10px] sm:text-[11px] font-[650] tabular-nums text-[#111111]">{pct}%</span>
                </div>
              )
            })}
          </div>
        )}

      </div>
    </div>
  )
}

// ─── RatioHistoryRow ─────────────────────────────────────────────────────────
// Compact "FY22 28× · FY23 24× · TTM 21× · NTM 19×" strip shown inside method
// cards for P/E, EV/EBITDA, EV/Revenue, and P/Book to give instant trend context.

interface _RatioPoint { label: string; value: number }

function RatioHistoryRow({
  series, ntm, unit = 'x', color: _color,
}: {
  series?: SparkPoint[]       // from historicalData — includes 'curr' as last point
  ntm?: number | null         // next twelve months estimate (analyst)
  unit?: 'x' | '%'
  color: string
}) {
  if (!series || series.length < 2) return null

  // Extract up to 2 historical FY points (exclude 'curr') + TTM ('curr')
  const historical = series.filter(p => p.label !== 'curr').slice(-2)
  const ttm = series.find(p => p.label === 'curr')

  const points: Array<_RatioPoint & { isNTM?: boolean; isTTM?: boolean }> = [
    ...historical.map(p => ({ label: p.label, value: p.value })),
    ...(ttm ? [{ label: 'TTM', value: ttm.value, isTTM: true }] : []),
    ...(ntm != null ? [{ label: 'NTM', value: ntm, isNTM: true }] : []),
  ]

  if (points.length < 2) return null

  const fmtRatio = (v: number) =>
    unit === '%' ? `${(v * 100).toFixed(1)}%` : `${v.toFixed(1)}×`

  // Trend arrow: compare last two points
  const last = points[points.length - 1].value
  const prev = points[points.length - 2].value
  const trend = last < prev - 0.3 ? 'down' : last > prev + 0.3 ? 'up' : 'flat'

  return (
    <div className="flex items-center gap-1.5 flex-wrap pt-1.5 border-t border-[#F5F5F5]">
      <span className="text-[10px] font-[600] text-[#9B9B9B] shrink-0">Ratio trend</span>
      <div className="flex items-center gap-1 flex-wrap">
        {points.map((p, _i) => (
          <span
            key={p.label}
            className={`inline-flex items-center gap-0.5 text-[10px] tabular-nums font-[600] px-1.5 py-0.5 rounded-md ${
              p.isNTM
                ? 'bg-[#EAF1FF] text-[#2563EB]'
                : p.isTTM
                ? 'bg-[#FAFAFA] text-[#06101F]'
                : 'text-[#9B9B9B]'
            }`}
          >
            <span className="text-[9px] font-[500] mr-0.5 opacity-60">{p.label}</span>
            {fmtRatio(p.value)}
            {p.isNTM && (
              <span className="text-[9px] ml-0.5 opacity-70">est</span>
            )}
          </span>
        ))}
        {trend !== 'flat' && (
          <span
            className={`text-[11px] font-[700] ${trend === 'down' ? 'text-[#11875D]' : 'text-[#D83B3B]'}`}
            title={trend === 'down' ? 'Multiple compressing (cheaper)' : 'Multiple expanding (more expensive)'}
          >
            {trend === 'down' ? '↓' : '↑'}
          </span>
        )}
      </div>
    </div>
  )
}

// ─── ArrowConnectors ─────────────────────────────────────────────────────────
// SVG bus-and-arrowhead connectors from synthesis box to method cards.
// Only rendered on xl+ where the grid is guaranteed to be 4-col.

function ArrowConnectors({ count, breakpoint }: { count: number; breakpoint: string }) {
  if (count === 0) return null
  const COLOR = '#BFD2A1'

  return (
    <div className={`relative ${breakpoint}`} style={{ height: 40 }} aria-hidden="true">
      <svg viewBox="0 0 1000 40" preserveAspectRatio="none" className="absolute inset-0 w-full h-full">
        {/* Vertical drop from center of synthesis box */}
        <line x1="500" y1="0" x2="500" y2="16" stroke={COLOR} strokeWidth="2" />
        {/* Horizontal bus across all card centers */}
        {count > 1 && (
          <line
            x1={((0 + 0.5) / count) * 1000}
            y1="16"
            x2={((count - 1 + 0.5) / count) * 1000}
            y2="16"
            stroke={COLOR}
            strokeWidth="2"
          />
        )}
        {/* Per-card vertical drops + arrowheads */}
        {Array.from({ length: count }, (_, i) => {
          const x = ((i + 0.5) / count) * 1000
          return (
            <g key={i}>
              <line x1={x} y1="16" x2={x} y2="30" stroke={COLOR} strokeWidth="2" />
              <polygon points={`${x},40 ${x - 6},28 ${x + 6},28`} fill={COLOR} />
            </g>
          )
        })}
      </svg>
    </div>
  )
}

// ─── KeyAssumptionsSection ────────────────────────────────────────────────────
// The 4-chart "Historical Trends" section rendered BELOW the method cards grid.

function KeyAssumptionsSection({
  historicalData,
  fcfMarginSeries,
  assumptions,
}: {
  historicalData?: Partial<Record<keyof ValuationAssumptions, SparkPoint[]>>
  fcfMarginSeries?: SparkPoint[]
  assumptions: ValuationAssumptions
}) {
  const peSeries    = historicalData?.exitPE ?? []
  const cagrSeries  = historicalData?.cagr ?? []
  const evRevSeries = historicalData?.revenueMultiple ?? []
  const fcfSeries   = fcfMarginSeries ?? []

  const hasAny = peSeries.length > 0 || cagrSeries.length > 0 || evRevSeries.length > 0 || fcfSeries.length > 0
  if (!hasAny) return null

  return (
    <div className="mt-5 rounded-xl border border-[#E3E1DA] bg-[#FAFAF8] px-5 py-4">
      {/* Section header */}
      <div className="mb-4">
        <p className="text-[10px] font-[700] tracking-widest uppercase text-[#9B9B9B]">Historical Trends / Key Assumptions</p>
        <p className="text-[11px] text-[#9B9B9B] mt-0.5">
          Dashed line shows your current assumption.
        </p>
      </div>

      {/* 4-chart grid: 2-col mobile, 4-col desktop */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <TinyLineChart
          data={peSeries}
          title="Historical P/E ratio"
          color="#2563EB"
          refValue={assumptions.exitPE}
          yFormat={v => `${v.toFixed(0)}x`}
        />
        <TinyLineChart
          data={cagrSeries}
          title="Revenue growth % / yr"
          color="#5F790B"
          refValue={assumptions.cagr}
          yFormat={v => `${(v * 100).toFixed(0)}%`}
        />
        <TinyLineChart
          data={evRevSeries}
          title="EV / Revenue multiple"
          color="#a855f7"
          refValue={assumptions.revenueMultiple}
          yFormat={v => `${v.toFixed(1)}x`}
        />
        <TinyLineChart
          data={fcfSeries}
          title="FCF margin (TTM)"
          color="#11875D"
          yFormat={v => `${(v * 100).toFixed(1)}%`}
        />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ValuationMethodCards({
  methods, currentPrice: _currentPrice, currency,
  fcfMargin, ttmEbitdaDollars,
  assumptions, historicalData,
  onChange, onReset, onUndo, canUndo,
  sensitivity, sectorBenchmarks,
  onScrollToFullDCF,
  fcfMarginSeries,
  blendedFairValue,
  upsidePct,
  analystForwardPE,
  ntmEVRevenue,
  companyType,
}: Props) {
  const validTotal = methods
    .filter(m => m.fairValue != null && m.fairValue > 0)
    .reduce((s, m) => s + m.weight, 0)

  // Only show cards that have a computable fair value
  const visibleMethods = methods.filter(m => m.fairValue != null && m.fairValue > 0)
  const visibleCount = visibleMethods.length

  function change(key: keyof ValuationAssumptions, val: number) {
    onChange({ ...assumptions, [key]: val })
  }

  const showCAGRPanel = visibleMethods.some(m =>
    (m.id === 'forward_pe' || m.id === 'revenue_multiple')
  )

  // Dynamic grid cols: mobile always uses horizontal snap scroll (flex overflow-x-auto)
  // Desktop breakpoints kick in at sm(640px) and above
  const gridCols = visibleCount >= 5
    ? 'sm:grid-cols-2 md:grid-cols-3 xl:grid-cols-5'
    : visibleCount === 4
    ? 'sm:grid-cols-2 lg:grid-cols-4'
    : visibleCount === 3
    ? 'sm:grid-cols-2 md:grid-cols-3'
    : 'sm:grid-cols-2'

  // ArrowConnectors only render when grid columns match card count exactly
  // 5 cards → xl (1280px+), 4 cards → lg (1024px+), 3 → md (768px+)
  const arrowBreakpoint = visibleCount >= 5
    ? 'hidden xl:block'
    : visibleCount === 4
    ? 'hidden lg:block'
    : 'hidden md:block'

  return (
    <div
      className="bg-white rounded-xl border border-[#E3E1DA] shadow-card px-5 py-5"
      role="region"
      aria-label="Valuation models"
    >

      {/* ── Synthesis header box ─────────────────────────────────────────────── */}
      <div className="flex items-start gap-2">
        <div className="flex-1 min-w-0">
          <SynthesisBox
            blendedFairValue={blendedFairValue ?? null}
            upsidePct={upsidePct ?? null}
            currency={currency}
            wacc={assumptions.wacc}
            methods={methods}
            validTotal={validTotal}
          />
        </div>
        <div className="flex flex-col gap-1.5 shrink-0 pt-0.5">
          {canUndo && (
            <button
              onClick={onUndo}
              className="flex items-center gap-1 text-[11px] text-[#6B6B6B] hover:text-[#111111] px-2.5 py-2 min-h-[44px] lg:min-h-[36px] rounded-lg border border-[#E3E1DA] hover:bg-[#F5F5F5] transition-colors"
              aria-label="Undo last change"
            >
              <Undo2 size={11} />
              Undo
            </button>
          )}
          {canUndo && (
            <button
              onClick={onReset}
              className="flex items-center gap-1 text-[11px] text-[#6B6B6B] hover:text-[#111111] px-2.5 py-2 min-h-[44px] lg:min-h-[36px] rounded-lg border border-[#E3E1DA] hover:bg-[#F5F5F5] transition-colors"
              aria-label="Reset to defaults"
            >
              <RotateCcw size={11} />
              Reset
            </button>
          )}
        </div>
      </div>

      {/* ── Shared CAGR stepper (no charts — charts are in Key Assumptions below) */}
      {showCAGRPanel && (
        <div className="mt-3">
          <SharedCAGRPanel
            value={assumptions.cagr}
            onChange={v => change('cagr', v)}
            cagrSeries={historicalData?.cagr}
          />
        </div>
      )}

      {/* ── Arrow connector row → method cards (desktop xl only) ───────────── */}
      <ArrowConnectors count={visibleCount} breakpoint={arrowBreakpoint} />

      {/* ── Cards grid ─────────────────────────────────────────────────────── */}
      <div className={`flex gap-3 overflow-x-auto scrollbar-hide snap-x snap-mandatory pb-1 -mx-4 px-4 sm:grid sm:overflow-visible sm:snap-none sm:pb-0 sm:mx-0 sm:px-0 ${gridCols}`}>
        {visibleMethods.map((m, idx) => {
          const cfg    = METHOD_CFG[m.id]
          const fields = METHOD_INPUTS[m.id] ?? []
          const hasValue = m.fairValue != null && m.fairValue > 0
          const conf   = hasValue ? CONFIDENCE_CHIP[m.confidence] : null
          const effectivePct = hasValue && validTotal > 0
            ? Math.round((m.weight / validTotal) * 100) : 0
          const upColor = m.upsidePct != null
            ? (m.upsidePct >= 0 ? 'text-[#4ade80]' : 'text-[#fca5a5]')
            : 'text-[rgba(255,255,255,0.40)]'
          const isCoreDCF = m.id === 'core_dcf'
          const isEPV = m.id === 'epv'
          const epvMeta = isEPV ? m.meta : null

          // primaryField kept for assumptions stepper hint lookup
          const _primaryField = fields[0]

          return (
            <div
              key={m.id}
              className="relative rounded-xl flex flex-col w-[62vw] sm:min-w-0 sm:w-auto snap-start flex-shrink-0 sm:flex-shrink overflow-hidden"
              style={hasValue && cfg ? {
                background: cfg.cardBg,
                border: `1px solid ${cfg.cardBorder}`,
                boxShadow: '0 4px 20px rgba(0,0,0,0.28)',
              } : {
                background: 'rgba(255,255,255,0.04)',
                border: '1px solid rgba(255,255,255,0.08)',
              }}
              role="article"
              aria-label={`${m.method} valuation model`}
            >
              {/* Colored top accent bar */}
              {cfg && (
                <div
                  className="h-[3px] w-full shrink-0"
                  style={{ backgroundColor: cfg.chartHex, opacity: 0.85 }}
                />
              )}

              {/* Mobile numbered badge */}
              <span className="sm:hidden absolute top-3 right-3 w-5 h-5 rounded-full bg-[rgba(255,255,255,0.12)] text-white text-[9px] font-[800] flex items-center justify-center z-10 pointer-events-none">
                {idx + 1}
              </span>

              <div className="flex flex-col p-4 gap-3 flex-1">

                {/* Card header: icon + name + confidence */}
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    {cfg && (
                      <div className={`w-7 h-7 rounded-full flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                        <cfg.Icon size={13} className={cfg.iconText} />
                      </div>
                    )}
                    <span className={`text-sm font-bold truncate ${hasValue ? 'text-white' : 'text-[rgba(255,255,255,0.35)]'}`}>
                      {m.method}
                    </span>
                  </div>
                  {conf ? (
                    <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 ${conf.bg} ${conf.text}`}>
                      {conf.label}
                    </span>
                  ) : (
                    <span className="flex items-center gap-0.5 text-[10px] font-semibold px-2 py-0.5 rounded-full border shrink-0 bg-[rgba(255,255,255,0.08)] border-[rgba(255,255,255,0.12)] text-[rgba(255,255,255,0.45)]">
                      Unavailable
                      <InfoTooltip content={m.errors[0] ?? 'Insufficient data to compute this model.'} />
                    </span>
                  )}
                </div>

                {/* Fair value */}
                <div aria-live="polite" aria-atomic="true">
                  <p className="text-[10px] text-[rgba(255,255,255,0.45)] mb-0.5">Fair Value</p>
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-2xl font-bold tabular-nums text-white leading-none">
                      {m.fairValue != null ? fmtPrice(m.fairValue, currency) : '—'}
                    </span>
                    {m.upsidePct != null && (
                      <div className="flex flex-col items-end">
                        <span className={`text-xs font-semibold tabular-nums leading-tight ${upColor}`}>
                          {m.upsidePct >= 0 ? '+' : ''}{(m.upsidePct * 100).toFixed(1)}%
                        </span>
                        <span className="text-[10px] text-[rgba(255,255,255,0.35)] leading-tight">vs current price</span>
                      </div>
                    )}
                    {!hasValue && <span className="text-sm text-[rgba(255,255,255,0.30)]">N/A</span>}
                  </div>
                </div>

                {/* Level 2 — model description + formula */}
                {hasValue && m.description && (
                  <div className="rounded-lg bg-[rgba(0,0,0,0.20)] border border-[rgba(255,255,255,0.08)] px-3 py-2 space-y-1">
                    <p className="text-[11px] text-[rgba(255,255,255,0.55)] leading-relaxed">{m.description}</p>
                    {METHOD_FORMULA[m.id] && (
                      <p className="text-[10px] text-[rgba(255,255,255,0.30)] font-mono leading-tight">{METHOD_FORMULA[m.id]}</p>
                    )}
                  </div>
                )}

                {/* Unavailable: consistent-height placeholder */}
                {!hasValue && (
                  <div className="flex-1 min-h-[80px] flex flex-col items-center justify-center gap-1.5">
                    <svg className="w-5 h-5 text-[rgba(255,255,255,0.20)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <circle cx="12" cy="12" r="9" /><path strokeLinecap="round" d="M12 8v4M12 16h.01" />
                    </svg>
                    <p className="text-[11px] text-[rgba(255,255,255,0.30)] italic text-center leading-snug px-2">
                      {m.errors[0] ?? 'Insufficient data. Excluded from the blend.'}
                    </p>
                  </div>
                )}

                {/* Ratio history context — FY-2, FY-1, TTM, NTM for relevant methods */}
                {hasValue && (m.id === 'forward_pe' || m.id === 'ev_ebitda' || m.id === 'revenue_multiple' || m.id === 'price_to_book') && (
                  <RatioHistoryRow
                    series={
                      m.id === 'forward_pe'       ? historicalData?.exitPE :
                      m.id === 'ev_ebitda'         ? historicalData?.exitMultiple :
                      m.id === 'revenue_multiple'  ? historicalData?.revenueMultiple :
                      m.id === 'price_to_book'     ? historicalData?.priceToBookMultiple :
                      undefined
                    }
                    ntm={
                      m.id === 'forward_pe'      ? analystForwardPE :
                      m.id === 'revenue_multiple' ? ntmEVRevenue :
                      undefined
                    }
                    unit="x"
                    color={cfg?.chartHex ?? '#9B9B9B'}
                  />
                )}

                {/* Inputs — editable method cards (not Core DCF, not EPV) */}
                {hasValue && !isCoreDCF && !isEPV && fields.length > 0 && (
                  <div className="space-y-1 pt-1 border-t border-[rgba(255,255,255,0.10)]">
                    <div className="flex items-center justify-between mb-2">
                      <p className="text-[10px] font-[600] text-[rgba(255,255,255,0.40)]">Assumptions</p>
                      {fields.some(f => ['exitPE', 'exitMultiple', 'revenueMultiple', 'priceToBookMultiple'].includes(String(f.key))) && (
                        <span className="text-[10px] text-[rgba(255,255,255,0.30)]">Damodaran Jan 2025</span>
                      )}
                    </div>
                    {fields.map(f => {
                      const hist = historicalData?.[f.chartKey ?? f.key]
                      const histHint = historicalHint(hist, f.unit)
                      const fValue = assumptions[f.key] as number ?? (f.unit === '%' ? 0 : 1)
                      const sectorBenchmark =
                        f.key === 'exitPE'         ? (sectorBenchmarks?.exitPE ?? null) :
                        f.key === 'exitMultiple'    ? (sectorBenchmarks?.exitMultiple ?? null) :
                        f.key === 'revenueMultiple' ? (sectorBenchmarks?.revenueMultiple ?? null) :
                        null
                      const impact = sensitivity?.[f.key]
                      const impactHint = impact != null && Math.abs(impact) > 0.01
                        ? `±$${Math.abs(impact).toFixed(2)}/1pp`
                        : null
                      const hint = [histHint, impactHint].filter(Boolean).join(' · ') || null
                      return (
                        <FieldStepper
                          key={String(f.key)}
                          label={f.label}
                          value={fValue}
                          unit={f.unit}
                          step={f.step}
                          min={f.min}
                          max={f.max}
                          onChange={v => change(f.key, v)}
                          hint={hint}
                          color={cfg?.chartHex ?? '#7C9A19'}
                          sectorBenchmark={sectorBenchmark}
                        />
                      )
                    })}
                  </div>
                )}

                {/* Core DCF card — link to full model */}
                {isCoreDCF && hasValue && (
                  <div className="pt-1 border-t border-[rgba(255,255,255,0.10)] space-y-2">
                    <p className="text-[10px] text-[rgba(255,255,255,0.45)] leading-relaxed">
                      Uses WACC, CAGR, terminal growth, and net margin. Edit these in the Full DCF Model below.
                    </p>
                    <DcfDriverRow fcfMargin={fcfMargin} ttmEbitdaDollars={ttmEbitdaDollars} />
                    <button
                      onClick={onScrollToFullDCF}
                      className="w-full text-[11px] font-[650] text-[#a3e635] bg-[rgba(95,121,11,0.20)] border border-[rgba(95,121,11,0.35)] rounded-lg py-2 hover:bg-[rgba(95,121,11,0.30)] transition-colors"
                    >
                      Edit assumptions in Full DCF ↓
                    </button>
                  </div>
                )}

                {/* EPV card — read-only data display */}
                {isEPV && hasValue && (
                  <div className="pt-1 border-t border-[rgba(255,255,255,0.10)] space-y-2.5">
                    {/* NOPAT display */}
                    {epvMeta?.effectiveNopatM != null && epvMeta.effectiveNopatM > 0 && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[rgba(255,255,255,0.45)]">
                          {epvMeta.isCyclical ? 'Normalized NOPAT' : 'NOPAT (TTM)'}
                        </span>
                        <span className="text-[11px] font-[650] text-white tabular-nums">
                          {epvMeta.effectiveNopatM >= 1000
                            ? `$${(epvMeta.effectiveNopatM / 1000).toFixed(1)}B`
                            : `$${epvMeta.effectiveNopatM.toFixed(0)}M`
                          }
                        </span>
                      </div>
                    )}
                    {/* Growth premium pill */}
                    {epvMeta?.growthPremiumPct != null && (
                      <div className="flex items-center justify-between">
                        <span className="text-[10px] text-[rgba(255,255,255,0.45)]">Growth premium</span>
                        <span className={`text-[11px] font-[650] tabular-nums px-2 py-0.5 rounded-full border ${
                          epvMeta.growthPremiumPct < 0.15
                            ? 'bg-[rgba(34,197,94,0.15)] border-[rgba(34,197,94,0.30)] text-[#4ade80]'
                            : epvMeta.growthPremiumPct < 0.40
                            ? 'bg-[rgba(245,158,11,0.15)] border-[rgba(245,158,11,0.30)] text-[#fcd34d]'
                            : 'bg-[rgba(239,68,68,0.15)] border-[rgba(239,68,68,0.30)] text-[#fca5a5]'
                        }`}>
                          {(epvMeta.growthPremiumPct * 100).toFixed(0)}% of price
                        </span>
                      </div>
                    )}
                    {/* Cyclical warning */}
                    {epvMeta?.isCyclical && epvMeta.cyclicalWarning && (
                      <div className="flex items-start gap-1.5 rounded-lg bg-[rgba(245,158,11,0.12)] border border-[rgba(245,158,11,0.25)] px-2.5 py-1.5">
                        <span className="text-[#fcd34d] shrink-0 text-[11px] leading-tight mt-px">⚠</span>
                        <span className="text-[10px] text-[#fcd34d] leading-tight">{epvMeta.cyclicalWarning}</span>
                      </div>
                    )}
                    <p className="text-[10px] text-[rgba(255,255,255,0.30)] leading-relaxed">
                      NOPAT ÷ WACC. Zero-growth floor (Greenwald). Inputs: WACC and operating income.
                    </p>
                  </div>
                )}

                {/* Spacer pushes blend weight to bottom in all cards */}
                {hasValue && <div className="flex-1" />}

                {/* Blend weight bar */}
                <div className="pt-3 border-t border-[rgba(255,255,255,0.10)]">
                  <div className="flex items-center justify-between mb-1.5">
                    <span className="flex items-center gap-1 text-[10px] text-[rgba(255,255,255,0.40)]">
                      Effective Blend Weight
                      <InfoTooltip content={getWeightRationale(m.id, companyType ?? 'standard')} />
                    </span>
                    <span className={`text-[11px] font-bold tabular-nums ${
                      hasValue ? (cfg?.valueText ?? 'text-[rgba(255,255,255,0.60)]') : 'text-[rgba(255,255,255,0.30)]'
                    }`}>
                      {effectivePct}%
                    </span>
                  </div>
                  <div className="h-2 rounded-full bg-[rgba(255,255,255,0.08)] overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all ${cfg?.barBg ?? 'bg-[rgba(255,255,255,0.20)]'}`}
                      style={{ width: `${effectivePct}%` }}
                    />
                  </div>
                </div>

                {/* View details button — Core DCF scrolls to full model */}
                {hasValue && isCoreDCF && (
                  <button
                    onClick={onScrollToFullDCF}
                    className="mt-1 text-[11px] font-[650] text-[#a3e635] hover:text-white transition-colors text-left"
                  >
                    View details →
                  </button>
                )}

              </div>
            </div>
          )
        })}
        {/* Trailing spacer — ensures last card has breathing room in mobile carousel */}
        <div className="shrink-0 w-4 sm:hidden" aria-hidden="true" />
      </div>

      {/* ── Key Assumptions — Historical Trends ─────────────────────────────── */}
      <KeyAssumptionsSection
        historicalData={historicalData}
        fcfMarginSeries={fcfMarginSeries}
        assumptions={assumptions}
      />

      {/* ── Footer notes ────────────────────────────────────────────────────── */}
      <div className="mt-4 space-y-1.5">
        {methods.some(m => m.fairValue == null || m.fairValue <= 0) && (
          <p className="text-[11px] text-[#9B9B9B] flex items-center gap-1.5">
            <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
            </svg>
            Unavailable models are excluded from the blend. Weights redistributed proportionally.
          </p>
        )}
        <p className="text-[11px] text-[#9B9B9B] flex items-center gap-1.5">
          <svg className="w-3.5 h-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <circle cx="12" cy="12" r="10" /><path strokeLinecap="round" d="M12 16v-4M12 8h.01" />
          </svg>
          Weights reflect model reliability given current data quality.
        </p>
      </div>
    </div>
  )
}
