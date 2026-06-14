'use client'

import { useState, useEffect, useRef, useCallback, useMemo, useId } from 'react'
import { useRouter } from 'next/navigation'
import { motion, useReducedMotion } from 'motion/react'
import {
  SlidersHorizontal, ArrowUpDown, ArrowUp, ArrowDown,
  Search, RotateCcw, TrendingUp, ChevronDown, ChevronUp,
  TableProperties, ScatterChart as ScatterIcon, X,
} from 'lucide-react'
import type { ScreenerStock } from '@/app/api/screener/route'
import dynamic from 'next/dynamic'
import type { AxisConfig } from '@/components/screener/AxisPicker'
import { DEFAULT_AXIS_CONFIG } from '@/components/screener/AxisPicker'
import { cn } from '@/lib/utils'

const AxisPicker = dynamic(() => import('@/components/screener/AxisPicker'), { ssr: false })
const ScreenerChartView = dynamic(() => import('@/components/screener/ScreenerChartView'), { ssr: false })

// ─── Constants ────────────────────────────────────────────────────────────────

const SECTORS = [
  'All Sectors', 'Technology', 'Healthcare', 'Financial Services',
  'Consumer Cyclical', 'Consumer Defensive', 'Communication Services',
  'Industrials', 'Energy', 'Basic Materials', 'Real Estate', 'Utilities',
]

const CAP_TIERS = [
  { id: 'all',   label: 'All',   sub: '' },
  { id: 'mega',  label: 'Mega',  sub: '>$200B' },
  { id: 'large', label: 'Large', sub: '$10–200B' },
  { id: 'mid',   label: 'Mid',   sub: '$2–10B' },
  { id: 'small', label: 'Small', sub: '$300M–2B' },
]

const EXCHANGES = [
  { id: 'all',    label: 'All' },
  { id: 'NYSE',   label: 'NYSE' },
  { id: 'NASDAQ', label: 'NASDAQ' },
]

// Range buckets reused across filters
const PE_OPTS   = [['any','Any'],['under_10','< 10×'],['under_15','< 15×'],['under_20','< 20×'],['under_25','< 25×'],['under_30','< 30×'],['over_40','> 40×'],['negative','Negative']]
const PB_OPTS   = [['any','Any'],['under_0.5','< 0.5×'],['under_1','< 1×'],['under_1.5','< 1.5×'],['under_2','< 2×'],['under_3','< 3×'],['over_5','> 5×']]
const PS_OPTS   = [['any','Any'],['under_0.5','< 0.5'],['under_1','< 1'],['under_2','< 2'],['under_3','< 3'],['under_5','< 5'],['over_10','> 10']]
const PFCF_OPTS = [['any','Any'],['under_10','< 10×'],['under_15','< 15×'],['under_20','< 20×'],['under_25','< 25×'],['over_30','> 30×'],['negative','Neg. FCF']]
const EV_OPTS   = [['any','Any'],['under_5','< 5×'],['under_8','< 8×'],['under_10','< 10×'],['under_15','< 15×'],['under_20','< 20×'],['over_20','> 20×'],['negative','Negative']]
const ROE_OPTS  = [['any','Any'],['negative','Negative'],['over_5','> 5%'],['over_10','> 10%'],['over_15','> 15%'],['over_20','> 20%'],['over_30','> 30%']]
const ROA_OPTS  = [['any','Any'],['negative','Negative'],['over_2','> 2%'],['over_5','> 5%'],['over_10','> 10%'],['over_15','> 15%']]
const MARGIN_OPTS = [['any','Any'],['negative','Negative'],['over_0','> 0%'],['over_5','> 5%'],['over_10','> 10%'],['over_15','> 15%'],['over_20','> 20%'],['over_30','> 30%']]
const GM_OPTS   = [['any','Any'],['negative','Negative'],['over_20','> 20%'],['over_30','> 30%'],['over_40','> 40%'],['over_50','> 50%'],['over_60','> 60%'],['over_70','> 70%']]
const DE_OPTS   = [['any','Any'],['under_0.25','< 0.25'],['under_0.5','< 0.5'],['under_1','< 1'],['over_1','> 1'],['over_2','> 2']]
const CR_OPTS   = [['any','Any'],['under_1','< 1'],['over_1','> 1'],['over_1.5','> 1.5'],['over_2','> 2'],['over_3','> 3']]
const GROWTH_OPTS = [['any','Any'],['negative','Negative'],['over_0','> 0%'],['over_5','> 5%'],['over_10','> 10%'],['over_15','> 15%'],['over_20','> 20%'],['over_30','> 30%']]
const ANALYST_OPTS = [['any','Any'],['strong_buy','Strong Buy'],['buy','Buy'],['hold','Hold'],['sell','Sell / Underperform']]
const HI52_OPTS = [['any','Any'],['new_high','At 52W High'],['below_10','< 10% Below'],['below_20','< 20% Below'],['below_50','> 20% Below']]
const SMA200_OPTS = [['any','Any'],['above','Above 200-Day MA'],['below','Below 200-Day MA'],['above_10','> 10% Above'],['above_20','> 20% Above'],['below_10','> 10% Below'],['below_20','> 20% Below']]
const BETA_OPTS = [['any','Any'],['under_0.5','< 0.5'],['under_0.75','< 0.75'],['under_1','< 1'],['over_1','> 1'],['over_1.5','> 1.5'],['over_2','> 2']]
const DIV_OPTS  = [['any','Any'],['over_0.5','> 0.5%'],['over_1','> 1%'],['over_2','> 2%'],['over_3','> 3%'],['over_4','> 4%'],['over_5','> 5%']]

