'use client'
import { Award, TrendingUp, CircleDollarSign, RefreshCcw, ShieldCheck, AlertTriangle, Tag, type LucideIcon } from 'lucide-react'
import InfoTooltip from '@/components/ui/InfoTooltip'

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, any>

interface StockRatingsCategory {
  score: number
  grade: string
  label: string
  color: 'emerald' | 'green' | 'blue' | 'amber' | 'orange' | 'red'
  summary: string
}

interface StockRatings {
  profitability?: StockRatingsCategory
  liquidity?: StockRatingsCategory
  growth?: StockRatingsCategory
  moat?: StockRatingsCategory
  valuation?: StockRatingsCategory
  overall?: { score: number; grade: string; label: string; color: string }
}

interface ScoresData {
  altman?: { zScore: number; zone: 'Safe' | 'Grey' | 'Distress'; isReliable?: boolean } | null
  roic?: { roic: number; spread: number; dataAvailable: boolean } | null
}

interface BusinessProfile {
  grossMargin: number | null
  netMargin: number | null
  fcfMargin: number | null
  revenueM: number
}

interface CAGRAnalysisData {
  historicalCagr3y: number
  analystEstimate1y: number
  blended: number
  drivers: string[]
}

type RiskColor = 'red' | 'amber' | 'emerald'

interface StatementsData {
  ttm: {
    incomeStatement: AnyRecord | null
    balanceSheet: AnyRecord | null
    cashFlow: AnyRecord | null
  }
}

interface Props {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  ratings: StockRatings | any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  scores: ScoresData | any
  businessProfile: BusinessProfile
  cagrAnalysis: CAGRAnalysisData | null
  statementsData: StatementsData | null
  onViewRisks?: () => void
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  valuationMethods?: any
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  quote?: any
}

// ─── helpers ─────────────────────────────────────────────────────────────────

function fmtPct(n: number | null | undefined, decimals = 1): string {
  if (n == null) return '—'
  return `${(n * 100).toFixed(decimals)}%`
}

function gradeBadge(color: string): string {
  if (color === 'emerald' || color === 'green')
    return 'bg-emerald-50 text-emerald-700 border border-emerald-100'
  if (color === 'blue')
    return 'bg-blue-50 text-blue-700 border border-blue-100'
  if (color === 'amber' || color === 'orange')
    return 'bg-amber-50 text-amber-700 border border-amber-100'
  return 'bg-red-50 text-red-700 border border-red-100'
}

function MetricRow({ label, value, valueClass, tooltip }: { label: string; value: string; valueClass?: string; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-[13px] text-slate-500 truncate flex items-center gap-0.5">
        {label}
        {tooltip && <InfoTooltip content={tooltip} />}
      </span>
      <span className={`text-[13px] font-semibold tabular-nums shrink-0 ${valueClass ?? 'text-slate-800'}`}>{value}</span>
    </div>
  )
}

function iconAccent(color: string): string {
  if (color === 'emerald' || color === 'green') return 'text-emerald-500'
  if (color === 'blue')                         return 'text-blue-500'
  if (color === 'amber' || color === 'orange')  return 'text-amber-500'
  return 'text-red-500'
}

