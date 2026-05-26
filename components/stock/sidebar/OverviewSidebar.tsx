'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { fmtLargeCurrency } from '@/lib/formatters'
import { Globe } from 'lucide-react'

interface Quote {
  price: number
  peRatio: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  analystTargetMean: number
  analystTargetLow?: number | null
  analystTargetHigh?: number | null
  marketCap: number
  currency: string
  sector?: string
  pegRatio?: number | null
  nextEarningsDate?: string | null
  sharesOutstanding?: number | null
}

interface WACCInputs {
  beta?: number
}

interface WACC {
  inputs?: WACCInputs
}

interface FairValueData {
  ev?: number
}

interface BusinessProfile {
  description?: string
  industry?: string
  country?: string
  employees?: number | null
}

interface Props {
  quote: Quote
  cagrAnalysis: { numAnalysts: number }
  analystRecommendation: string
  wacc?: WACC | null
  fairValueData?: FairValueData | null
  ownership?: { insiderPct: number | null; institutionalPct: number | null } | null
  businessProfile?: BusinessProfile | null
  ticker?: string
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm', className)}>
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">{children}</p>
}

function MetricRow({ label, value, valueClass, sub }: { label: string; value: string; valueClass?: string; sub?: React.ReactNode }) {
  return (
    <div className="py-1.5 border-b border-slate-50 last:border-0">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] text-slate-500 truncate">{label}</span>
        <span className={cn('text-[12px] font-semibold tabular-nums shrink-0 text-slate-800', valueClass)}>
          {value}
        </span>
      </div>
      {sub}
    </div>
  )
}

// ── SVG Donut Chart ───────────────────────────────────────────────────────────

function DonutChart({ inst, insider, retail }: { inst: number; insider: number; retail: number }) {
  const r = 32
  const cx = 40
  const cy = 40
  const circumference = 2 * Math.PI * r

  const segments = [
    { pct: inst,    color: '#3B82F6' },  // blue-500
    { pct: insider, color: '#F59E0B' },  // amber-500
    { pct: retail,  color: '#CBD5E1' },  // slate-300
  ]

  let offset = 0
  const paths = segments.map((seg, i) => {
    const dashLen = (seg.pct / 100) * circumference
    const dashGap = circumference - dashLen
    const rotation = (offset / 100) * 360 - 90
    offset += seg.pct
    return (
      <circle
        key={i}
        cx={cx}
        cy={cy}
        r={r}
        fill="none"
        stroke={seg.color}
        strokeWidth={10}
        strokeDasharray={`${dashLen} ${dashGap}`}
        strokeDashoffset={0}
        transform={`rotate(${rotation} ${cx} ${cy})`}
      />
    )
  })

  return (
    <svg width={80} height={80} viewBox="0 0 80 80">
      {/* Background ring */}
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#F1F5F9" strokeWidth={10} />
      {paths}
    </svg>
  )
}

// ── Main component ────────────────────────────────────────────────────────────

