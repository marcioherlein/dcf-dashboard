'use client'
import { cn } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { fmtLargeCurrency } from '@/lib/formatters'
import { getDefaultEVEBITDAMultiple } from '@/lib/valuation/methods/evEbitda'
import type { DerivedFinancialInsights, TrendPoint } from '@/lib/stock/deriveFinancialInsightMetrics'

// ─── Interfaces ───────────────────────────────────────────────────────────────

interface WACCData {
  wacc: number
  costOfEquity: number
  afterTaxCostOfDebt: number
  inputs: { beta: number; rfRate: number; erp: number }
}

interface MultipleEstimate {
  multiple: string
  impliedFairValue: number
  upsidePct: number
  sectorMedian: number
  actualValue: number
  applicable: boolean
  peerTickers?: string[]
  benchmarkSource?: 'live-peers' | 'industry-median' | 'sector-fallback'
}

interface ValuationMethods {
  triangulatedFairValue: number | null
  triangulatedUpsidePct: number | null
  rationale?: string
  effectiveWeights?: { fcff: number; fcfe: number; ddm: number; multiples: number }
  models?: {
    fcff?: { fairValue: number | null; upsidePct: number | null }
    fcfe?: { applicable: boolean; fairValuePerShare: number }
    ddm?: { applicable: boolean; fairValuePerShare: number }
    multiples?: { estimates: MultipleEstimate[]; blendedFairValue: number | null }
  }
}

interface Scenario {
  fairValue: number | null
  wacc: number
  cagr: number
  terminalG: number
}

interface FairValue {
  fairValuePerShare: number
  upsidePct: number
}

interface CagrAnalysis {
  blended?: number | null
  analystEstimate1y?: number | null
  analystBaseEffect?: boolean
  historicalCagr3y?: number | null
  numAnalysts?: number
}

interface Props {
  wacc: WACCData
  valuationMethods?: ValuationMethods
  fairValue: FairValue
  currentPrice: number
  currency: string
  scenarios?: { bull: Scenario; base: Scenario; bear: Scenario }
  cagr?: number
  terminalG?: number
  activeMethodId?: string | null
  derivedInsights: DerivedFinancialInsights
  cagrAnalysis?: CagrAnalysis
  sector?: string | null
}

// ─── Shared helpers ───────────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{children}</p>
}

function Card({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('rounded-xl glass-card-light px-5 py-4', className)}>
      {children}
    </div>
  )
}

function upsideColor(pct: number): string {
  if (pct >=  0.15) return 'text-emerald-600'
  if (pct >=  0.00) return 'text-emerald-500'
  if (pct >= -0.15) return 'text-amber-600'
  return 'text-red-600'
}

type Verdict = 'good' | 'watch' | 'risk' | 'neutral'

function DecisionLabel({ verdict, text }: { verdict: Verdict; text: string }) {
  const cls =
    verdict === 'good'  ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
    verdict === 'watch' ? 'bg-amber-50 text-amber-700 border-amber-200' :
    verdict === 'risk'  ? 'bg-red-50 text-red-700 border-red-200' :
                          'bg-slate-50 text-slate-600 border-slate-200'
  return (
    <span className={cn('inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-full border', cls)}>
      {text}
    </span>
  )
}

function DefinitionRow({ term, definition }: { term: string; definition: string }) {
  return (
    <div className="flex gap-2">
      <span className="text-[10px] font-semibold text-slate-700 shrink-0 w-24 leading-snug">{term}</span>
      <span className="text-[10px] text-slate-500 leading-snug">{definition}</span>
    </div>
  )
}

// Vertical bar sparkline
const BAR_H = 28

