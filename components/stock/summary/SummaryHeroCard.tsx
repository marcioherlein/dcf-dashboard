'use client'

import { TrendingUp, Target, BarChart2, ShieldCheck, Star } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtPrice, fmtPct } from '@/lib/formatters'

// ─── Types ────────────────────────────────────────────────────────────────────

interface ScenarioCase {
  fairValue: number
  wacc: number
  cagr: number
  terminalG: number
}

interface SummaryHeroCardProps {
  ticker: string
  price: number
  currency: string
  fairValue: number | null
  upsidePct: number | null
  confidence: 'High' | 'Medium' | 'Low' | null
  modelCount: number
  totalModels: number
  scenarios: {
    bull: ScenarioCase
    base: ScenarioCase
    bear: ScenarioCase
  } | null
  drivers: string[]
  onViewValuation: () => void
}

// ─── Verdict logic ────────────────────────────────────────────────────────────

interface VerdictConfig {
  word: string
  chipLabel: string
  chipClass: string
  wordClass: string
  descVerb: string
  bgGradient: string
  borderClass: string
}

function deriveVerdict(upsidePct: number | null): VerdictConfig {
  if (upsidePct == null) return {
    word: 'Uncertain', chipLabel: '—',
    chipClass: 'bg-slate-100 text-slate-500 border-slate-200',
    wordClass: 'text-slate-600', descVerb: 'insufficient data',
    bgGradient: 'bg-[#F8FAFC]', borderClass: 'border-[#E6ECF5]',
  }
  if (upsidePct > 0.25) return {
    word: 'Attractive', chipLabel: 'Deep Value',
    chipClass: 'bg-[#ECFDF3] text-[#047857] border-[#BBF7D0]',
    wordClass: 'text-[#16A34A]', descVerb: 'meaningfully undervalued',
    bgGradient: 'bg-gradient-to-br from-[#ECFDF3] via-[#F8FAFC] to-white', borderClass: 'border-[#BBF7D0]',
  }
  if (upsidePct > 0.05) return {
    word: 'Undervalued', chipLabel: 'Undervalued',
    chipClass: 'bg-[#ECFDF3] text-[#047857] border-[#BBF7D0]',
    wordClass: 'text-[#16A34A]', descVerb: 'modestly undervalued',
    bgGradient: 'bg-gradient-to-br from-[#ECFDF3] via-[#F8FAFC] to-white', borderClass: 'border-[#BBF7D0]',
  }
  if (upsidePct >= -0.10) return {
    word: 'Fairly Valued', chipLabel: 'Near Fair Value',
    chipClass: 'bg-[#EFF6FF] text-[#2563EB] border-[#BFDBFE]',
    wordClass: 'text-[#2563EB]', descVerb: 'near fair value',
    bgGradient: 'bg-gradient-to-br from-[#EFF6FF] via-[#F8FAFC] to-white', borderClass: 'border-[#BFDBFE]',
  }
  if (upsidePct >= -0.25) return {
    word: 'Overvalued', chipLabel: 'Overvalued',
    chipClass: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
    wordClass: 'text-[#DC2626]', descVerb: 'overvalued',
    bgGradient: 'bg-gradient-to-br from-[#FEF2F2] via-[#F8FAFC] to-white', borderClass: 'border-[#FECACA]',
  }
  return {
    word: 'Expensive', chipLabel: 'Expensive',
    chipClass: 'bg-[#FEF2F2] text-[#DC2626] border-[#FECACA]',
    wordClass: 'text-[#DC2626]', descVerb: 'significantly overvalued',
    bgGradient: 'bg-gradient-to-br from-[#FEF2F2] via-[#F8FAFC] to-white', borderClass: 'border-[#FECACA]',
  }
}

// ─── Hero background ──────────────────────────────────────────────────────────

function deriveHeroBg(upsidePct: number | null): string {
  if (upsidePct == null) return '#F8FAFC'
  if (upsidePct > 0.05) return 'radial-gradient(circle at 82% 38%, rgba(22,163,74,0.10), transparent 32%), linear-gradient(135deg,#ECFDF3 0%,#F8FAFC 58%,#FFFFFF 100%)'
  if (upsidePct >= -0.10) return 'radial-gradient(circle at 82% 38%, rgba(37,99,235,0.08), transparent 32%), linear-gradient(135deg,#EFF6FF 0%,#F8FAFC 58%,#FFFFFF 100%)'
  return 'radial-gradient(circle at 82% 38%, rgba(220,38,38,0.08), transparent 32%), linear-gradient(135deg,#FEF2F2 0%,#F8FAFC 58%,#FFFFFF 100%)'
}

