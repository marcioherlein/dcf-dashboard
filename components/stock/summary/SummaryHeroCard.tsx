'use client'

import { cn } from '@/lib/utils'
import { fmtPrice, fmtPct } from '@/lib/formatters'
import ScenarioRangeBar from '@/components/ui/ScenarioRangeBar'
import { deriveVerdict, buildVerdictDescription } from '@/lib/stock/verdict'

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

// ─── Confidence chip ──────────────────────────────────────────────────────────

function confidenceChip(confidence: 'High' | 'Medium' | 'Low'): string {
  if (confidence === 'High')   return 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]'
  if (confidence === 'Medium') return 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]'
  return 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
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
  const verdict     = deriveVerdict(upsidePct, fairValue)
  const description = buildVerdictDescription(upsidePct, verdict.descVerb)
  const ratio       = fairValue != null && fairValue > 0 ? price / fairValue : null

  const badgeDrivers = drivers
    .filter(d => POSITIVE_RE.test(d))
    .slice(0, 5)
    .map(distillDriver)

  const upsideDisplay = upsidePct != null ? fmtPct(upsidePct) : '—'

  return (
    <div
      className={cn('border rounded-2xl p-6 overflow-hidden', verdict.borderClass)}
      style={{ background: verdict.bgStyle }}
    >
      <div className="flex flex-col gap-4">

        {/* ── Headline block ── */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[26px] sm:text-[30px] font-[800] text-ink-900 leading-tight tracking-tight [text-wrap:balance]">
            {ticker} looks{' '}
            <span className={verdict.headingClass}>{verdict.word}</span>
          </p>
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
        <p className="text-[14px] text-[#6B6B6B] leading-relaxed">
          {description}
        </p>

        {/* ── Primary metrics ── */}
        <div className="flex flex-wrap items-end gap-5">
          <div>
            <p className="text-[11px] text-[#6B6B6B] mb-0.5">Fair value</p>
            <p className="text-[26px] font-[750] text-ink-900 tabular-nums leading-none">
              {fairValue != null ? fmtPrice(fairValue, currency) : '—'}
            </p>
          </div>
          <div className="w-px h-7 bg-[#E5E5E5] self-end mb-0.5 shrink-0" />
          <div>
            <p className="text-[11px] text-[#6B6B6B] mb-0.5">vs current price</p>
            <p className={cn('text-[26px] font-[750] leading-none tabular-nums', verdict.upsideClass)}>
              {upsideDisplay}
            </p>
          </div>
        </div>
        {ratio != null && (
          <p className="text-[12px] text-[#6B6B6B]">
            You pay{' '}
            <span className={cn('font-[700]', ratio < 1 ? 'text-[#11875D]' : 'text-[#D83B3B]')}>
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
            label="Scenario range"
          />
        )}

        {/* ── Key strengths ── */}
        {badgeDrivers.length > 0 && (
          <div>
            <p className="text-[11px] text-[#6B6B6B] mb-2">Key strengths</p>
            <div className="flex flex-wrap gap-1.5">
              {badgeDrivers.map((label, i) => (
                <span
                  key={i}
                  title={drivers.filter(d => POSITIVE_RE.test(d))[i]}
                  className="text-[12px] font-[600] text-ink-900 bg-white border border-[#E5E5E5] rounded-full px-3 py-1 leading-tight"
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
