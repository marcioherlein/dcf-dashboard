'use client'

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

// ─── Verdict config ───────────────────────────────────────────────────────────

interface VerdictConfig {
  word: string
  wordClass: string
  descVerb: string
  bgStyle: string
  borderClass: string
  upsideClass: string
}

function deriveVerdict(upsidePct: number | null): VerdictConfig {
  if (upsidePct == null) return {
    word: 'Uncertain',
    wordClass: 'text-slate-500',
    descVerb: 'insufficient data for a conviction',
    bgStyle: '#F8FAFC',
    borderClass: 'border-[#E6ECF5]',
    upsideClass: 'text-slate-400',
  }
  if (upsidePct > 0.25) return {
    word: 'Attractive',
    wordClass: 'text-[#16A34A]',
    descVerb: 'meaningfully undervalued',
    bgStyle: '#F0FDF4',
    borderClass: 'border-[#BBF7D0]',
    upsideClass: 'text-[#16A34A]',
  }
  if (upsidePct > 0.05) return {
    word: 'Undervalued',
    wordClass: 'text-[#16A34A]',
    descVerb: 'modestly undervalued',
    bgStyle: '#F0FDF4',
    borderClass: 'border-[#BBF7D0]',
    upsideClass: 'text-[#16A34A]',
  }
  if (upsidePct >= -0.10) return {
    word: 'Fairly Valued',
    wordClass: 'text-[#2563EB]',
    descVerb: 'near fair value',
    bgStyle: '#EFF6FF',
    borderClass: 'border-[#BFDBFE]',
    upsideClass: 'text-[#2563EB]',
  }
  if (upsidePct >= -0.25) return {
    word: 'Overvalued',
    wordClass: 'text-[#DC2626]',
    descVerb: 'overvalued',
    bgStyle: '#FEF2F2',
    borderClass: 'border-[#FECACA]',
    upsideClass: 'text-[#DC2626]',
  }
  return {
    word: 'Expensive',
    wordClass: 'text-[#DC2626]',
    descVerb: 'significantly overvalued',
    bgStyle: '#FEF2F2',
    borderClass: 'border-[#FECACA]',
    upsideClass: 'text-[#DC2626]',
  }
}

function confidenceChip(confidence: 'High' | 'Medium' | 'Low'): string {
  if (confidence === 'High')   return 'bg-[#ECFDF3] text-[#047857] border-[#BBF7D0]'
  if (confidence === 'Medium') return 'bg-[#FFFBEB] text-[#92400E] border-[#FDE68A]'
  return 'bg-slate-100 text-slate-500 border-slate-200'
}

function buildDescription(upsidePct: number | null, descVerb: string): string {
  if (upsidePct == null) return 'Not enough model data to form a conviction on this stock.'
  const absPct = Math.abs(upsidePct * 100).toFixed(0)
  if (upsidePct > 0.10)  return `The stock is ${descVerb} with ${absPct}% upside to our fair value estimate.`
  if (upsidePct > 0.05)  return `The stock is ${descVerb}. Our models suggest ${absPct}% potential upside.`
  if (upsidePct >= -0.10) return 'The stock appears fairly priced — limited upside or downside from current levels.'
  return `At current price, the stock trades ${absPct}% above our intrinsic value estimate.`
}

// ─── Driver distillation ──────────────────────────────────────────────────────

const POSITIVE_RE = /strong|grow|profit|margin|cash\s*gen|moat|leader|dominan|innovat|compet.*advan|pric.*power|market.*share|expand|increas|high.*return|quality|best.in.class|track.record|breadth|diversif|solid|robust|effici|resilient|premium/i

function distillDriver(full: string): string {
  const clause = full.split(/\s+[—–;]\s+/)[0].trim()
  const core = clause.split('(')[0].trim()
  if (core.length <= 35) return core
  const words = core.split(' ')
  let out = ''
  for (const w of words) {
    if (out.length + (out ? 1 : 0) + w.length > 35) break
    out += (out ? ' ' : '') + w
  }
  return out + '…'
}

// ─── Scenario range bar ───────────────────────────────────────────────────────

