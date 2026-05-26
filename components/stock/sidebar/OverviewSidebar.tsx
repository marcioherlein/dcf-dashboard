'use client'
import { cn } from '@/lib/utils'
import { fmtLargeCurrency } from '@/lib/formatters'

interface Quote {
  price: number
  peRatio: number
  fiftyTwoWeekHigh: number
  fiftyTwoWeekLow: number
  analystTargetMean: number
  marketCap: number
  currency: string
  sector?: string
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

interface Props {
  quote: Quote
  cagrAnalysis: { numAnalysts: number }
  analystRecommendation: string
  wacc?: WACC | null
  fairValueData?: FairValueData | null
  ownership?: { insiderPct: number | null; institutionalPct: number | null } | null
}

// ── Primitives ────────────────────────────────────────────────────────────────

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="bg-white border border-slate-200 rounded-2xl px-5 py-4 shadow-sm">
      {children}
    </div>
  )
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">{children}</p>
}

function MetricRow({ label, value, valueClass }: { label: string; value: string; valueClass?: string }) {
  return (
    <div className="flex items-center justify-between gap-2 py-1 border-b border-slate-50 last:border-0">
      <span className="text-[12px] text-slate-500 truncate">{label}</span>
      <span className={cn('text-[12px] font-semibold tabular-nums shrink-0 text-slate-800', valueClass)}>
        {value}
      </span>
    </div>
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
}: Props) {
  const { price, peRatio, fiftyTwoWeekHigh, fiftyTwoWeekLow, analystTargetMean, marketCap, currency } = quote
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$ ' : currency + ' '

  // ── Analyst Consensus ─────────────────────────────────────────────────────
  const recNorm  = (analystRecommendation ?? '').toLowerCase()
  const isBuy    = recNorm.includes('buy') || recNorm === 'strong_buy' || recNorm === 'strongbuy'
  const isSell   = recNorm.includes('sell') || recNorm.includes('underperform') || recNorm.includes('underweight')
  const recLabel = isBuy ? 'Buy' : isSell ? 'Sell' : 'Hold'
  const recColor = isBuy ? 'text-emerald-700' : isSell ? 'text-red-700' : 'text-amber-700'
  const recBg    = isBuy ? 'bg-emerald-50 border-emerald-200' : isSell ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'

  const targetUpside = analystTargetMean > 0 && price > 0 ? (analystTargetMean - price) / price : null
  const upsideColor  = targetUpside == null ? '' : targetUpside >= 0 ? 'text-emerald-600' : 'text-red-600'

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
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="text-[12px] text-slate-500">Avg. Target Price</span>
              <div className="flex items-center gap-1.5">
                <span className="text-[13px] font-bold text-slate-900 tabular-nums">
                  {sym}{analystTargetMean.toFixed(2)}
                </span>
                {targetUpside != null && (
                  <span className={cn('text-[11px] font-semibold tabular-nums', upsideColor)}>
                    {targetUpside >= 0 ? '+' : ''}{(targetUpside * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          </div>
        )}
      </Card>

      {/* ── Card 2: Key Snapshot ──────────────────────────────────────────── */}
      <Card>
        <SectionLabel>Key Snapshot</SectionLabel>
        <div className="divide-y divide-slate-50">
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
          {peRatio > 0 && peRatio < 2000 && (
            <MetricRow label="P/E (TTM)" value={`${peRatio.toFixed(1)}×`} />
          )}
          {wacc?.inputs?.beta != null && (
            <MetricRow label="Beta" value={wacc.inputs.beta.toFixed(2)} />
          )}
          {fiftyTwoWeekLow > 0 && fiftyTwoWeekHigh > 0 && (
            <MetricRow
              label="52W Range"
              value={`${sym}${fiftyTwoWeekLow.toFixed(2)} – ${sym}${fiftyTwoWeekHigh.toFixed(2)}`}
            />
          )}
          {quote.sector && (
            <MetricRow label="Sector" value={quote.sector} />
          )}
        </div>
      </Card>

      {/* ── Card 3: Ownership Overview ────────────────────────────────────── */}
      {ownership && (ownership.institutionalPct != null || ownership.insiderPct != null) && (() => {
        const inst    = ownership.institutionalPct ?? 0
        const insider = ownership.insiderPct ?? 0
        const retail  = Math.max(0, 100 - inst - insider)
        const rows = [
          { label: 'Institutional', pct: inst,    color: 'bg-blue-400'   },
          { label: 'Insiders',      pct: insider,  color: 'bg-violet-400' },
          { label: 'Public / Other',pct: retail,   color: 'bg-slate-300'  },
        ]
        return (
          <Card>
            <SectionLabel>Ownership Overview</SectionLabel>
            <div className="space-y-3">
              {rows.map(r => (
                <div key={r.label}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-[12px] text-slate-500">{r.label}</span>
                    <span className="text-[12px] font-semibold text-slate-700 tabular-nums">{r.pct.toFixed(1)}%</span>
                  </div>
                  <div className="h-1.5 bg-slate-100 rounded-full overflow-hidden">
                    <div className={`h-full rounded-full ${r.color}`} style={{ width: `${Math.min(r.pct, 100)}%` }} />
                  </div>
                </div>
              ))}
            </div>
          </Card>
        )
      })()}

    </div>
  )
}