export default function OverviewSidebar({
  quote,
  cagrAnalysis,
  analystRecommendation,
  wacc,
  fairValueData,
  ownership,
  businessProfile,
  ticker,
}: Props) {
  const { price, peRatio, fiftyTwoWeekHigh, fiftyTwoWeekLow, analystTargetMean, marketCap, currency } = quote
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '
  const [descExpanded, setDescExpanded] = useState(false)

  // ── Analyst Consensus ─────────────────────────────────────────────────────
  const recNorm  = (analystRecommendation ?? '').toLowerCase()
  const isBuy    = recNorm.includes('buy') || recNorm === 'strong_buy' || recNorm === 'strongbuy'
  const isSell   = recNorm.includes('sell') || recNorm.includes('underperform') || recNorm.includes('underweight')
  const recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
  const recColor = isBuy ? 'text-emerald-700' : isSell ? 'text-red-700' : 'text-amber-700'
  const recBg    = isBuy ? 'bg-emerald-50 border-emerald-200' : isSell ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'

  const targetUpside = analystTargetMean > 0 && price > 0 ? (analystTargetMean - price) / price : null
  const upsideColor  = targetUpside == null ? '' : targetUpside >= 0 ? 'text-emerald-600' : 'text-red-600'

  // ── 52W range position ─────────────────────────────────────────────────────
  const rangeSpan = fiftyTwoWeekHigh - fiftyTwoWeekLow
  const rangePct = rangeSpan > 0
    ? Math.max(2, Math.min(98, ((price - fiftyTwoWeekLow) / rangeSpan) * 100))
    : 50

  return (
    <div className="space-y-4">

      {/* ── Card 1: Analyst Consensus ──────────────────────────────────────── */}
      <Card>
        <SectionLabel>Analyst Consensus</SectionLabel>

        <div className="flex items-center justify-between mb-3">
          <span className={cn('text-sm font-bold px-3 py-1 rounded-full border', recBg, recColor)}>
            {recLabel}
          </span>
          {cagrAnalysis?.numAnalysts > 0 && (
            <span className="text-[11px] text-slate-400">{cagrAnalysis.numAnalysts} analysts</span>
          )}
        </div>

        {analystTargetMean > 0 && (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-slate-500">Avg. Target Price</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-slate-900 tabular-nums">
                  {sym}{analystTargetMean.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                {targetUpside != null && (
                  <span className={cn('text-[11px] font-semibold tabular-nums', upsideColor)}>
                    {targetUpside >= 0 ? '+' : ''}{(targetUpside * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
            {quote.analystTargetLow != null && quote.analystTargetHigh != null && (
              <div className="flex items-center justify-between">
                <span className="text-[12px] text-slate-500">Price Target Range</span>
                <span className="text-[12px] font-semibold text-slate-700 tabular-nums">
                  {sym}{quote.analystTargetLow.toFixed(2)} – {sym}{quote.analystTargetHigh.toFixed(2)}
                </span>
              </div>
            )}
          </div>
        )}

        <button className="mt-3 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          View analyst estimates →
        </button>
      </Card>

      {/* ── Card 2: Key Snapshot ──────────────────────────────────────────── */}
      <Card>
        <SectionLabel>Key Snapshot</SectionLabel>

        {/* Current price highlight */}
        <div className="mb-3 pb-2 border-b border-slate-100">
          <p className="text-[20px] font-bold tabular-nums text-slate-900 leading-none">{sym}{price.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
        </div>

        {/* 52W range with dot */}
        {fiftyTwoWeekLow > 0 && fiftyTwoWeekHigh > 0 && (
          <div className="mb-3 pb-2 border-b border-slate-100">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-slate-400">52W Range</span>
            </div>
            <div className="relative h-1.5 rounded-full overflow-hidden bg-slate-100 mb-1">
              <div className="absolute inset-0 bg-gradient-to-r from-slate-300 to-slate-400" />
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-slate-700 border-2 border-white shadow-sm"
                style={{ left: `calc(${rangePct}% - 5px)` }}
              />
            </div>
            <div className="flex justify-between">
              <span className="text-[10px] text-slate-400 tabular-nums">{sym}{fiftyTwoWeekLow.toFixed(2)}</span>
              <span className="text-[10px] text-slate-400 tabular-nums">{sym}{fiftyTwoWeekHigh.toFixed(2)}</span>
            </div>
          </div>
        )}

        <div className="divide-y divide-slate-50">
          {quote.nextEarningsDate && (
            <MetricRow label="Next Earnings" value={new Date(quote.nextEarningsDate + 'T00:00:00').toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })} />
          )}
          {peRatio > 0 && peRatio < 2000 && (
            <MetricRow label="P/E (TTM)" value={`${peRatio.toFixed(1)}×`} />
          )}
          {quote.pegRatio != null && quote.pegRatio > 0 && quote.pegRatio < 100 && (
            <MetricRow label="PEG (5Y)" value={`${quote.pegRatio.toFixed(2)}×`} />
          )}
          <MetricRow
            label="Market Cap"
            value={marketCap > 0 ? fmtLargeCurrency(marketCap, currency) : '—'}
          />
          {fairValueData?.ev != null && fairValueData.ev > 0 && (
            <MetricRow
              label="Enterprise Value"
              value={fmtLargeCurrency(fairValueData.ev, currency)}
            />
          )}
          {wacc?.inputs?.beta != null && (
            <MetricRow label="Beta" value={wacc.inputs.beta.toFixed(2)} />
          )}
          {quote.sharesOutstanding != null && quote.sharesOutstanding > 0 && (() => {
            const s = quote.sharesOutstanding as number
            const fmt = s >= 1e9 ? `${(s / 1e9).toFixed(1)}B` : s >= 1e6 ? `${(s / 1e6).toFixed(1)}M` : `${s.toLocaleString()}`
            return <MetricRow label="Shares Outstanding" value={fmt} />
          })()}
          {quote.sector && (
            <MetricRow label="Sector" value={quote.sector} />
          )}
        </div>

        <button className="mt-3 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
          View full snapshot →
        </button>
      </Card>

      {/* ── Card 3: Ownership Overview ────────────────────────────────────── */}
      {ownership && (ownership.institutionalPct != null || ownership.insiderPct != null) && (() => {
        const inst    = ownership.institutionalPct ?? 0
        const insider = ownership.insiderPct ?? 0
        const retail  = Math.max(0, 100 - inst - insider)
        const legend = [
          { label: 'Institutions', pct: inst,    color: 'bg-blue-500'   },
          { label: 'Insiders',     pct: insider,  color: 'bg-amber-500'  },
          { label: 'Retail',       pct: retail,   color: 'bg-slate-300'  },
        ]
        return (
          <Card>
            <SectionLabel>Ownership Overview</SectionLabel>
            <div className="flex items-center gap-4">
              <DonutChart inst={inst} insider={insider} retail={retail} />
              <div className="space-y-1.5 flex-1 min-w-0">
                {legend.map(r => (
                  <div key={r.label} className="flex items-center gap-2">
                    <span className={cn('w-2 h-2 rounded-full shrink-0', r.color)} />
                    <span className="text-[11px] text-slate-500 flex-1 truncate">{r.label}</span>
                    <span className="text-[11px] font-semibold text-slate-700 tabular-nums">{r.pct.toFixed(1)}%</span>
                  </div>
                ))}
              </div>
            </div>
            <button className="mt-3 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors">
              View ownership details →
            </button>
          </Card>
        )
      })()}

      {/* ── Card 4: Company Description ──────────────────────────────────── */}
      {businessProfile?.description && (
        <Card>
          <SectionLabel>Company Description</SectionLabel>
          <p className="text-[12px] text-slate-600 leading-relaxed">
            {descExpanded
              ? businessProfile.description
              : businessProfile.description.slice(0, 200) + (businessProfile.description.length > 200 ? '...' : '')
            }
          </p>
          {businessProfile.description.length > 200 && (
            <button
              onClick={() => setDescExpanded(v => !v)}
              className="mt-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              {descExpanded ? 'Show less' : 'Read more'}
            </button>
          )}
          {ticker && (
            <a
              href={`https://finance.yahoo.com/quote/${ticker}`}
              target="_blank"
              rel="noopener noreferrer"
              className="mt-3 flex items-center gap-1.5 text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
            >
              <Globe size={12} />
              View company profile →
            </a>
          )}
        </Card>
      )}

    </div>
  )
}