function TrendBars({ points, unit }: { points: TrendPoint[]; unit: 'percent' | 'currency_millions' | 'ratio' }) {
  const valid = points.filter(p => p.value != null).slice(-5)
  if (valid.length < 2) return null

  const vals = valid.map(p => p.value!)
  const maxAbs = Math.max(...vals.map(Math.abs), 1)

  function fmt(v: number) {
    if (unit === 'percent') return (v * 100).toFixed(1) + '%'
    if (unit === 'currency_millions') return fmtLargeCurrency(v * 1e6)
    return v.toFixed(2)
  }

  return (
    <div className="flex items-end gap-1.5 mt-2">
      {valid.map((p, i) => {
        const ratio = Math.abs(p.value!) / maxAbs
        const barPx = Math.max(3, Math.round(ratio * BAR_H))
        const isLast = i === valid.length - 1
        const isPos = p.value! >= 0
        return (
          <div key={p.year} className="flex flex-col items-center gap-1 flex-1 min-w-0">
            <span className={cn(
              'text-[9px] tabular-nums leading-none truncate w-full text-center',
              isLast ? 'font-semibold text-slate-800' : 'text-slate-400',
            )}>
              {fmt(p.value!)}
            </span>
            <div
              className={cn(
                'w-full rounded-sm',
                isPos
                  ? isLast ? 'bg-blue-500 opacity-80' : 'bg-blue-400 opacity-50'
                  : isLast ? 'bg-red-400 opacity-80' : 'bg-red-300 opacity-50',
              )}
              style={{ height: `${barPx}px` }}
            />
            <span className="text-[9px] text-slate-400 leading-none">{p.year.slice(-2)}</span>
          </div>
        )
      })}
    </div>
  )
}

// N-column comparison (label on top, large value below)
interface ColDef { label: string; value: string | null; highlight?: Verdict }

function colValColor(h?: Verdict): string {
  if (h === 'good')  return 'text-emerald-700'
  if (h === 'watch') return 'text-amber-700'
  if (h === 'risk')  return 'text-red-700'
  return 'text-slate-900'
}

function ThreeCol({ a, b, c }: { a: ColDef; b: ColDef; c: ColDef }) {
  return (
    <div className="grid grid-cols-3 divide-x divide-slate-100 -mx-5 px-5">
      {[a, b, c].map(col => (
        <div key={col.label} className="flex flex-col items-center px-1 py-2 gap-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center leading-tight">{col.label}</p>
          <p className={cn('text-base font-bold tabular-nums', colValColor(col.highlight))}>
            {col.value ?? '—'}
          </p>
        </div>
      ))}
    </div>
  )
}

function TwoCol({ a, b }: { a: ColDef; b: ColDef }) {
  return (
    <div className="grid grid-cols-2 divide-x divide-slate-100 -mx-5 px-5">
      {[a, b].map(col => (
        <div key={col.label} className="flex flex-col items-center px-1 py-2 gap-0.5">
          <p className="text-[9px] font-bold uppercase tracking-wider text-slate-400 text-center leading-tight">{col.label}</p>
          <p className={cn('text-base font-bold tabular-nums', colValColor(col.highlight))}>
            {col.value ?? '—'}
          </p>
        </div>
      ))}
    </div>
  )
}

function pctStr(v: number | null | undefined, decimals = 1): string | null {
  if (v == null) return null
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(decimals) + '%'
}

// ─── Default view ─────────────────────────────────────────────────────────────