function CardHeader({ title, label, color, tooltip, Icon }: { title: string; label: string; color: string; tooltip?: string; Icon?: LucideIcon }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
        {Icon && <Icon size={13} className={`shrink-0 ${iconAccent(color)}`} />}
        {title}
        {tooltip && <InfoTooltip content={tooltip} />}
      </p>
      <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${gradeBadge(color)}`}>{label}</span>
    </div>
  )
}

function MiniBar({ value, max, color }: { value: number; max: number; color: string }) {
  const pct = Math.min(Math.max((value / max) * 100, 0), 100)
  const barColor = color === 'emerald' ? 'bg-emerald-400'
    : color === 'blue' ? 'bg-blue-400'
    : color === 'amber' ? 'bg-amber-400'
    : 'bg-red-400'
  return (
    <div className="flex-1 h-1.5 bg-slate-100 rounded-full overflow-hidden">
      <div className={`h-full rounded-full ${barColor}`} style={{ width: `${pct}%` }} />
    </div>
  )
}

// ─── Card 1: Business Quality ──────────────────────────────────────────────

function BusinessQualityCard({ ratings, scores }: { ratings: StockRatings; scores: ScoresData }) {
  const moat = ratings.moat
  const profitability = ratings.profitability
  const cat = moat ?? profitability
  const color = cat?.color ?? 'blue'
  const label = cat?.label ?? 'Analyzing…'

  const roic = scores.roic
  const spreadPct = roic?.dataAvailable && roic.spread != null
    ? `${roic.spread >= 0 ? '+' : ''}${(roic.spread * 100).toFixed(1)}pp vs WACC`
    : '—'
  const spreadClass = roic?.spread != null && roic.spread >= 0 ? 'text-emerald-600' : 'text-red-500'

  const roicSpread = roic?.spread ?? null
  const interpSentence = roicSpread != null
    ? roicSpread >= 0.08
      ? 'High capital returns and a strong moat support a premium valuation.'
      : roicSpread >= 0.02
        ? 'Business earns above its cost of capital — value-creating fundamentals.'
        : roicSpread >= 0
          ? 'Returns marginally above cost of capital — watch for spread compression.'
          : 'ROIC below WACC suggests the business is currently destroying value.'
    : moat?.score != null && moat.score >= 75
      ? 'Strong competitive advantages support durable earnings.'
      : 'Competitive positioning requires monitoring.'

  return (
    <div className="rounded-[18px] border border-[#E6ECF5] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
      <CardHeader title="Business Quality" label={label} color={color} Icon={Award} />
      <div className="space-y-2.5 mb-3">
        <MetricRow label="Economic Moat" value={moat?.label ?? '—'} />
        <MetricRow
          label="ROIC vs WACC"
          value={spreadPct}
          valueClass={spreadClass}
          tooltip="Return on Invested Capital minus the cost of capital. A positive spread means the business earns more than it costs to run — the hallmark of a quality compounder."
        />
        <MetricRow
          label="Profitability Grade"
          value={profitability ? `${profitability.grade} — ${profitability.label}` : '—'}
        />
      </div>
      <p className="text-[12px] text-slate-400 leading-snug border-t border-slate-100 pt-2">{interpSentence}</p>
    </div>
  )
}

// ─── Card 2: Growth Outlook ────────────────────────────────────────────────

function GrowthOutlookCard({ ratings, cagrAnalysis }: { ratings: StockRatings; cagrAnalysis: CAGRAnalysisData | null }) {
  const growth = ratings.growth
  const color = growth?.color ?? 'blue'
  const label = growth?.label ?? 'Analyzing…'

  const hist = cagrAnalysis?.historicalCagr3y
  const analyst = cagrAnalysis?.analystEstimate1y
  const blended = cagrAnalysis?.blended
  const maxBar = Math.max(Math.abs(hist ?? 0), Math.abs(analyst ?? 0), Math.abs(blended ?? 0), 0.01) * 1.1

  const growthSentence = hist != null && analyst != null
    ? hist >= 0.15 && analyst >= 0.10
      ? 'Consistent high-growth trajectory with strong analyst conviction.'
      : hist >= 0.05 && analyst >= 0
        ? 'Moderate growth backed by analyst consensus.'
        : analyst < 0
          ? 'Analysts project a slowdown — monitor closely.'
          : 'Growth decelerating — watch for narrative reset.'
    : hist != null
      ? hist >= 0.15 ? 'Strong historical growth trajectory.' : 'Historical growth is moderate.'
      : analyst != null
        ? analyst >= 0.10 ? 'Analysts expect strong growth ahead.' : 'Analyst growth outlook is cautious.'
        : 'Insufficient data to assess growth trajectory.'

  return (
    <div className="rounded-[18px] border border-[#E6ECF5] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
      <CardHeader title="Growth Outlook" label={label} color={color} Icon={TrendingUp} />
      <div className="space-y-2.5 mb-3">
        {hist != null && (
          <div>
            <div className="flex items-center gap-2 mb-1 min-w-0">
              <span className="text-[12px] text-slate-500 w-28 shrink-0">3Y Historical CAGR</span>
              <MiniBar value={Math.abs(hist)} max={maxBar} color={hist >= 0 ? 'blue' : 'amber'} />
              <span className="text-[13px] font-semibold tabular-nums text-slate-700 w-12 text-right">{fmtPct(hist)}</span>
            </div>
          </div>
        )}
        {analyst != null && (
          <div>
            <div className="flex items-center gap-2 mb-1 min-w-0">
              <span className="text-[12px] text-slate-500 w-28 shrink-0">Analyst Est. (1Y)</span>
              <MiniBar value={Math.abs(analyst)} max={maxBar} color={analyst >= 0 ? 'emerald' : 'amber'} />
              <span className="text-[13px] font-semibold tabular-nums text-slate-700 w-12 text-right">{fmtPct(analyst)}</span>
            </div>
          </div>
        )}
        {!hist && !analyst && (
          <p className="text-[12px] text-slate-400 italic">Growth data unavailable</p>
        )}
      </div>
      <p className="text-[12px] text-slate-400 leading-snug border-t border-slate-100 pt-2">{growthSentence}</p>
    </div>
  )
}

// ─── Card 3: Profitability ─────────────────────────────────────────────────

function ProfitabilityCard({ ratings, businessProfile, statementsData }: {
  ratings: StockRatings
  businessProfile: BusinessProfile
  statementsData: StatementsData | null
}) {
  const profitability = ratings.profitability
  const color = profitability?.color ?? 'blue'
  const label = profitability?.label ?? 'Analyzing…'

  const ttmIS = statementsData?.ttm?.incomeStatement
  const opIncome = (ttmIS?.operatingIncome ?? ttmIS?.ebit ?? null) as number | null
  const revenue = (ttmIS?.totalRevenue ?? ttmIS?.revenue ?? null) as number | null
  const opMargin = opIncome != null && revenue != null && revenue > 0 ? opIncome / revenue : null

  const fcf = businessProfile.fcfMargin
  const profSentence = fcf != null
    ? fcf >= 0.20 ? 'Best-in-class cash profitability — strong earnings quality.'
    : fcf >= 0.10 ? 'Solid margins and cash generation support the valuation.'
    : fcf >= 0    ? 'Margins are positive but below premium-quality threshold.'
    : 'Negative FCF margin — cash burn requires close monitoring.'
    : businessProfile.netMargin != null
      ? businessProfile.netMargin >= 0.15 ? 'High net margin indicates strong pricing power.'
      : businessProfile.netMargin >= 0 ? 'Positive but thin margins — growth needed to expand.'
      : 'Net losses present — profitability path must be clear.'
      : 'Profitability data partially unavailable.'

  return (
    <div className="rounded-[18px] border border-[#E6ECF5] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
      <CardHeader title="Profitability" label={label} color={color} Icon={CircleDollarSign} />
      <div className="space-y-2.5 mb-3">
        <MetricRow label="Gross Margin" value={fmtPct(businessProfile.grossMargin)} />
        <MetricRow label="Operating Margin" value={opMargin != null ? fmtPct(opMargin) : '—'} />
        <MetricRow label="Net Margin" value={fmtPct(businessProfile.netMargin)} />
        <MetricRow label="FCF Margin" value={fmtPct(businessProfile.fcfMargin)} />
      </div>
      <p className="text-[12px] text-slate-400 leading-snug border-t border-slate-100 pt-2">{profSentence}</p>
    </div>
  )
}

// ─── Card 4: Cash Conversion ───────────────────────────────────────────────

function CashConversionCard({ businessProfile, statementsData }: {
  businessProfile: BusinessProfile
  statementsData: StatementsData | null
}) {
  const ttmIS = statementsData?.ttm?.incomeStatement
  const ttmCF = statementsData?.ttm?.cashFlow

  const fcf = (ttmCF?.freeCashFlow ?? null) as number | null
  const netIncome = (ttmIS?.netIncome ?? ttmIS?.netIncomeFromContinuingOperations ?? null) as number | null
  const conversionRatio = fcf != null && netIncome != null && netIncome > 0
    ? fcf / netIncome : null

  const isGood = businessProfile.fcfMargin != null && businessProfile.fcfMargin > 0.10
  const color = isGood ? 'emerald' : businessProfile.fcfMargin != null && businessProfile.fcfMargin > 0 ? 'blue' : 'amber'
  const label = isGood ? 'Strong' : businessProfile.fcfMargin != null && businessProfile.fcfMargin > 0 ? 'Moderate' : 'Weak'

  const cashSentence = conversionRatio != null
    ? conversionRatio >= 0.80 ? 'Earnings convert reliably to cash — high earnings quality signal.'
    : conversionRatio >= 0.50 ? 'Moderate cash conversion — track working capital changes.'
    : 'Low cash conversion — investigate accruals and earnings quality.'
    : businessProfile.fcfMargin != null && businessProfile.fcfMargin > 0
      ? 'Positive FCF generation — business is self-funding.'
      : 'Insufficient data to assess cash conversion quality.'

  return (
    <div className="rounded-[18px] border border-[#E6ECF5] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
      <CardHeader title="Cash Conversion" label={label} color={color} Icon={RefreshCcw} />
      <div className="space-y-2.5 mb-3">
        <MetricRow label="FCF Margin (TTM)" value={fmtPct(businessProfile.fcfMargin)} />
        <MetricRow
          label="FCF / Net Income"
          value={conversionRatio != null ? `${(conversionRatio * 100).toFixed(0)}%` : '—'}
          valueClass={conversionRatio != null ? (conversionRatio >= 0.8 ? 'text-emerald-600' : conversionRatio >= 0.5 ? 'text-amber-600' : 'text-red-500') : undefined}
          tooltip="What share of reported earnings converts to real cash. >80% is a quality signal — it means profits are backed by cash, not just accounting entries."
        />
      </div>
      <p className="text-[12px] text-slate-400 leading-snug border-t border-slate-100 pt-2">{cashSentence}</p>
    </div>
  )
}

// ─── Card 5: Balance Sheet Safety ─────────────────────────────────────────

function BalanceSheetCard({ scores, statementsData }: {
  scores: ScoresData
  statementsData: StatementsData | null
}) {
  const ttmBS = statementsData?.ttm?.balanceSheet
  const ttmIS = statementsData?.ttm?.incomeStatement

  // fundamentalsTimeSeries uses currentAssets/currentLiabilities; quoteSummary uses totalCurrentAssets/totalCurrentLiabilities
  const totalCurrentAssets = (ttmBS?.totalCurrentAssets ?? ttmBS?.currentAssets ?? null) as number | null
  const totalCurrentLiabilities = (ttmBS?.totalCurrentLiabilities ?? ttmBS?.currentLiabilities ?? null) as number | null
  const inventories = (ttmBS?.inventory ?? ttmBS?.inventories ?? null) as number | null
  const currentRatio = totalCurrentAssets != null && totalCurrentLiabilities != null && totalCurrentLiabilities > 0
    ? totalCurrentAssets / totalCurrentLiabilities : null
  const quickRatio = currentRatio != null
    ? (totalCurrentAssets! - (inventories ?? 0)) / totalCurrentLiabilities!
    : null

  const totalDebt = (ttmBS?.totalDebt ?? ttmBS?.longTermDebtAndCapitalLeaseObligation ?? ttmBS?.longTermDebt ?? null) as number | null
  const cash = (ttmBS?.cashCashEquivalentsAndShortTermInvestments ?? ttmBS?.cashAndCashEquivalents ?? null) as number | null
  const ebitdaRaw = (ttmIS?.EBITDA ?? ttmIS?.normalizedEBITDA ?? null) as number | null
  const netDebt = totalDebt != null && cash != null ? totalDebt - cash : null
  const ndToEbitda = netDebt != null && ebitdaRaw != null && ebitdaRaw > 0
    ? netDebt / ebitdaRaw : null

  const altman = scores.altman
  const zone = altman?.zone ?? null
  const zoneColor = zone === 'Safe' ? 'text-emerald-600' : zone === 'Grey' ? 'text-amber-600' : zone === 'Distress' ? 'text-red-500' : undefined

  const bsColor = zone === 'Safe' || (currentRatio != null && currentRatio >= 1.5) ? 'emerald'
    : zone === 'Distress' ? 'red'
    : 'blue'
  const bsLabel = zone === 'Safe' ? 'Strong' : zone === 'Grey' ? 'Fair' : zone === 'Distress' ? 'Distressed' : 'Analyzing…'

  const bsSentence = ndToEbitda != null
    ? ndToEbitda <= 0   ? 'Net cash position — exceptional balance sheet strength.'
    : ndToEbitda <= 1.5 ? 'Minimal debt load — strong financial flexibility.'
    : ndToEbitda <= 3.0 ? 'Manageable leverage — no immediate refinancing concern.'
    : ndToEbitda <= 5.0 ? 'Elevated leverage — monitor debt maturity and coverage.'
    : 'High debt relative to earnings — significant refinancing risk.'
    : zone === 'Safe'     ? 'Altman Z-Score indicates a financially sound company.'
    : zone === 'Distress' ? 'Distress signals present — solvency risk elevated.'
    : currentRatio != null && currentRatio >= 1.5
      ? 'Healthy liquidity — covers short-term obligations comfortably.'
      : 'Balance sheet health requires further analysis.'

  return (
    <div className="rounded-[18px] border border-[#E6ECF5] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
      <CardHeader title="Balance Sheet Safety" label={bsLabel} color={bsColor} Icon={ShieldCheck} />
      <div className="space-y-2.5 mb-3">
        <MetricRow
          label="Net Debt / EBITDA"
          value={ndToEbitda != null ? `${ndToEbitda.toFixed(1)}x` : '—'}
          valueClass={ndToEbitda != null ? (ndToEbitda <= 2 ? 'text-emerald-600' : ndToEbitda <= 4 ? 'text-amber-600' : 'text-red-500') : undefined}
        />
        <MetricRow
          label="Current Ratio"
          value={currentRatio != null ? currentRatio.toFixed(1) : '—'}
          valueClass={currentRatio != null ? (currentRatio >= 1.5 ? 'text-emerald-600' : currentRatio >= 1.0 ? 'text-amber-600' : 'text-red-500') : undefined}
        />
        <MetricRow
          label="Quick Ratio"
          value={quickRatio != null ? quickRatio.toFixed(1) : '—'}
          valueClass={quickRatio != null ? (quickRatio >= 1.0 ? 'text-emerald-600' : quickRatio >= 0.7 ? 'text-amber-600' : 'text-red-500') : undefined}
        />
        {altman != null && (
          <MetricRow
            label={`Altman Z-Score${altman.isReliable === false ? ' *' : ''}`}
            value={`${altman.zScore.toFixed(1)} (${zone})`}
            valueClass={zoneColor}
          />
        )}
        {altman?.isReliable === false && (
          <p className="text-[10px] text-slate-400 leading-snug">* Z-Score may be unreliable for non-US companies</p>
        )}
      </div>
      <p className="text-[12px] text-slate-400 leading-snug border-t border-slate-100 pt-2">{bsSentence}</p>
    </div>
  )
}

// ─── Card 6: Risks to Thesis ──────────────────────────────────────────────

function deriveRiskLevel(ratings: StockRatings): { label: string; color: RiskColor; badgeClass: string } {
  const valuation = ratings.valuation
  const growth    = ratings.growth
  const moat      = ratings.moat

  const isElevated =
    (valuation?.color === 'red' || valuation?.color === 'orange') ||
    (growth?.score != null && growth.score < 60) ||
    (moat?.score != null   && moat.score < 60)

  const isModerate =
    !isElevated && (
      (growth?.score != null && growth.score < 75) ||
      (moat?.score  != null && moat.score  < 75) ||
      valuation?.color === 'amber'
    )

  if (isElevated) return { label: 'Elevated', color: 'red', badgeClass: 'bg-red-50 text-red-700 border border-red-200' }
  if (isModerate) return { label: 'Moderate', color: 'amber', badgeClass: 'bg-amber-50 text-amber-700 border border-amber-200' }
  return { label: 'Low', color: 'emerald', badgeClass: 'bg-emerald-50 text-emerald-700 border border-emerald-200' }
}

function buildRiskBullets(ratings: StockRatings, cagrAnalysis: CAGRAnalysisData | null): string[] {
  const bullets: string[] = []
  if (cagrAnalysis?.drivers) {
    const neg = cagrAnalysis.drivers.filter(d =>
      /compet|risk|challeng|declin|uncertain|pressur|headwind|vola|concern|restrict|slow|expos|regulat/i.test(d)
    )
    bullets.push(...neg.slice(0, 3))
  }
  const weakMap: Record<string, string> = {
    profitability: 'Profitability is under pressure — margins warrant close monitoring.',
    growth:        'Growth trajectory is slowing or inconsistent relative to expectations.',
    moat:          'Competitive advantage is limited, increasing long-term earnings risk.',
    valuation:     'Current valuation leaves limited margin of safety for new buyers.',
    liquidity:     'Balance sheet liquidity is stretched — short-term solvency requires attention.',
  }
  for (const key of ['profitability', 'liquidity', 'growth', 'moat', 'valuation'] as const) {
    const cat = ratings[key]
    if (cat && (cat.color === 'red' || cat.color === 'orange' || cat.color === 'amber') && bullets.length < 4) {
      if (weakMap[key]) bullets.push(weakMap[key])
    }
  }
  if (bullets.length === 0) bullets.push('No major red flags identified from available financial data.')
  return bullets.slice(0, 4)
}

function RisksGridCard({ ratings, cagrAnalysis, onViewRisks }: {
  ratings: StockRatings
  cagrAnalysis: CAGRAnalysisData | null
  onViewRisks?: () => void
}) {
  const risk    = deriveRiskLevel(ratings)
  const bullets = buildRiskBullets(ratings, cagrAnalysis)

  const dotColor = risk.color === 'red' ? 'bg-red-400' : risk.color === 'amber' ? 'bg-amber-400' : 'bg-emerald-400'

  return (
    <div className="rounded-[18px] border border-[#E6ECF5] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <p className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest flex items-center gap-1.5">
          <AlertTriangle size={13} className={`shrink-0 ${risk.color === 'red' ? 'text-red-500' : risk.color === 'amber' ? 'text-amber-500' : 'text-emerald-500'}`} />
          Risks to Thesis
        </p>
        <span className={`text-[11px] font-semibold px-2.5 py-0.5 rounded-full ${risk.badgeClass}`}>{risk.label}</span>
      </div>
      <ul className="space-y-1.5 mb-3">
        {bullets.map((b, i) => (
          <li key={i} className="flex items-start gap-2">
            <span className={`mt-1.5 w-1.5 h-1.5 rounded-full shrink-0 ${dotColor}`} />
            <span className="text-[13px] text-slate-600 leading-snug">{b}</span>
          </li>
        ))}
      </ul>
      {onViewRisks && (
        <button onClick={onViewRisks} className="text-[13px] font-medium text-blue-600 hover:text-blue-700 transition-colors">
          View all risks →
        </button>
      )}
    </div>
  )
}

// ─── Relative Valuation card ──────────────────────────────────────────────────

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function RelativeValuationCard({ valuationMethods, quote }: { valuationMethods: any; quote: any }) {
  const estimates: AnyRecord[] = valuationMethods?.multiples?.estimates ?? []
  const peRatio  = quote?.peRatio  ?? null
  const pegRatio = quote?.pegRatio ?? null

  const applicable = estimates.filter((e: AnyRecord) => e.applicable && e.actualValue > 0 && e.sectorMedian > 0)

  if (applicable.length === 0 && peRatio == null) return null

  // Derive overall relative valuation signal
  let expensiveCount = 0, cheapCount = 0
  applicable.forEach((e: AnyRecord) => {
    const ratio = e.actualValue / e.sectorMedian
    if (ratio > 1.25) expensiveCount++
    else if (ratio < 0.80) cheapCount++
  })

  let overallLabel: string
  let overallClass: string
  if (expensiveCount > applicable.length / 2) {
    overallLabel = 'Expensive'; overallClass = 'bg-red-50 text-red-700 border-red-200'
  } else if (cheapCount > applicable.length / 2) {
    overallLabel = 'Cheap'; overallClass = 'bg-emerald-50 text-emerald-700 border-emerald-200'
  } else {
    overallLabel = 'Fair'; overallClass = 'bg-blue-50 text-blue-700 border-blue-200'
  }

  const LABELS: Record<string, string> = {
    pe: 'P/E (TTM)', evEbitda: 'EV/EBITDA', evRevenue: 'EV/Revenue', ps: 'P/S'
  }

  function vsClass(actual: number, median: number): string {
    const r = actual / median
    if (r > 1.25) return 'text-red-600'
    if (r < 0.80) return 'text-emerald-600'
    return 'text-slate-600'
  }

  return (
    <div className="rounded-[18px] border border-[#E6ECF5] bg-white px-5 py-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-1.5 min-w-0">
          <Tag size={13} className={`shrink-0 ${overallLabel === 'Cheap' ? 'text-emerald-500' : overallLabel === 'Expensive' ? 'text-red-500' : 'text-blue-500'}`} />
          <span className="text-[11px] font-semibold text-slate-400 uppercase tracking-widest truncate">Relative Valuation</span>
        </div>
        <span className={`text-[11px] font-bold px-2.5 py-0.5 rounded-full border whitespace-nowrap ${overallClass}`}>
          {overallLabel}
        </span>
      </div>
      <div className="space-y-2">
        {applicable.slice(0, 3).map((e: AnyRecord) => (
          <div key={e.multiple} className="flex items-center justify-between">
            <span className="text-[13px] text-slate-500 flex items-center gap-0.5">
              {LABELS[e.multiple] ?? e.multiple}
              {e.multiple === 'evEbitda' && (
                <InfoTooltip content="Enterprise Value divided by EBITDA. Compares total company value (including debt) to operating earnings. Lower than sector median suggests cheaper relative pricing." />
              )}
            </span>
            <div className="flex items-center gap-2">
              <span className={`text-[13px] font-semibold tabular-nums ${vsClass(e.actualValue, e.sectorMedian)}`}>
                {e.actualValue.toFixed(1)}×
              </span>
              <span className="text-[10px] text-slate-300">vs</span>
              <span className="text-[11px] text-slate-400 tabular-nums">{e.sectorMedian.toFixed(1)}×</span>
            </div>
          </div>
        ))}
        {pegRatio != null && pegRatio > 0 && pegRatio < 100 && (
          <div className="flex items-center justify-between">
            <span className="text-[13px] text-slate-500 flex items-center gap-0.5">
              PEG (5Y)
              <InfoTooltip content="Price/Earnings to Growth. Below 1 suggests growth may be underpriced. Above 2 often signals expensive relative to growth expectations." />
            </span>
            <span className={`text-[13px] font-semibold tabular-nums ${pegRatio < 1 ? 'text-emerald-600' : pegRatio > 2 ? 'text-red-600' : 'text-slate-600'}`}>
              {pegRatio.toFixed(2)}×
            </span>
          </div>
        )}
      </div>
      {applicable.length > 0 && (
        <p className="text-[11px] text-slate-400 mt-3 leading-relaxed">vs. sector median</p>
      )}
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────

export default function OverviewMetricGrid({ ratings, scores, businessProfile, cagrAnalysis, statementsData, onViewRisks, valuationMethods, quote }: Props) {
  if (!ratings) return null

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
      <BusinessQualityCard ratings={ratings} scores={scores ?? {}} />
      <GrowthOutlookCard ratings={ratings} cagrAnalysis={cagrAnalysis} />
      <ProfitabilityCard ratings={ratings} businessProfile={businessProfile} statementsData={statementsData} />
      <CashConversionCard businessProfile={businessProfile} statementsData={statementsData} />
      <BalanceSheetCard scores={scores ?? {}} statementsData={statementsData} />
      {valuationMethods ? (
        <RelativeValuationCard valuationMethods={valuationMethods} quote={quote} />
      ) : (
        <RisksGridCard ratings={ratings} cagrAnalysis={cagrAnalysis} onViewRisks={onViewRisks} />
      )}
    </div>
  )
}