// ─── Confidence chip style ────────────────────────────────────────────────────

function confidenceStyle(confidence: 'High' | 'Medium' | 'Low'): { chip: string } {
  if (confidence === 'High') return { chip: 'bg-[#ECFDF3] text-[#047857] border-[#BBF7D0]' }
  if (confidence === 'Medium') return { chip: 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]' }
  return { chip: 'bg-slate-100 text-slate-500 border-slate-200' }
}

// ─── Description paragraph ────────────────────────────────────────────────────

function buildDescription(upsidePct: number | null, descVerb: string): string {
  if (upsidePct == null) return 'We do not have enough model data to form a conviction on this stock.'
  const absPct = Math.abs(upsidePct * 100).toFixed(0)
  if (upsidePct > 0.10) return `The stock is ${descVerb} with ${absPct}% upside to our fair value estimate.`
  if (upsidePct > 0.05) return `The stock is ${descVerb}. Our models suggest ${absPct}% potential upside.`
  if (upsidePct >= -0.10) return 'The stock appears fairly priced. The model finds limited upside or downside.'
  return `At current price, the stock trades ${absPct}% above our intrinsic estimate.`
}

// ─── Positive driver filter ───────────────────────────────────────────────────

const POSITIVE_RE = /strong|grow|profit|margin|cash\s*gen|moat|leader|dominan|innovat|compet.*advan|pric.*power|market.*share|expand|increas|high.*return|quality|best.in.class|track.record|breadth|diversif|solid|robust|effici|resilient|premium/i

// ─── Mini KPI card ────────────────────────────────────────────────────────────

interface KpiCardProps {
  icon: React.ReactNode
  label: string
  value: string
  valueClass?: string
}