function DefaultView({
  blended, blendedUpside, currentPrice, currency, valuationMethods, scenarios, weights,
}: {
  blended: number | null
  blendedUpside: number | null
  currentPrice: number
  currency: string
  valuationMethods?: ValuationMethods
  scenarios?: { bull: Scenario; base: Scenario; bear: Scenario }
  weights?: { fcff: number; fcfe: number; ddm: number; multiples: number }
}) {
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency

  const estimates = valuationMethods?.models?.multiples?.estimates ?? []
  const methodFVs: number[] = [
    ...estimates.filter(e => e.applicable && e.impliedFairValue > 0).map(e => e.impliedFairValue),
    ...(valuationMethods?.models?.fcff?.fairValue != null ? [valuationMethods.models.fcff.fairValue] : []),
    ...(blended != null ? [blended] : []),
  ]

  const minFV = methodFVs.length > 1 ? Math.min(...methodFVs) : null
  const maxFV = methodFVs.length > 1 ? Math.max(...methodFVs) : null
  const spread = (minFV != null && maxFV != null && minFV > 0)
    ? (maxFV - minFV) / ((maxFV + minFV) / 2)
    : null
  const spreadLabel: Verdict =
    spread == null ? 'neutral' :
    spread >= 0.40 ? 'risk' :
    spread >= 0.20 ? 'watch' : 'good'
  const spreadText =
    spread == null ? 'Insufficient data' :
    spread >= 0.40 ? 'High model disagreement' :
    spread >= 0.20 ? 'Moderate disagreement' : 'Methods broadly agree'

  const rangeMin = minFV != null ? Math.min(minFV, currentPrice) * 0.96 : null
  const rangeMax = maxFV != null ? Math.max(maxFV, currentPrice) * 1.04 : null
  const pricePct = (rangeMin != null && rangeMax != null && rangeMax > rangeMin)
    ? (currentPrice - rangeMin) / (rangeMax - rangeMin)
    : null

  const weightBars = weights ? [
    { label: 'DCF (FCFF)',   pct: weights.fcff,      color: 'bg-blue-400' },
    { label: 'FCFE',         pct: weights.fcfe,      color: 'bg-indigo-400' },
    { label: 'DDM',          pct: weights.ddm,       color: 'bg-purple-400' },
    { label: 'Multiples',    pct: weights.multiples, color: 'bg-sky-400' },
  ].filter(w => w.pct > 0) : []

  return (
    <>
      {blended != null && (
        <Card>
          <SectionLabel>Blended Fair Value</SectionLabel>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
              {sym}{blended.toFixed(2)}
            </span>
            {blendedUpside != null && (
              <span className={cn('text-sm font-bold tabular-nums mb-0.5', upsideColor(blendedUpside))}>
                {blendedUpside >= 0 ? '+' : ''}{(blendedUpside * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">vs current {sym}{currentPrice.toFixed(2)}</p>
          {valuationMethods?.rationale && (
            <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">{valuationMethods.rationale}</p>
          )}
        </Card>
      )}

      {minFV != null && maxFV != null && (
        <Card>
          <div className="flex items-center justify-between mb-2">
            <SectionLabel>Model Confidence</SectionLabel>
            <DecisionLabel verdict={spreadLabel} text={spreadText} />
          </div>
          <div className="relative h-1.5 rounded-full overflow-hidden bg-gradient-to-r from-red-300/60 via-amber-300/60 to-emerald-300/60 mb-1">
            {pricePct != null && (
              <div
                className="absolute top-1/2 -translate-y-1/2 w-2.5 h-2.5 rounded-full bg-white border-2 border-slate-600 shadow-sm"
                style={{ left: `calc(${Math.max(2, Math.min(98, pricePct * 100))}% - 5px)` }}
              />
            )}
          </div>
          <div className="flex justify-between text-[9px] text-slate-400 tabular-nums">
            <span>{sym}{minFV.toFixed(0)}</span>
            <span className="text-slate-500 font-medium">{sym}{currentPrice.toFixed(0)} now</span>
            <span>{sym}{maxFV.toFixed(0)}</span>
          </div>
          <p className="text-[10px] text-slate-400 mt-1.5">Range across valuation methods</p>
        </Card>
      )}

      {weightBars.length > 0 && (
        <Card>
          <SectionLabel>Model Weights</SectionLabel>
          <div className="flex h-2 rounded-full overflow-hidden mb-2.5">
            {weightBars.map(w => (
              <div key={w.label} className={cn(w.color, 'opacity-70')} style={{ width: `${w.pct}%` }} />
            ))}
          </div>
          <div className="space-y-1">
            {weightBars.map(w => (
              <div key={w.label} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', w.color)} />
                  <span className="text-[11px] text-slate-500">{w.label}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-900 tabular-nums">{w.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {scenarios && (
        <Card>
          <SectionLabel>Scenario Range</SectionLabel>
          <div className="flex gap-1.5">
            {[
              { label: 'Bear', fv: scenarios.bear.fairValue, cls: 'bg-red-50 border-red-200 text-red-700' },
              { label: 'Base', fv: scenarios.base.fairValue, cls: 'bg-blue-50 border-blue-200 text-blue-700' },
              { label: 'Bull', fv: scenarios.bull.fairValue, cls: 'bg-emerald-50 border-emerald-200 text-emerald-700' },
            ].map(({ label, fv, cls }) => (
              <div key={label} className={cn('flex-1 rounded-lg border px-2 py-2 text-center', cls)}>
                <p className="text-[9px] font-bold uppercase tracking-wider opacity-70">{label}</p>
                <p className="text-[11px] font-bold tabular-nums mt-0.5">
                  {fv != null ? `${sym}${fv.toFixed(0)}` : '—'}
                </p>
              </div>
            ))}
          </div>
        </Card>
      )}

      <Card>
        <SectionLabel>Start Here</SectionLabel>
        <div className="space-y-2">
          {[
            'Open Forward P/E to review the growth assumption',
            'Open EV/EBITDA for a quick earnings sanity check',
            'Open Full DCF for a deeper cash-flow dive',
          ].map((tip, i) => (
            <div key={i} className="flex gap-2">
              <span className="text-[10px] text-blue-500 shrink-0 mt-0.5">→</span>
              <p className="text-[10px] text-slate-600 leading-snug">{tip}</p>
            </div>
          ))}
        </div>
      </Card>
    </>
  )
}

// ─── Forward P/E context ──────────────────────────────────────────────────────

function ForwardPEContext({
  cagr, cagrAnalysis, derivedInsights,
}: {
  cagr?: number
  cagrAnalysis?: CagrAnalysis
  derivedInsights: DerivedFinancialInsights
}) {
  const modelCAGR = cagr ?? null
  const historical = cagrAnalysis?.historicalCagr3y ?? null
  const analyst = cagrAnalysis?.analystEstimate1y ?? null
  const baseEffect = cagrAnalysis?.analystBaseEffect ?? false

  const diff = (!baseEffect && modelCAGR != null && analyst != null) ? modelCAGR - analyst : null
  const cagrVerdict: Verdict =
    baseEffect                   ? 'neutral' :
    diff == null                 ? 'neutral' :
    diff > 0.10                  ? 'risk'    :
    diff > 0.03                  ? 'watch'   :
    diff > -0.10                 ? 'good'    : 'neutral'
  const cagrLabel =
    baseEffect                   ? 'Base effect in 1Y est. — comparison unreliable' :
    diff == null                 ? 'No comparison data' :
    diff > 0.10                  ? 'More aggressive than analysts' :
    diff > 0.03                  ? 'Slightly above analysts' :
    diff > -0.10                 ? 'In line with analysts' :
    diff > -0.25                 ? 'Conservative vs analysts' :
                                   'Significantly conservative vs analysts'

  const netMarginPoints = derivedInsights.marginTrend.net.points.filter(p => p.value != null).slice(-4)

  return (
    <>
      <Card>
        <SectionLabel>Revenue CAGR in Context</SectionLabel>
        <ThreeCol
          a={{ label: 'Historical (3Y)', value: pctStr(historical) }}
          b={{ label: 'Analyst FY+1',   value: pctStr(analyst) }}
          c={{ label: 'Model (5Y)',      value: pctStr(modelCAGR), highlight: cagrVerdict }}
        />
        <div className="mt-2">
          <DecisionLabel verdict={cagrVerdict} text={cagrLabel} />
        </div>
      </Card>

      {netMarginPoints.length >= 2 && (
        <Card>
          <SectionLabel>Net Margin Trend (Historical)</SectionLabel>
          <TrendBars points={netMarginPoints} unit="percent" />
          <p className="text-[10px] text-slate-400 mt-2">Model target shown in accordion above</p>
        </Card>
      )}

      <Card>
        <SectionLabel>Exit P/E — What It Means</SectionLabel>
        <div className="space-y-2.5">
          <DefinitionRow term="Exit P/E" definition="The earnings multiple you expect the market to pay in year 5." />
          <DefinitionRow term="10–20×" definition="Conservative — typical for mature, slow-growth companies." />
          <DefinitionRow term="20–30×" definition="Growth premium — requires sustained earnings momentum." />
          <DefinitionRow term="30×+" definition="High-growth pricing — highly sensitive to assumptions." />
        </div>
      </Card>
    </>
  )
}

// ─── EV/EBITDA context ────────────────────────────────────────────────────────

function EVEBITDAContext({
  sector, valuationMethods, derivedInsights,
}: {
  sector?: string | null
  valuationMethods?: ValuationMethods
  derivedInsights: DerivedFinancialInsights
}) {
  const estimates    = valuationMethods?.models?.multiples?.estimates ?? []
  const evEbitdaEst  = estimates.find(e => e.multiple === 'EV/EBITDA')

  const companyActual  = evEbitdaEst?.actualValue ?? null
  // Prefer the live estimate's sectorMedian — fall back to Damodaran static table
  const sectorMedian   = evEbitdaEst?.sectorMedian ?? getDefaultEVEBITDAMultiple(sector ?? null)
  const peerTickers    = evEbitdaEst?.peerTickers ?? []
  const benchmarkSrc   = evEbitdaEst?.benchmarkSource ?? 'industry-median'

  const premium = companyActual != null && sectorMedian > 0
    ? (companyActual - sectorMedian) / sectorMedian
    : null

  const multipleVerdict: Verdict =
    companyActual == null ? 'neutral' :
    companyActual > sectorMedian * 1.3 ? 'watch' :
    companyActual < sectorMedian * 0.7 ? 'good' : 'neutral'

  const multipleLabel =
    companyActual == null          ? 'No data' :
    companyActual > sectorMedian * 1.3 ? 'Premium to sector' :
    companyActual < sectorMedian * 0.7 ? 'Discount to sector' : 'Near sector median'

  function premiumText(): string {
    if (companyActual == null || premium == null) return ''
    const pctAbs  = Math.abs(premium * 100).toFixed(0)
    const current = companyActual.toFixed(1)
    const median  = sectorMedian.toFixed(1)
    if (premium > 0.3) {
      return `At ${current}× vs ${median}× sector median, the company trades at a ${pctAbs}% premium. The implied fair value shows what the stock would be worth if it re-rated toward sector norms — it won't unless growth expectations normalise.`
    }
    if (premium > 0) {
      return `A modest ${pctAbs}% premium over the sector median. The model's implied fair value assumes gradual re-rating toward the peer average.`
    }
    if (premium < -0.3) {
      return `At ${current}× vs ${median}× sector median, the company trades at a ${pctAbs}% discount — potential undervaluation, or the market sees lower quality/growth relative to peers.`
    }
    return `The company's EV/EBITDA broadly matches the sector median. The implied fair value is relatively close to the current price on this method.`
  }

  const sourceLabel =
    benchmarkSrc === 'live-peers' && peerTickers.length > 0
      ? `Live peers: ${peerTickers.slice(0, 3).join(', ')}${peerTickers.length > 3 ? ` +${peerTickers.length - 3} more` : ''}`
      : benchmarkSrc === 'industry-median'
      ? 'Damodaran Jan 2025 — industry median'
      : 'Broad sector fallback — less precise'

  const ebitdaPoints = derivedInsights.cashFlowTrend.ebitda.points.filter(p => p.value != null).slice(-5)
  const netDebt      = derivedInsights.latestMetrics.netDebt
  const isFinancial  = /financial|bank|insurance|fintech|payment/i.test(sector ?? '')

  return (
    <>
      {isFinancial && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">Sector Warning</p>
          <p className="text-[10px] text-amber-700 leading-snug">
            EV/EBITDA is less reliable for financial companies — debt is an operating input, not leverage. Consider P/E or P/Book instead.
          </p>
        </Card>
      )}

      {/* ── Current multiple vs sector median ── */}
      <Card>
        <div className="flex items-center justify-between mb-2">
          <SectionLabel>Multiple vs Sector</SectionLabel>
          <DecisionLabel verdict={multipleVerdict} text={multipleLabel} />
        </div>
        <ThreeCol
          a={{ label: 'Co. Current',   value: companyActual != null ? companyActual.toFixed(1) + '×' : null, highlight: multipleVerdict }}
          b={{ label: 'Sector Median', value: sectorMedian.toFixed(1) + '×' }}
          c={{ label: 'Premium / Disc', value: premium != null ? (premium >= 0 ? '+' : '') + (premium * 100).toFixed(0) + '%' : null, highlight: premium != null ? (premium > 0.3 ? 'watch' : premium < -0.3 ? 'good' : 'neutral') : 'neutral' }}
        />
        {companyActual != null && (
          <p className="text-[10px] text-slate-500 leading-snug mt-2.5">{premiumText()}</p>
        )}
        <p className="text-[9px] text-slate-400 mt-2 leading-snug">
          <span className="font-medium">Benchmark: </span>{sourceLabel}
        </p>
      </Card>

      {/* ── Absolute EBITDA trend ── */}
      {ebitdaPoints.length >= 2 && (
        <Card>
          <SectionLabel>EBITDA Growth (Historical)</SectionLabel>
          <TrendBars points={ebitdaPoints} unit="currency_millions" />
          <p className="text-[10px] text-slate-400 mt-1.5 leading-snug">
            Rising EBITDA can justify a higher multiple — flat or falling makes the premium harder to defend.
          </p>
        </Card>
      )}

      {/* ── Net Debt context ── */}
      {netDebt != null && (
        <Card>
          <SectionLabel>Net Debt Impact</SectionLabel>
          <div className="flex items-center justify-between mb-2">
            <span className="text-[11px] text-slate-600">Net Debt</span>
            <span className={cn('text-sm font-semibold tabular-nums', netDebt > 0 ? 'text-red-600' : 'text-emerald-600')}>
              {netDebt <= 0 ? '(net cash) ' : ''}{fmtLargeCurrency(Math.abs(netDebt) * 1e6)}
            </span>
          </div>
          <div className="space-y-2">
            <DefinitionRow term="Why it matters" definition="EV includes debt. A company with heavy debt needs much higher EBITDA to justify the same EV/EBITDA multiple as a debt-free peer." />
            <DefinitionRow term="Net Cash" definition="Cash exceeds debt — this reduces EV and makes the multiple look lower than a levered peer." />
          </div>
        </Card>
      )}

      {/* ── What the model assumes ── */}
      <Card>
        <SectionLabel>What This Model Assumes</SectionLabel>
        <div className="space-y-2.5">
          <DefinitionRow
            term="Implied fair value"
            definition="What the stock would be worth if the market priced it at the sector median multiple — not a prediction, but a re-rating reference point."
          />
          <DefinitionRow
            term="When to trust it"
            definition="Most reliable for mature, profitable companies in a sector with many comparable peers. Less reliable for high-growth or negative-EBITDA businesses."
          />
          <DefinitionRow
            term="Limitation"
            definition="Trailing multiple — uses last 12 months of EBITDA. Cyclical companies near peak earnings will look expensive; near a trough, cheap."
          />
        </div>
      </Card>
    </>
  )
}

// ─── Revenue Multiple context ─────────────────────────────────────────────────

function RevMultipleContext({
  cagr, cagrAnalysis, derivedInsights,
}: {
  cagr?: number
  cagrAnalysis?: CagrAnalysis
  derivedInsights: DerivedFinancialInsights
}) {
  const modelCAGR = cagr ?? null
  const historical = cagrAnalysis?.historicalCagr3y ?? null
  const analyst = cagrAnalysis?.analystEstimate1y ?? null

  const baseEffect = cagrAnalysis?.analystBaseEffect ?? false
  const diff = (!baseEffect && modelCAGR != null && analyst != null) ? modelCAGR - analyst : null
  const cagrVerdict: Verdict =
    baseEffect ? 'neutral' :
    diff == null ? 'neutral' :
    diff > 0.10  ? 'risk'   :
    diff > 0.03  ? 'watch'  :
    diff > -0.10 ? 'good'   : 'neutral'
  const cagrLabel =
    baseEffect   ? 'Base effect in 1Y est. — comparison unreliable' :
    diff == null ? 'No comparison data' :
    diff > 0.10  ? 'More aggressive than analysts' :
    diff > 0.03  ? 'Slightly above analysts' :
    diff > -0.10 ? 'In line with analysts' :
    diff > -0.25 ? 'Conservative vs analysts' :
                   'Significantly conservative vs analysts'

  const netMargin = derivedInsights.latestMetrics.netMargin
  const isUnprofitable = netMargin != null && netMargin < 0

  return (
    <>
      <Card>
        <SectionLabel>Revenue Growth in Context</SectionLabel>
        <ThreeCol
          a={{ label: 'Historical (3Y)', value: pctStr(historical) }}
          b={{ label: 'Analyst FY+1',   value: pctStr(analyst) }}
          c={{ label: 'Model (5Y)',      value: pctStr(modelCAGR), highlight: cagrVerdict }}
        />
        <div className="mt-2">
          <DecisionLabel verdict={cagrVerdict} text={cagrLabel} />
        </div>
      </Card>

      <Card>
        <SectionLabel>EV/Revenue Quick Guide</SectionLabel>
        <div className="space-y-2.5">
          <DefinitionRow term="High-growth SaaS" definition="8–15× typical when ARR is growing >30%/yr with strong retention." />
          <DefinitionRow term="Growth tech" definition="3–8× for 15–30% revenue growth with a path to profitability." />
          <DefinitionRow term="Mature / cyclical" definition="1–3× for slower growth or commodity-like businesses." />
        </div>
      </Card>

      {isUnprofitable && (
        <Card className="border-amber-200 bg-amber-50">
          <p className="text-[11px] font-semibold text-amber-800 mb-1">Profitability Warning</p>
          <p className="text-[10px] text-amber-700 leading-snug">
            Revenue multiples for unprofitable companies are speculative — there&apos;s no earnings anchor. Treat this as a ceiling estimate.
          </p>
        </Card>
      )}
    </>
  )
}

// ─── Reverse DCF context ──────────────────────────────────────────────────────

function ReverseDCFContext({
  cagrAnalysis, wacc, terminalG,
}: {
  cagrAnalysis?: CagrAnalysis
  wacc: WACCData
  terminalG?: number
}) {
  const historical = cagrAnalysis?.historicalCagr3y ?? null
  const analyst = cagrAnalysis?.analystEstimate1y ?? null

  const contextVerdict: Verdict =
    analyst == null || historical == null ? 'neutral' :
    analyst > historical + 0.05 ? 'watch' :
    analyst < historical - 0.05 ? 'good' : 'neutral'
  const contextLabel =
    analyst == null || historical == null ? 'Limited data' :
    analyst > historical + 0.05 ? 'Analyst is bullish vs history' :
    analyst < historical - 0.05 ? 'Analyst is cautious vs history' : 'Analyst aligns with history'

  return (
    <>
      <Card>
        <SectionLabel>What Growth Does This Price Assume?</SectionLabel>
        <TwoCol
          a={{ label: 'Analyst FY+1',  value: pctStr(analyst) }}
          b={{ label: 'History (3Y)',  value: pctStr(historical) }}
        />
        <div className="mt-2">
          <DecisionLabel verdict={contextVerdict} text={contextLabel} />
        </div>
        <p className="text-[10px] text-slate-400 mt-2">
          Market-implied CAGR shown in the accordion above
        </p>
      </Card>

      <Card>
        <SectionLabel>What Each Label Means</SectionLabel>
        <div className="space-y-2.5">
          <DefinitionRow term="Conservative" definition="Market expects less growth than history — potential upside if the company recovers." />
          <DefinitionRow term="Reasonable" definition="Market's expectation aligns with analysts and historical performance." />
          <DefinitionRow term="Aggressive" definition="Market prices in faster growth than analysts expect — higher risk if missed." />
          <DefinitionRow term="Very Aggressive" definition="Requires exceptional growth to justify the price — limited margin of safety." />
        </div>
      </Card>

      <Card>
        <SectionLabel>Assumptions Used</SectionLabel>
        <div className="flex gap-6">
          <div>
            <p className="text-[10px] text-slate-500">WACC</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900">{(wacc.wacc * 100).toFixed(1)}%</p>
          </div>
          <div>
            <p className="text-[10px] text-slate-500">Terminal G</p>
            <p className="text-sm font-semibold tabular-nums text-slate-900">{((terminalG ?? 0.025) * 100).toFixed(1)}%</p>
          </div>
        </div>
      </Card>
    </>
  )
}

// ─── Full DCF context ─────────────────────────────────────────────────────────

function FullDCFContext({
  wacc, cagr, terminalG, derivedInsights,
}: {
  wacc: WACCData
  cagr?: number
  terminalG?: number
  derivedInsights: DerivedFinancialInsights
}) {
  const tG = terminalG ?? 0.025
  const termVerdict: Verdict = tG > 0.03 ? 'watch' : 'good'
  const termLabel = tG > 0.03 ? 'Above long-term GDP growth' : 'Standard long-term growth'

  const fcfPoints = derivedInsights.marginTrend.fcf.points.filter(p => p.value != null).slice(-4)

  return (
    <>
      <Card>
        <SectionLabel>Discount Rate (WACC)</SectionLabel>
        <div className="space-y-1.5">
          {[
            { label: 'WACC',           value: (wacc.wacc * 100).toFixed(1) + '%',          tip: 'The minimum annual return this investment needs to justify its risk. Higher WACC = lower fair value.' },
            { label: 'Cost of Equity', value: (wacc.costOfEquity * 100).toFixed(1) + '%',  tip: 'The return equity holders require, based on the stock\'s risk (beta) and the broader market return.' },
            { label: 'Beta',           value: wacc.inputs.beta.toFixed(2),                  tip: 'How much this stock moves relative to the market. >1 = more volatile; <1 = more stable.' },
            { label: 'Risk-Free Rate', value: (wacc.inputs.rfRate * 100).toFixed(2) + '%', tip: 'The yield on long-term government bonds — the baseline "safe" return everything else is measured against.' },
          ].map(({ label, value, tip }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                {label}
                <InfoTooltip text={tip} side="left" />
              </span>
              <span className="text-[11px] font-semibold text-slate-900 tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {fcfPoints.length >= 2 && (
        <Card>
          <SectionLabel>FCF Margin Trend</SectionLabel>
          <TrendBars points={fcfPoints} unit="percent" />
        </Card>
      )}

      <Card>
        <SectionLabel>Growth Inputs</SectionLabel>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] text-slate-600">Revenue CAGR (5Y)</span>
          <span className="text-[11px] font-semibold tabular-nums text-slate-900">
            {cagr != null ? (cagr * 100).toFixed(1) + '%' : '—'}
          </span>
        </div>
        <div className="flex items-center justify-between mb-2">
          <span className="text-[11px] text-slate-600">Terminal Growth</span>
          <span className="text-[11px] font-semibold tabular-nums text-slate-900">{(tG * 100).toFixed(1)}%</span>
        </div>
        <DecisionLabel verdict={termVerdict} text={termLabel} />
      </Card>

      <Card>
        <SectionLabel>Sensitivity Note</SectionLabel>
        <p className="text-[10px] text-slate-500 leading-snug">
          DCF fair values are highly sensitive to WACC and terminal growth. A 1% change in WACC typically moves fair value ±15–20%. Use the scenario range as a sanity check.
        </p>
      </Card>
    </>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function ValuationSidebar({
  wacc, valuationMethods, fairValue: _fairValue, currentPrice, currency,
  scenarios, cagr, terminalG,
  activeMethodId, derivedInsights, cagrAnalysis, sector,
}: Props) {
  const blended = valuationMethods?.triangulatedFairValue ?? null
  const blendedUpside = valuationMethods?.triangulatedUpsidePct ?? null
  const weights = valuationMethods?.effectiveWeights
  const ctx = activeMethodId ?? null

  return (
    <div className="space-y-4">
      {ctx === 'forward_pe' && (
        <ForwardPEContext cagr={cagr} cagrAnalysis={cagrAnalysis} derivedInsights={derivedInsights} />
      )}
      {ctx === 'ev_ebitda' && (
        <EVEBITDAContext sector={sector} valuationMethods={valuationMethods} derivedInsights={derivedInsights} />
      )}
      {ctx === 'revenue_multiple' && (
        <RevMultipleContext cagr={cagr} cagrAnalysis={cagrAnalysis} derivedInsights={derivedInsights} />
      )}
      {ctx === 'reverse_dcf' && (
        <ReverseDCFContext cagrAnalysis={cagrAnalysis} wacc={wacc} terminalG={terminalG} />
      )}
      {ctx === 'full_dcf' && (
        <FullDCFContext wacc={wacc} cagr={cagr} terminalG={terminalG} derivedInsights={derivedInsights} />
      )}
      {!ctx && (
        <DefaultView
          blended={blended}
          blendedUpside={blendedUpside}
          currentPrice={currentPrice}
          currency={currency}
          valuationMethods={valuationMethods}
          scenarios={scenarios}
          weights={weights}
        />
      )}
    </div>
  )
}