// ─── Types ────────────────────────────────────────────────────────────────────

type SortKey = 'name' | 'marketCap' | 'price' | 'beta' | 'dividendYield' | 'sector' | 'trailingPE'
type SortDir = 'asc' | 'desc'

interface Filters {
  // Existing
  sector: string
  capTier: string
  exchange: string
  dividendsOnly: boolean
  // Valuation
  trailingPE: string
  forwardPE: string
  priceToBook: string
  priceToSales: string
  priceFCF: string
  evEbitda: string
  // Profitability
  roe: string
  roa: string
  grossMargin: string
  opMargin: string
  netMargin: string
  // Financial health
  debtToEquity: string
  currentRatio: string
  // Growth
  revGrowth: string
  epsGrowth: string
  // Technical
  beta: string
  fiftyTwoWk: string
  sma200: string
  // Descriptive
  divYield: string
  analyst: string
}

const DEFAULT_FILTERS: Filters = {
  sector: 'All Sectors', capTier: 'all', exchange: 'all', dividendsOnly: false,
  trailingPE: 'any', forwardPE: 'any', priceToBook: 'any', priceToSales: 'any', priceFCF: 'any', evEbitda: 'any',
  roe: 'any', roa: 'any', grossMargin: 'any', opMargin: 'any', netMargin: 'any',
  debtToEquity: 'any', currentRatio: 'any',
  revGrowth: 'any', epsGrowth: 'any',
  beta: 'any', fiftyTwoWk: 'any', sma200: 'any',
  divYield: 'any', analyst: 'any',
}

// ─── Filter group config ──────────────────────────────────────────────────────

const FILTER_GROUPS = [
  {
    id: 'valuation', label: 'Valuation',
    fields: [
      { key: 'trailingPE',  label: 'Trailing P/E',  opts: PE_OPTS   },
      { key: 'forwardPE',   label: 'Forward P/E',   opts: PE_OPTS   },
      { key: 'priceToBook', label: 'Price / Book',  opts: PB_OPTS   },
      { key: 'priceToSales',label: 'Price / Sales', opts: PS_OPTS   },
      { key: 'priceFCF',    label: 'Price / FCF',   opts: PFCF_OPTS },
      { key: 'evEbitda',    label: 'EV / EBITDA',   opts: EV_OPTS   },
    ],
  },
  {
    id: 'profitability', label: 'Profitability',
    fields: [
      { key: 'roe',        label: 'Return on Equity',   opts: ROE_OPTS    },
      { key: 'roa',        label: 'Return on Assets',   opts: ROA_OPTS    },
      { key: 'grossMargin',label: 'Gross Margin',        opts: GM_OPTS     },
      { key: 'opMargin',   label: 'Operating Margin',   opts: MARGIN_OPTS },
      { key: 'netMargin',  label: 'Net Margin',          opts: MARGIN_OPTS },
    ],
  },
  {
    id: 'health', label: 'Financial Health',
    fields: [
      { key: 'debtToEquity', label: 'Debt / Equity',  opts: DE_OPTS },
      { key: 'currentRatio', label: 'Current Ratio',  opts: CR_OPTS },
    ],
  },
  {
    id: 'growth', label: 'Growth',
    fields: [
      { key: 'revGrowth',  label: 'Revenue Growth (YoY)', opts: GROWTH_OPTS },
      { key: 'epsGrowth',  label: 'EPS Growth (YoY)',     opts: GROWTH_OPTS },
    ],
  },
  {
    id: 'technical', label: 'Technical',
    fields: [
      { key: 'beta',      label: 'Beta',               opts: BETA_OPTS   },
      { key: 'fiftyTwoWk',label: '52-Week Position',   opts: HI52_OPTS   },
      { key: 'sma200',    label: 'vs 200-Day MA',       opts: SMA200_OPTS },
    ],
  },
  {
    id: 'other', label: 'Dividends & Analyst',
    fields: [
      { key: 'divYield', label: 'Dividend Yield', opts: DIV_OPTS    },
      { key: 'analyst',  label: 'Analyst Rating', opts: ANALYST_OPTS },
    ],
  },
]