function ScenarioRangeBar({
  bear, base, bull, currentPrice, currency,
}: {
  bear: number; base: number; bull: number; currentPrice: number; currency: string
}) {
  const minV = Math.min(bear, currentPrice) * 0.96
  const maxV = Math.max(bull, currentPrice) * 1.04
  const span = maxV - minV

  const pct = (v: number) => Math.max(1, Math.min(99, ((v - minV) / span) * 100))

  const bearP  = pct(bear)
  const baseP  = pct(base)
  const bullP  = pct(bull)
  const priceP = pct(currentPrice)

  return (
    <div>
      <p className="text-[11px] text-[#64748B] mb-2.5">Scenario range</p>

      {/* Bar */}
      <div className="relative h-2 rounded-full bg-slate-200 mb-3">
        {/* Filled range between bear and bull */}
        <div
          className="absolute h-full rounded-full bg-slate-300"
          style={{ left: `${bearP}%`, right: `${100 - bullP}%` }}
        />
        {/* Bear dot */}
        <div
          className="absolute w-3 h-3 rounded-full bg-red-400 border-2 border-white shadow-sm"
          style={{ left: `${bearP}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
        />
        {/* Base dot */}
        <div
          className="absolute w-3 h-3 rounded-full bg-blue-500 border-2 border-white shadow-sm"
          style={{ left: `${baseP}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
        />
        {/* Bull dot */}
        <div
          className="absolute w-3 h-3 rounded-full bg-emerald-400 border-2 border-white shadow-sm"
          style={{ left: `${bullP}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
        />
        {/* Current price tick */}
        <div
          className="absolute w-0.5 h-4 bg-slate-500 rounded-full"
          style={{ left: `${priceP}%`, top: '50%', transform: 'translate(-50%, -50%)' }}
        />
      </div>

      {/* Values */}
      <div className="grid grid-cols-3 text-[11px] tabular-nums">
        <span className="text-red-600 font-[650]">{fmtPrice(bear, currency)}</span>
        <span className="text-blue-600 font-[650] text-center">{fmtPrice(base, currency)}</span>
        <span className="text-emerald-600 font-[650] text-right">{fmtPrice(bull, currency)}</span>
      </div>
      <div className="grid grid-cols-3 text-[10px] text-slate-400 mt-0.5">
        <span>Bear</span>
        <span className="text-center">Base</span>
        <span className="text-right">Bull</span>
      </div>
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
  modelCount,
  totalModels,
  scenarios,
  drivers,
}: SummaryHeroCardProps) {
  const verdict     = deriveVerdict(upsidePct)
  const description = buildDescription(upsidePct, verdict.descVerb)
  const ratio       = fairValue != null && fairValue > 0 ? price / fairValue : null

  const badgeDrivers = drivers
    .filter(d => POSITIVE_RE.test(d))
    .slice(0, 5)
    .map(distillDriver)

  const upsideDisplay = upsidePct != null ? fmtPct(upsidePct) : '—'

  return (
    <div
      className={cn('border rounded-[20px] p-6 overflow-hidden', verdict.borderClass)}
      style={{ background: verdict.bgStyle }}
    >
      <div className="flex flex-col gap-4">

        {/* ── Headline block ── */}
        <div className="flex flex-col gap-1.5">
          <h1 className="text-[26px] sm:text-[30px] font-[800] text-[#0F172A] leading-tight tracking-tight [text-wrap:balance]">
            {ticker} looks{' '}
            <span className={verdict.wordClass}>{verdict.word}</span>
          </h1>
          {confidence && (
            <span className={cn(
              'self-start text-[12px] font-[650] px-[10px] py-[4px] rounded-full border',
              confidenceChip(confidence),
            )}>
              {confidence} Confidence · {modelCount}/{totalModels} models
            </span>
          )}
        </div>

        {/* ── Description ── */}
        <p className="text-[14px] text-[#475569] leading-relaxed">
          {description}
        </p>

        {/* ── Primary metrics ── */}
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <p className="text-[11px] text-[#64748B] mb-0.5">Fair value</p>
            <p className="text-[26px] font-[750] text-[#0F172A] tabular-nums leading-none">
              {fairValue != null ? fmtPrice(fairValue, currency) : '—'}
            </p>
          </div>
          <div className="w-px h-7 bg-slate-200 self-end mb-0.5 shrink-0" />
          <div>
            <p className="text-[11px] text-[#64748B] mb-0.5">vs current price</p>
            <p className={cn('text-[26px] font-[750] leading-none tabular-nums', verdict.upsideClass)}>
              {upsideDisplay}
            </p>
          </div>
        </div>
        {ratio != null && (
          <p className="text-[12px] text-[#64748B]">
            You pay{' '}
            <span className={cn('font-[700]', ratio < 1 ? 'text-[#16A34A]' : 'text-[#DC2626]')}>
              ${ratio.toFixed(2)}
            </span>
            {' '}per $1 of estimated value
          </p>
        )}

        {/* ── Scenario range bar ── */}
        {scenarios && (
          <ScenarioRangeBar
            bear={scenarios.bear.fairValue}
            base={scenarios.base.fairValue}
            bull={scenarios.bull.fairValue}
            currentPrice={price}
            currency={currency}
          />
        )}

        {/* ── Key strengths ── */}
        {badgeDrivers.length > 0 && (
          <div>
            <p className="text-[11px] text-[#64748B] mb-2">Key strengths</p>
            <div className="flex flex-wrap gap-1.5">
              {badgeDrivers.map((label, i) => (
                <span
                  key={i}
                  title={drivers.filter(d => POSITIVE_RE.test(d))[i]}
                  className="text-[12px] font-[600] text-[#334155] bg-white border border-[#E6ECF5] rounded-full px-3 py-1 leading-tight"
                >
                  {label}
                </span>
              ))}
            </div>
          </div>
        )}

      </div>
    </div>
  )
}
