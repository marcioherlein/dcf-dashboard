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
  analystTargetMean?: number | null
  analystTargetLow?: number | null
  analystTargetHigh?: number | null
  numAnalysts?: number | null
  analystRecommendation?: string | null
}

// ─── Confidence chip ──────────────────────────────────────────────────────────

function _confidenceChip(confidence: 'High' | 'Medium' | 'Low'): string {
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
  analystTargetMean,
  analystTargetLow,
  analystTargetHigh,
  numAnalysts,
  analystRecommendation,
}: SummaryHeroCardProps) {
  const verdict     = deriveVerdict(upsidePct, fairValue)
  const description = buildVerdictDescription(upsidePct, verdict.descVerb)
  const ratio       = fairValue != null && fairValue > 0 ? price / fairValue : null

  const hasTarget = analystTargetMean != null && analystTargetLow != null && analystTargetHigh != null && price > 0
  const targetUpside = hasTarget ? (analystTargetMean! - price) / price : null
  const sym = currency === 'USD' ? '$' : currency + ' '

  const badgeDrivers = drivers
    .filter(d => typeof d === 'string' && POSITIVE_RE.test(d))
    .slice(0, 5)
    .map(distillDriver)

  const upsideDisplay = upsidePct != null ? fmtPct(upsidePct) : '—'

  return (
    <div
      className="rounded-xl overflow-hidden relative"
      style={{
        background: 'linear-gradient(160deg, #1e293b 0%, #334155 55%, #475569 100%)',
        boxShadow: '0 4px 20px rgba(0,0,0,0.16)',
      }}
    >
      {/* Olive ambient glow */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage: 'radial-gradient(ellipse 55% 70% at 95% -5%, rgba(95,121,11,0.15) 0%, transparent 55%)',
        }}
      />
      <div className="relative flex flex-col gap-4 p-4 sm:p-5">

        {/* ── Headline block ── */}
        <div className="flex flex-col gap-1.5">
          <p className="text-[32px] sm:text-[30px] font-[800] text-white leading-tight tracking-tight [text-wrap:balance] break-words">
            {ticker.length > 8 ? ticker.slice(0, 8) + '…' : ticker} looks{' '}
            <span className={cn(
              verdict.word === 'Attractive' || verdict.word === 'Undervalued' ? 'text-[#7CB518]' :
              verdict.word === 'Expensive' || verdict.word === 'Overvalued' ? 'text-[#F87171]' :
              verdict.word === 'Fairly Priced' || verdict.word === 'Fair' ? 'text-[#60A5FA]' :
              'text-white/60'
            )}>{verdict.word}</span>
          </p>
          {confidence && (
            <span className={cn(
              'self-start text-[12px] font-[600] px-[10px] py-[4px] rounded-full border',
              confidence === 'High'   ? 'bg-white/10 border-white/20 text-[#4ADE80]' :
              confidence === 'Medium' ? 'bg-white/10 border-white/20 text-[#FCD34D]' :
                                        'bg-white/10 border-white/20 text-[#F87171]'
            )}>
              {confidence} Confidence · {modelCount}/{totalModels} models
            </span>
          )}
        </div>

        {/* ── Description ── */}
        <p className="text-[14px] text-white/60 leading-relaxed">
          {description}
        </p>

        {/* ── Primary metrics ── */}
        <div className="flex flex-wrap items-end gap-5 sm:gap-5">
          <div>
            <p className="text-[11px] font-[600] text-white/45 mb-0.5">Fair value</p>
            <p className="text-[36px] sm:text-[26px] font-[750] text-white tabular-nums leading-none">
              {fairValue != null ? fmtPrice(fairValue, currency) : '—'}
            </p>
          </div>
          <div className="w-px h-7 bg-white/15 self-end mb-0.5 shrink-0" />
          <div>
            <p className="text-[11px] font-[600] text-white/45 mb-0.5">vs current price</p>
            <p className={cn('text-[36px] sm:text-[26px] font-[750] leading-none tabular-nums',
              upsidePct == null ? 'text-white/50' :
              upsidePct >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'
            )}>
              {upsideDisplay}
            </p>
          </div>
        </div>
        {ratio != null && (
          <p className="text-[12px] text-white/50">
            You pay{' '}
            <span className={cn('font-[700]', ratio < 1 ? 'text-[#4ADE80]' : 'text-[#F87171]')}>
              ${ratio.toFixed(2)}
            </span>
            {' '}per $1 of estimated value
          </p>
        )}

        {/* ── Analyst price target — embedded slider ── */}
        {hasTarget && (
          <div className="rounded-xl bg-white/8 border border-white/12 p-3">
            <div className="flex items-center justify-between mb-2">
              <div>
                <p className="text-[12px] font-[700] text-white/80">Analyst Price Target</p>
                {numAnalysts != null && numAnalysts > 0 && (
                  <p className="text-[10px] text-white/40">{numAnalysts} analyst{numAnalysts !== 1 ? 's' : ''}</p>
                )}
              </div>
              <div className="text-right">
                <p className={`text-[15px] font-[750] tabular-nums ${targetUpside != null && targetUpside >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                  {sym}{analystTargetMean!.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
                {targetUpside != null && (
                  <p className={`text-[10px] font-[650] ${targetUpside >= 0 ? 'text-[#4ADE80]' : 'text-[#F87171]'}`}>
                    {targetUpside >= 0 ? '+' : ''}{(targetUpside * 100).toFixed(1)}%
                  </p>
                )}
              </div>
            </div>
            {/* Slider track */}
            {(() => {
              const range = analystTargetHigh! - analystTargetLow!
              const safe = range > 0 ? range : 1
              const curPct  = Math.max(0, Math.min(100, ((price - analystTargetLow!) / safe) * 100))
              const meanPct = Math.max(0, Math.min(100, ((analystTargetMean! - analystTargetLow!) / safe) * 100))
              const isUp = analystTargetMean! > price
              return (
                <>
                  <div className="relative h-2 rounded-full bg-white/15 mx-1 mb-2">
                    {isUp ? (
                      <div className="absolute top-0 bottom-0 rounded-full bg-[#4ADE80]/70"
                        style={{ left: `${curPct}%`, width: `${meanPct - curPct}%` }} />
                    ) : (
                      <div className="absolute top-0 bottom-0 rounded-full bg-[#F87171]/70"
                        style={{ left: `${meanPct}%`, width: `${curPct - meanPct}%` }} />
                    )}
                    <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full bg-white border border-white/30 shadow-sm z-10"
                      style={{ left: `${curPct}%` }} />
                    <div className={`absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-3.5 h-3.5 rounded-full border border-white/30 shadow-sm z-10 ${isUp ? 'bg-[#4ADE80]' : 'bg-[#F87171]'}`}
                      style={{ left: `${meanPct}%` }} />
                  </div>
                  <div className="flex justify-between mx-1 text-[10px] text-white/40">
                    <span className="tabular-nums">{sym}{analystTargetLow!.toFixed(0)} Low</span>
                    <span className="tabular-nums">High {sym}{analystTargetHigh!.toFixed(0)}</span>
                  </div>
                </>
              )
            })()}
          </div>
        )}

        {/* ── Analyst recommendation (when no target data, show inline) ── */}
        {!hasTarget && analystRecommendation && analystRecommendation.trim().length > 0 && (() => {
          const r = analystRecommendation.toLowerCase()
          const recLabel = r.includes('strong_buy') || r.includes('strong buy') ? 'Strong Buy'
            : r.includes('buy') ? 'Buy'
            : r.includes('hold') || r.includes('neutral') ? 'Hold'
            : r.includes('sell') ? 'Sell'
            : analystRecommendation
          const recColor = recLabel === 'Strong Buy' || recLabel === 'Buy' ? 'text-[#4ADE80]'
            : recLabel === 'Hold' ? 'text-[#FCD34D]'
            : 'text-[#F87171]'
          return (
            <span className="text-[11px] text-white/40">
              Analysts: <span className={cn('font-[700]', recColor)}>{recLabel}</span>
            </span>
          )
        })()}

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
            <p className="text-[11px] font-[600] text-white/40 mb-2">Key strengths</p>
            <div className="flex flex-wrap gap-1.5">
              {badgeDrivers.map((label, i) => (
                <span
                  key={i}
                  title={drivers.filter(d => POSITIVE_RE.test(d))[i]}
                  className="text-[12px] font-[600] text-white/80 bg-white/8 border border-white/15 rounded-full px-3 py-1 leading-tight max-w-[200px] truncate"
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