function KpiCard({ icon, label, value, valueClass }: KpiCardProps) {
  return (
    <div className="bg-white/88 border border-[#E6ECF5] rounded-[12px] px-[14px] py-[12px] flex flex-col gap-1.5">
      <div className="flex items-center gap-1.5">
        {icon}
        <span className="text-[11px] font-[650] text-[#64748B] uppercase tracking-wide leading-none">{label}</span>
      </div>
      <span className={cn('text-[20px] font-[750] leading-tight tabular-nums', valueClass ?? 'text-[#0F172A]')}>
        {value}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SummaryHeroCard({
  ticker,
  price,
  currency,
  fairValue,
  upsidePct,
  confidence,
  scenarios,
  drivers,
}: SummaryHeroCardProps) {
  const verdict = deriveVerdict(upsidePct)
  const heroBg = deriveHeroBg(upsidePct)
  const description = buildDescription(upsidePct, verdict.descVerb)

  const ratio = fairValue != null && fairValue > 0 ? price / fairValue : null

  const badgeDrivers = drivers.filter(d => POSITIVE_RE.test(d)).slice(0, 4)

  // KPI values
  const upsideValue = upsidePct != null ? fmtPct(upsidePct) : '—'
  const upsideClass = upsidePct == null ? 'text-slate-400' : upsidePct >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'

  const fairValueDisplay = fairValue != null ? fmtPrice(fairValue, currency) : '—'

  const ratioDisplay = ratio != null ? `${ratio.toFixed(2)}×` : '—'
  const ratioClass = ratio == null ? 'text-slate-400' : ratio < 1 ? 'text-[#16A34A]' : ratio > 1 ? 'text-[#DC2626]' : 'text-[#2563EB]'

  return (
    <div
      className={cn('border rounded-[20px] p-6 overflow-hidden', verdict.borderClass)}
      style={{ background: heroBg }}
    >
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1.15fr)_minmax(240px,0.85fr)] gap-5">

        {/* ── Left column ── */}
        <div className="flex flex-col gap-3">

          {/* Headline */}
          <h1 className="text-[28px] font-[750] text-[#0F172A] leading-tight flex flex-wrap items-center gap-2">
            {ticker} looks{' '}
            <span className={verdict.wordClass}>{verdict.word}</span>
            {confidence && (
              <span className={cn('text-[12px] font-[650] px-[9px] py-[4px] rounded-full border', confidenceStyle(confidence).chip)}>
                {confidence} Confidence
              </span>
            )}
          </h1>

          {/* Description */}
          <p className="text-[15px] text-[#475569] leading-relaxed">
            {description}
          </p>

          {/* Value sentence */}
          <div className={cn(
            'rounded-[12px] border px-[14px] py-[10px] text-[15px] font-[750]',
            ratio != null && ratio < 1
              ? 'bg-[#ECFDF3]/85 border-[#BBF7D0] text-[#047857]'
              : ratio != null && ratio > 1
              ? 'bg-[#FEF2F2]/85 border-[#FECACA] text-[#DC2626]'
              : 'bg-slate-50 border-slate-200 text-slate-600',
          )}>
            {ratio != null
              ? `You're paying $${ratio.toFixed(2)} for every $1.00 of estimated value.`
              : 'Fair value estimate unavailable.'}
          </div>

          {/* 4 KPI chips */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2 mt-1">
            <KpiCard
              icon={
                <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', upsidePct == null ? 'bg-slate-50' : upsidePct >= 0 ? 'bg-emerald-50' : 'bg-red-50')}>
                  <TrendingUp size={14} className={upsidePct == null ? 'text-slate-400' : upsidePct >= 0 ? 'text-[#16A34A]' : 'text-[#DC2626]'} />
                </span>
              }
              label="Upside"
              value={upsideValue}
              valueClass={upsideClass}
            />
            <KpiCard
              icon={
                <span className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 bg-indigo-50">
                  <Target size={14} className="text-indigo-600" />
                </span>
              }
              label="Fair Value"
              value={fairValueDisplay}
              valueClass="text-[#0F172A]"
            />
            <KpiCard
              icon={
                <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', ratio == null ? 'bg-slate-50' : ratio < 1 ? 'bg-emerald-50' : ratio > 1 ? 'bg-red-50' : 'bg-blue-50')}>
                  <BarChart2 size={14} className={ratio == null ? 'text-slate-400' : ratio < 1 ? 'text-[#16A34A]' : ratio > 1 ? 'text-[#DC2626]' : 'text-[#2563EB]'} />
                </span>
              }
              label="Price/FV"
              value={ratioDisplay}
              valueClass={ratioClass}
            />
            <KpiCard
              icon={
                <span className={cn('w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0', upsidePct == null ? 'bg-slate-50' : upsidePct >= 0 ? 'bg-emerald-50' : 'bg-amber-50')}>
                  <ShieldCheck size={14} className={upsidePct == null ? 'text-slate-400' : upsidePct >= 0 ? 'text-[#16A34A]' : 'text-[#B45309]'} />
                </span>
              }
              label="Margin of Safety"
              value={upsideValue}
              valueClass={upsidePct == null ? 'text-slate-400' : upsidePct >= 0 ? 'text-[#16A34A]' : 'text-[#B45309]'}
            />
          </div>
        </div>

        {/* ── Right column ── */}
        <div className="flex flex-col gap-2">

          {/* Driver badges */}
          {badgeDrivers.length > 0 && (
            <div className="flex flex-col gap-1.5">
              <p className="text-[10px] font-[700] uppercase tracking-widest text-[#94A3B8] mb-0.5">Key Strengths</p>
              <div className="flex flex-wrap gap-1.5">
                {badgeDrivers.map((driver, i) => (
                  <span
                    key={i}
                    className="bg-white border border-[#E6ECF5] rounded-full px-[10px] py-[7px] text-[12px] font-[650] text-[#334155] flex items-center gap-1.5"
                  >
                    <Star size={12} className="text-[#16A34A] flex-shrink-0" />
                    {driver}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Scenario range */}
          {scenarios && (
            <div className="mt-auto pt-2">
              <p className="text-[10px] font-[700] uppercase tracking-widest text-[#94A3B8] mb-1.5">Scenario Range</p>
              <div className="flex items-center gap-2 text-[12px] font-[650]">
                <span className="text-[#DC2626]">{fmtPrice(scenarios.bear.fairValue, currency)}</span>
                <span className="text-[#94A3B8]">—</span>
                <span className="text-[#334155]">{fmtPrice(scenarios.base.fairValue, currency)}</span>
                <span className="text-[#94A3B8]">—</span>
                <span className="text-[#16A34A]">{fmtPrice(scenarios.bull.fairValue, currency)}</span>
              </div>
              <p className="text-[10px] text-[#94A3B8] mt-0.5">Bear · Base · Bull</p>
            </div>
          )}
        </div>

      </div>
    </div>
  )
}