// ─── Formatters ───────────────────────────────────────────────────────────────

function fmtCap(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e12) return `$${(v / 1e12).toFixed(2)}T`
  if (v >= 1e9)  return `$${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6)  return `$${(v / 1e6).toFixed(0)}M`
  return `$${v.toLocaleString()}`
}
function fmtPrice(v: number | null): string { return v == null ? '—' : `$${v.toFixed(2)}` }
function fmtPct(v: number | null, decimals = 1): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(decimals)}%`
}
function fmtMult(v: number | null): string { return v == null ? '—' : `${v.toFixed(1)}×` }

// ─── Components ───────────────────────────────────────────────────────────────

function SkeletonRow({ index }: { index: number }) {
  return (
    <tr className="border-b border-[#E5E5E5] motion-safe:animate-pulse" style={{ animationDelay: `${index * 30}ms` }}>
      <td className="sticky left-0 z-10 bg-white px-4 py-3.5 w-[220px]">
        <div className="flex flex-col gap-1.5">
          <div className="h-3.5 bg-[#E5E5E5] rounded w-14" />
          <div className="h-3 bg-[#F4F3EF] rounded w-28" />
        </div>
      </td>
      {Array.from({ length: 6 }).map((_, i) => (
        <td key={i} className="px-4 py-3.5"><div className="h-3.5 bg-[#F4F3EF] rounded w-16 ml-auto" /></td>
      ))}
    </tr>
  )
}

function SortTh({ label, col, active, dir, onClick, className }: {
  label: string; col: SortKey; active: boolean; dir: SortDir
  onClick: (k: SortKey) => void; className?: string
}) {
  return (
    <th
      className={cn('px-4 py-3 text-right text-[11px] font-semibold text-[#6B6B6B] whitespace-nowrap cursor-pointer select-none hover:text-[#06101F] transition-colors', className)}
      onClick={() => onClick(col)}
      aria-sort={active ? (dir === 'desc' ? 'descending' : 'ascending') : 'none'}
    >
      <span className="inline-flex items-center justify-end gap-1">
        {label}
        {active
          ? dir === 'desc' ? <ArrowDown size={11} className="text-olive-700 shrink-0" />
                           : <ArrowUp   size={11} className="text-olive-700 shrink-0" />
          : <ArrowUpDown size={10} className="text-[#6B6B6B] shrink-0" />}
      </span>
    </th>
  )
}

const SECTOR_COLORS: Record<string, string> = {
  'Technology':             'bg-[#EAF1FF] text-[#2563EB]',
  'Healthcare':             'bg-[#E8F7EF] text-[#11875D]',
  'Financial Services':     'bg-violet-50 text-violet-700',
  'Consumer Cyclical':      'bg-orange-50 text-orange-700',
  'Consumer Defensive':     'bg-[#FFF4DA] text-[#B56A00]',
  'Communication Services': 'bg-cyan-50 text-cyan-700',
  'Industrials':            'bg-[#F4F3EF] text-[#6B6B6B]',
  'Energy':                 'bg-[#FFF4DA] text-[#B56A00]',
  'Basic Materials':        'bg-lime-50 text-lime-700',
  'Real Estate':            'bg-rose-50 text-rose-700',
  'Utilities':              'bg-teal-50 text-teal-700',
}

function SectorBadge({ sector }: { sector: string | null }) {
  if (!sector) return <span className="text-[#6B6B6B] text-[11px]">—</span>
  return (
    <span className={cn('inline-block text-[10px] font-semibold px-2 py-0.5 rounded-full', SECTOR_COLORS[sector] ?? 'bg-[#F4F3EF] text-[#6B6B6B]')}>
      {sector}
    </span>
  )
}

// ── Inline select control ─────────────────────────────────────────────────────
function FilterSelect({
  label, value, opts, onChange, active,
}: {
  label: string; value: string; opts: string[][]; onChange: (v: string) => void; active: boolean
}) {
  const id = useId()
  return (
    <div className="flex flex-col gap-1">
      <label htmlFor={id} className={cn('text-[10px] font-[600] leading-none cursor-pointer', active ? 'text-olive-700' : 'text-[#6B6B6B]')}>
        {label}
      </label>
      <div className="relative">
        <select
          id={id}
          value={value}
          onChange={e => onChange(e.target.value)}
          className={cn(
            'appearance-none pl-2.5 pr-6 py-1.5 text-[12px] rounded-lg border cursor-pointer min-h-[44px] transition-colors focus:outline-none focus:ring-2 focus:ring-[rgba(95,121,11,0.25)]',
            active
              ? 'border-olive-700 bg-olive-50 text-olive-700 font-[600]'
              : 'border-[#E5E5E5] bg-white text-[#6B6B6B] hover:border-[#CDD1C8]',
          )}
        >
          {opts.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
        </select>
        <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#6B6B6B]" />
      </div>
    </div>
  )
}

// ── Active filter chip ────────────────────────────────────────────────────────
function ActiveChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 rounded-full bg-olive-50 border border-[#BFD2A1] text-[11px] font-[600] text-olive-700 whitespace-nowrap">
      {label}: {value}
      <button onClick={onRemove} className="w-4 h-4 flex items-center justify-center hover:bg-olive-100 rounded-full transition-colors" aria-label={`Remove ${label} filter`}>
        <X size={9} />
      </button>
    </span>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ScreenerPage() {
  const router  = useRouter()
  const reduced = useReducedMotion()

  const [stocks, setStocks]     = useState<ScreenerStock[]>([])
  const [loading, setLoading]   = useState(true)
  const [error, setError]       = useState<string | null>(null)
  const [searchQ, setSearchQ]   = useState('')
  const [sortKey, setSortKey]   = useState<SortKey>('marketCap')
  const [sortDir, setSortDir]   = useState<SortDir>('desc')
  const [filters, setFilters]   = useState<Filters>(DEFAULT_FILTERS)
  const [view, setView]         = useState<'table' | 'chart'>('table')
  const [axisConfig, setAxisConfig] = useState<AxisConfig>(DEFAULT_AXIS_CONFIG)
  const [panelOpen, setPanelOpen]   = useState(false)
  const [openGroups, setOpenGroups] = useState<Set<string>>(new Set(['valuation']))

  const abortRef = useRef<AbortController | null>(null)

  const fetchStocks = useCallback(async (f: Filters) => {
    abortRef.current?.abort()
    abortRef.current = new AbortController()
    setLoading(true)
    setError(null)

    const p = new URLSearchParams()
    if (f.sector !== 'All Sectors') p.set('sector', f.sector)
    if (f.capTier !== 'all')        p.set('capTier', f.capTier)
    if (f.exchange !== 'all')       p.set('exchange', f.exchange)
    if (f.dividendsOnly)            p.set('dividends', '1')
    if (f.trailingPE  !== 'any')    p.set('trailingPE',   f.trailingPE)
    if (f.forwardPE   !== 'any')    p.set('forwardPE',    f.forwardPE)
    if (f.priceToBook !== 'any')    p.set('priceToBook',  f.priceToBook)
    if (f.priceToSales!== 'any')    p.set('priceToSales', f.priceToSales)
    if (f.priceFCF    !== 'any')    p.set('priceFCF',     f.priceFCF)
    if (f.evEbitda    !== 'any')    p.set('evEbitda',     f.evEbitda)
    if (f.roe         !== 'any')    p.set('roe',          f.roe)
    if (f.roa         !== 'any')    p.set('roa',          f.roa)
    if (f.grossMargin !== 'any')    p.set('grossMargin',  f.grossMargin)
    if (f.opMargin    !== 'any')    p.set('opMargin',     f.opMargin)
    if (f.netMargin   !== 'any')    p.set('netMargin',    f.netMargin)
    if (f.debtToEquity!== 'any')    p.set('debtToEquity', f.debtToEquity)
    if (f.currentRatio!== 'any')    p.set('currentRatio', f.currentRatio)
    if (f.revGrowth   !== 'any')    p.set('revGrowth',    f.revGrowth)
    if (f.epsGrowth   !== 'any')    p.set('epsGrowth',    f.epsGrowth)
    if (f.beta        !== 'any')    p.set('beta',         f.beta)
    if (f.fiftyTwoWk  !== 'any')    p.set('fiftyTwoWk',   f.fiftyTwoWk)
    if (f.sma200      !== 'any')    p.set('sma200',       f.sma200)
    if (f.divYield    !== 'any')    p.set('divYield',     f.divYield)
    if (f.analyst     !== 'any')    p.set('analyst',      f.analyst)

    try {
      const res = await fetch(`/api/screener?${p}`, { signal: abortRef.current.signal })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? `API error ${res.status}`)
      }
      setStocks(await res.json())
    } catch (err: unknown) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError(err instanceof Error ? err.message : 'Failed to load screener data.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => () => { abortRef.current?.abort() }, [])
  useEffect(() => { fetchStocks(filters) }, []) // eslint-disable-line react-hooks/exhaustive-deps

  const isFirstRender = useRef(true)
  const filterKey = JSON.stringify(filters)
  const timerRef  = useRef<ReturnType<typeof setTimeout>>()
  useEffect(() => {
    if (isFirstRender.current) { isFirstRender.current = false; return }
    clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => fetchStocks(filters), 400)
    return () => clearTimeout(timerRef.current)
  }, [filterKey, fetchStocks]) // eslint-disable-line react-hooks/exhaustive-deps

  // ── Client-side sort ──────────────────────────────────────────────────────
  const displayed = useMemo(() => {
    let result = stocks
    if (searchQ.trim()) {
      const q = searchQ.toLowerCase()
      result = result.filter(s => s.ticker.toLowerCase().startsWith(q) || s.name.toLowerCase().includes(q))
    }
    return [...result].sort((a, b) => {
      let va: number | string | null
      let vb: number | string | null
      if      (sortKey === 'name')         { va = a.name;          vb = b.name }
      else if (sortKey === 'sector')       { va = a.sector ?? '';  vb = b.sector ?? '' }
      else if (sortKey === 'marketCap')    { va = a.marketCap;     vb = b.marketCap }
      else if (sortKey === 'price')        { va = a.price;         vb = b.price }
      else if (sortKey === 'beta')         { va = a.beta;          vb = b.beta }
      else if (sortKey === 'trailingPE')   { va = a.trailingPE;    vb = b.trailingPE }
      else                                 { va = a.dividendYield; vb = b.dividendYield }
      if (typeof va === 'string' && typeof vb === 'string')
        return sortDir === 'asc' ? va.localeCompare(vb) : vb.localeCompare(va)
      const na = va as number | null, nb = vb as number | null
      if (na == null && nb == null) return 0
      if (na == null) return 1; if (nb == null) return -1
      return sortDir === 'asc' ? na - nb : nb - na
    })
  }, [stocks, searchQ, sortKey, sortDir])

  function toggleSort(key: SortKey) {
    if (key === sortKey) setSortDir(d => d === 'desc' ? 'asc' : 'desc')
    else { setSortKey(key); setSortDir('desc') }
  }

  function setFilter<K extends keyof Filters>(key: K, val: Filters[K]) {
    setFilters(f => ({ ...f, [key]: val }))
  }

  function resetFilters() {
    setFilters(DEFAULT_FILTERS)
    setSearchQ('')
  }

  // ── Active filter count + chips ───────────────────────────────────────────
  const activeAdvanced = FILTER_GROUPS.flatMap(g =>
    g.fields.filter(f => ((filters as unknown) as Record<string, string>)[f.key] !== 'any')
      .map(f => ({
        key: f.key,
        label: f.label,
        value: f.opts.find(([v]) => v === ((filters as unknown) as Record<string, string>)[f.key])?.[1] ?? '',
      }))
  )
  const hasBasicFilters = filters.sector !== 'All Sectors' || filters.capTier !== 'all' ||
    filters.exchange !== 'all' || filters.dividendsOnly
  const totalActive = activeAdvanced.length + (hasBasicFilters ? 1 : 0)

  function toggleGroup(id: string) {
    setOpenGroups(prev => {
      const next = new Set(prev)
      if (next.has(id)) { next.delete(id) } else { next.add(id) }
      return next
    })
  }

  return (
    <div className="min-h-dvh bg-[#F5F5F5]">

      {/* ── Sticky filter bar ──────────────────────────────────────────────── */}
      <div className="bg-white border-b border-[#E5E5E5] sticky top-[52px] z-30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
          <div className="flex items-center gap-2 flex-wrap">

            {/* Search */}
            <div className="relative flex-1 min-w-[160px] max-w-[260px]">
              <Search size={13} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#6B6B6B] pointer-events-none" />
              <input
                type="text"
                value={searchQ}
                onChange={e => setSearchQ(e.target.value)}
                placeholder="Ticker or name…"
                aria-label="Search by ticker or company name"
                autoCapitalize="characters"
                autoCorrect="off"
                className="w-full pl-8 pr-3 py-2 text-[16px] sm:text-[13px] border border-[#E5E5E5] rounded-lg bg-white text-[#06101F] placeholder-[#6B6B6B] focus:outline-none focus:ring-2 focus:ring-[rgba(95,121,11,0.25)] focus:border-transparent transition-shadow"
              />
            </div>

            {/* Exchange pills */}
            <div role="group" aria-label="Exchange" className="flex rounded-lg overflow-hidden border border-[#E5E5E5] shrink-0">
              {EXCHANGES.map(ex => (
                <button key={ex.id} onClick={() => setFilter('exchange', ex.id)}
                  className={cn('px-3 py-2 text-[12px] font-[500] border-r border-[#E5E5E5] last:border-r-0 transition-colors min-h-[44px]',
                    filters.exchange === ex.id ? 'bg-olive-50 text-olive-700 font-[600]' : 'text-[#6B6B6B] hover:bg-[#F4F3EF]'
                  )}>
                  {ex.label}
                </button>
              ))}
            </div>

            {/* Cap tier pills */}
            <div role="group" aria-label="Market cap tier" className="flex rounded-lg overflow-hidden border border-[#E5E5E5] shrink-0">
              {CAP_TIERS.map(t => (
                <button key={t.id} onClick={() => setFilter('capTier', t.id)} title={t.sub || undefined}
                  className={cn('px-3 py-2 text-[12px] font-[500] border-r border-[#E5E5E5] last:border-r-0 transition-colors min-h-[44px] whitespace-nowrap',
                    filters.capTier === t.id ? 'bg-olive-50 text-olive-700 font-[600]' : 'text-[#6B6B6B] hover:bg-[#F4F3EF]'
                  )}>
                  {t.label}
                  {t.sub && <span className="hidden md:inline text-[9px] opacity-60 ml-0.5">{t.sub}</span>}
                </button>
              ))}
            </div>

            {/* Sector select */}
            <div className="relative shrink-0">
              <select value={filters.sector} onChange={e => setFilter('sector', e.target.value)}
                aria-label="Filter by sector"
                className={cn(
                  'appearance-none pl-2.5 pr-7 py-2 text-[12px] border rounded-lg bg-white cursor-pointer min-h-[44px] focus:outline-none focus:ring-2 focus:ring-[rgba(95,121,11,0.25)] transition-colors',
                  filters.sector !== 'All Sectors' ? 'border-olive-700 bg-olive-50 text-olive-700 font-[600]' : 'border-[#E5E5E5] text-[#6B6B6B]'
                )}>
                {SECTORS.map(s => <option key={s}>{s}</option>)}
              </select>
              <ChevronDown size={10} className="absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none text-[#6B6B6B]" />
            </div>

            {/* Dividends toggle */}
            <button
              onClick={() => setFilter('dividendsOnly', !filters.dividendsOnly)}
              aria-pressed={filters.dividendsOnly}
              aria-label="Show only dividend-paying stocks"
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-[500] transition-colors min-h-[44px] shrink-0',
                filters.dividendsOnly ? 'bg-[#E8F7EF] border-[#A3D9BE] text-[#11875D] font-[600]' : 'bg-white border-[#E5E5E5] text-[#6B6B6B] hover:border-[#CDD1C8]'
              )}>
              Dividends
            </button>

            {/* More filters toggle */}
            <button
              onClick={() => setPanelOpen(v => !v)}
              aria-expanded={panelOpen}
              aria-controls="advanced-filter-panel"
              className={cn('flex items-center gap-1.5 px-3 py-2 rounded-lg border text-[12px] font-[500] transition-colors min-h-[44px] shrink-0',
                panelOpen || activeAdvanced.length > 0
                  ? 'bg-olive-50 border-olive-700 text-olive-700 font-[600]'
                  : 'bg-white border-[#E5E5E5] text-[#6B6B6B] hover:border-[#CDD1C8]'
              )}>
              <SlidersHorizontal size={12} />
              More filters
              {activeAdvanced.length > 0 && (
                <span className="ml-0.5 bg-olive-700 text-white text-[10px] font-[700] rounded-full w-4 h-4 flex items-center justify-center leading-none">
                  {activeAdvanced.length}
                </span>
              )}
            </button>

            {/* Reset */}
            {(totalActive > 0 || searchQ) && (
              <button onClick={resetFilters}
                aria-label="Reset all screener filters"
                className="flex items-center gap-1 text-[11px] text-[#6B6B6B] hover:text-[#D83B3B] transition-colors shrink-0 min-h-[44px] px-2">
                <RotateCcw size={11} />
                Reset
              </button>
            )}

            {/* Result count */}
            {!loading && !error && (
              <span className="ml-auto text-[11px] text-[#6B6B6B] shrink-0 tabular-nums">
                <TrendingUp size={11} className="inline mr-1 mb-px" />
                {displayed.length.toLocaleString()} stocks
              </span>
            )}

            {/* View toggle */}
            {!loading && !error && (
              <div className="flex items-center bg-[#F5F5F5] rounded-lg p-0.5 border border-[#E5E5E5] shrink-0">
                <button onClick={() => setView('table')} aria-label="Table view" aria-pressed={view === 'table'}
                  className={cn('flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                    view === 'table' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#6B6B6B] hover:text-[#111111]')}>
                  <TableProperties size={13} />
                </button>
                <button onClick={() => setView('chart')} aria-label="Chart view" aria-pressed={view === 'chart'}
                  className={cn('flex items-center justify-center w-8 h-8 rounded-md transition-colors',
                    view === 'chart' ? 'bg-white text-[#111111] shadow-sm' : 'text-[#6B6B6B] hover:text-[#111111]')}>
                  <ScatterIcon size={13} />
                </button>
              </div>
            )}
          </div>

          {/* ── Advanced filter panel ─────────────────────────────────────── */}
          {panelOpen && (
            <div id="advanced-filter-panel" className="mt-3 pt-3 border-t border-[#E5E5E5]">
              <div className="space-y-2">
                {FILTER_GROUPS.map(group => {
                  const groupActive = group.fields.some(f => ((filters as unknown) as Record<string, string>)[f.key] !== 'any')
                  const isOpen = openGroups.has(group.id)
                  return (
                    <div key={group.id} className="rounded-lg border border-[#E5E5E5] bg-[#FAFAF8] overflow-hidden">
                      <button
                        onClick={() => toggleGroup(group.id)}
                        aria-expanded={isOpen}
                        aria-controls={`filter-group-${group.id}`}
                        className="w-full flex items-center justify-between px-3 py-2 text-left min-h-[44px]"
                      >
                        <span className={cn('text-[12px] font-[600]', groupActive ? 'text-olive-700' : 'text-[#6B6B6B]')}>
                          {group.label}
                          {groupActive && <span className="ml-1.5 text-[10px] text-olive-700 opacity-70">
                            ({group.fields.filter(f => ((filters as unknown) as Record<string, string>)[f.key] !== 'any').length} active)
                          </span>}
                        </span>
                        {isOpen ? <ChevronUp size={13} className="text-[#6B6B6B]" /> : <ChevronDown size={13} className="text-[#6B6B6B]" />}
                      </button>
                      {isOpen && (
                        <div id={`filter-group-${group.id}`} className="px-3 pb-3 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2.5">
                          {group.fields.map(field => (
                            <FilterSelect
                              key={field.key}
                              label={field.label}
                              value={((filters as unknown) as Record<string, string>)[field.key]}
                              opts={field.opts}
                              onChange={v => setFilter(field.key as keyof Filters, v as Filters[keyof Filters])}
                              active={((filters as unknown) as Record<string, string>)[field.key] !== 'any'}
                            />
                          ))}
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Active filter chips ───────────────────────────────────────── */}
          {activeAdvanced.length > 0 && !panelOpen && (
            <div className="flex flex-wrap gap-1.5 mt-2">
              {activeAdvanced.map(chip => (
                <ActiveChip
                  key={chip.key}
                  label={chip.label}
                  value={chip.value}
                  onRemove={() => setFilter(chip.key as keyof Filters, 'any' as Filters[keyof Filters])}
                />
              ))}
            </div>
          )}
        </div>
      </div>

      {/* ── Content ────────────────────────────────────────────────────────── */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-5">

        {/* Axis picker — chart view */}
        {view === 'chart' && !loading && !error && (
          <div className="mb-4">
            <AxisPicker config={axisConfig} onChange={setAxisConfig} totalCount={displayed.length} />
          </div>
        )}
        {view === 'chart' && !loading && !error && (
          <ScreenerChartView stocks={displayed} config={axisConfig} />
        )}

        {/* Table view */}
        {(view === 'table' || loading || error) && (
          <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm">

            {error && (
              <div role="alert" aria-live="assertive" aria-atomic="true" className="px-5 py-12 text-center">
                <p className="text-[14px] font-medium text-[#06101F] mb-1">Screener unavailable</p>
                <p className="text-[13px] text-[#6B6B6B] mb-4">{error}</p>
                <button onClick={() => fetchStocks(filters)}
                  className="px-4 py-2 text-[13px] font-semibold rounded-lg bg-olive-700 text-white hover:bg-olive-600 transition-colors">
                  Try again
                </button>
              </div>
            )}

            {!error && (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[720px]">
                  <thead>
                    <tr className="border-b border-[#E5E5E5] bg-[#F4F3EF]/60">
                      <th
                        className="sticky left-0 z-10 bg-[#F4F3EF] px-4 py-3 text-left text-[11px] font-semibold text-[#6B6B6B] w-[220px] min-w-[200px] cursor-pointer select-none hover:text-[#06101F] transition-colors"
                        onClick={() => toggleSort('name')}
                        aria-sort={sortKey === 'name' ? (sortDir === 'desc' ? 'descending' : 'ascending') : 'none'}
                      >
                        <span className="inline-flex items-center gap-1">
                          Company
                          {sortKey === 'name'
                            ? sortDir === 'desc' ? <ArrowDown size={11} className="text-olive-700" /> : <ArrowUp size={11} className="text-olive-700" />
                            : <ArrowUpDown size={10} className="text-[#6B6B6B]" />}
                        </span>
                      </th>
                      <SortTh label="P/E"        col="trailingPE"   active={sortKey === 'trailingPE'}   dir={sortDir} onClick={toggleSort} className="hidden sm:table-cell" />
                      <SortTh label="Mkt Cap"    col="marketCap"    active={sortKey === 'marketCap'}    dir={sortDir} onClick={toggleSort} />
                      <SortTh label="Price"      col="price"        active={sortKey === 'price'}        dir={sortDir} onClick={toggleSort} className="hidden sm:table-cell" />
                      <SortTh label="Beta"       col="beta"         active={sortKey === 'beta'}         dir={sortDir} onClick={toggleSort} className="hidden md:table-cell" />
                      <SortTh label="Div. Yield" col="dividendYield" active={sortKey === 'dividendYield'} dir={sortDir} onClick={toggleSort} className="hidden md:table-cell" />
                      <SortTh label="Sector"     col="sector"       active={sortKey === 'sector'}       dir={sortDir} onClick={toggleSort} className="hidden lg:table-cell text-left" />
                    </tr>
                  </thead>
                  <tbody>
                    {loading && Array.from({ length: 15 }).map((_, i) => <SkeletonRow key={i} index={i} />)}

                    {!loading && displayed.length === 0 && (
                      <tr>
                        <td colSpan={7} className="px-5 py-14 text-center">
                          <p className="text-[14px] font-medium text-[#06101F] mb-1">No stocks match your filters</p>
                          <p className="text-[13px] text-[#6B6B6B] mb-4">Try broadening or removing some filters.</p>
                          <button onClick={resetFilters} className="text-[13px] font-semibold text-olive-700 hover:underline">
                            Reset all filters
                          </button>
                        </td>
                      </tr>
                    )}

                    {!loading && displayed.map((stock, _i) => (
                      <motion.tr
                        key={stock.ticker}
                        initial={reduced ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        transition={{ duration: 0.15 }}
                        className={cn(
                          'border-b border-[#E5E5E5] hover:bg-olive-50/60 cursor-pointer transition-colors group',
                          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-olive-700',
                        )}
                        onClick={() => router.push(`/stock/${stock.ticker}`)}
                        role="button" tabIndex={0}
                        onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); router.push(`/stock/${stock.ticker}`) } }}
                        aria-label={`${stock.ticker}: ${stock.name} — open analysis`}
                      >
                        <td className="sticky left-0 z-10 bg-white group-hover:bg-olive-50/60 transition-colors px-4 py-3.5">
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex flex-col gap-0.5 min-w-0">
                              <span className="text-[13px] font-bold text-[#06101F] font-mono tracking-tight group-hover:text-olive-700 transition-colors">
                                {stock.ticker}
                              </span>
                              <span className="text-[12px] text-[#6B6B6B] truncate max-w-[150px]">{stock.name}</span>
                            </div>
                            <ArrowUp size={11} className="text-[#6B6B6B]/0 group-hover:text-olive-700/50 transition-colors rotate-45 shrink-0" aria-hidden="true" />
                          </div>
                        </td>
                        <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                          <span className={cn('text-[13px] font-mono tabular-nums',
                            stock.trailingPE == null ? 'text-[#6B6B6B]' :
                            stock.trailingPE > 40 ? 'text-orange-600' :
                            stock.trailingPE < 15 ? 'text-[#11875D]' : 'text-[#06101F]'
                          )}>
                            {stock.trailingPE != null ? fmtMult(stock.trailingPE) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right">
                          <span className="text-[13px] font-mono text-[#06101F] tabular-nums">{fmtCap(stock.marketCap)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right hidden sm:table-cell">
                          <span className="text-[13px] font-mono text-[#06101F] tabular-nums">{fmtPrice(stock.price)}</span>
                        </td>
                        <td className="px-4 py-3.5 text-right hidden md:table-cell">
                          <span className={cn('text-[13px] font-mono tabular-nums',
                            stock.beta == null ? 'text-[#6B6B6B]' :
                            stock.beta > 1.5 ? 'text-orange-600' :
                            stock.beta < 0.7 ? 'text-[#11875D]' : 'text-[#06101F]'
                          )}>
                            {stock.beta != null ? stock.beta.toFixed(2) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 text-right hidden md:table-cell">
                          <span className={cn('text-[13px] font-mono tabular-nums',
                            stock.dividendYield != null && stock.dividendYield > 0 ? 'text-[#11875D] font-semibold' : 'text-[#6B6B6B]'
                          )}>
                            {stock.dividendYield != null && stock.dividendYield > 0 ? fmtPct(stock.dividendYield, 2) : '—'}
                          </span>
                        </td>
                        <td className="px-4 py-3.5 hidden lg:table-cell">
                          <SectorBadge sector={stock.sector} />
                        </td>
                      </motion.tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {!loading && !error && displayed.length > 0 && (
              <div className="px-4 py-2.5 border-t border-[#E5E5E5] flex items-center justify-between">
                <p className="text-[11px] text-[#6B6B6B]">
                  {displayed.length.toLocaleString()} result{displayed.length !== 1 ? 's' : ''} · Click any row to open the full analysis
                </p>
                <p className="text-[11px] text-[#6B6B6B]">Source: Yahoo Finance · Refreshed every 15 min</p>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
