'use client'

import type { StrategyReport } from '@/lib/strategy/types'

// ── Recommendation config ─────────────────────────────────────────────────────

const REC_CONFIG = {
  STRONG_BUY:      { label: 'Strong Buy',       bg: 'bg-secondary-container/50',    text: 'text-on-secondary-container',    border: 'border-secondary/20' },
  BUY:             { label: 'Buy',               bg: 'bg-primary-fixed/40',          text: 'text-on-primary-fixed-variant',  border: 'border-primary/20' },
  HOLD:            { label: 'Hold',              bg: 'bg-surface-container',         text: 'text-on-surface-variant',        border: 'border-outline-variant/20' },
  AVOID:           { label: 'Avoid',             bg: 'bg-error-container/40',        text: 'text-on-error-container',        border: 'border-error/20' },
  SHORT_CANDIDATE: { label: 'Short Candidate',   bg: 'bg-error/15',                  text: 'text-error',                     border: 'border-error/30' },
} as const

const CONVICTION_CONFIG = {
  HIGH:   { label: 'High Conviction',   bg: 'bg-secondary-container/30',  text: 'text-on-secondary-container' },
  MEDIUM: { label: 'Med. Conviction',   bg: 'bg-primary-fixed/30',        text: 'text-on-primary-fixed-variant' },
  LOW:    { label: 'Low Conviction',    bg: 'bg-surface-container-high',  text: 'text-on-surface-variant' },
} as const

// ── Score bar mini ────────────────────────────────────────────────────────────

function MiniFactorBar({ name, score }: { name: string; score: number }) {
  const color =
    score >= 70 ? 'bg-secondary' :
    score >= 50 ? 'bg-primary' :
    score >= 35 ? 'bg-tertiary-fixed-dim' :
    'bg-error'

  const abbrev = name === 'Term Structure' ? 'TS' : name.slice(0, 2).toUpperCase()

  return (
    <div className="flex flex-col items-center gap-1 min-w-0">
      <span className="text-[9px] font-bold text-on-surface-variant uppercase tracking-wider">{abbrev}</span>
      <div className="w-full bg-surface-container rounded-full h-1.5 overflow-hidden">
        <div className={`${color} h-full rounded-full transition-all`} style={{ width: `${score}%` }} />
      </div>
      <span className="text-[10px] font-bold text-on-surface">{Math.round(score)}</span>
    </div>
  )
}

// ── Price level display ───────────────────────────────────────────────────────

function PriceLevelRow({
  label,
  price,
  pct,
  currency,
  highlight,
  danger,
}: {
  label: string
  price: number
  pct: number
  currency: string
  highlight?: boolean
  danger?: boolean
}) {
  const sign = pct >= 0 ? '+' : ''
  const pctColor = danger ? 'text-error' : pct >= 0 ? 'text-secondary' : 'text-error'

  return (
    <div className={`flex items-center justify-between py-1.5 px-3 rounded-lg ${highlight ? 'bg-primary/8' : ''}`}>
      <span className="text-xs text-on-surface-variant font-medium w-16">{label}</span>
      <span className={`text-sm font-bold ${highlight ? 'text-primary' : 'text-on-surface'}`}>
        {currency} {price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
      </span>
      <span className={`text-xs font-bold w-16 text-right ${pctColor}`}>
        {sign}{pct.toFixed(1)}%
      </span>
    </div>
  )
}

// ── Main card ─────────────────────────────────────────────────────────────────

interface StrategyCardProps {
  report: StrategyReport
  onSelect?: () => void
  selected?: boolean
}

export default function StrategyCard({ report, onSelect, selected }: StrategyCardProps) {
  const { tradePlan, factorAlignment } = report
  const recCfg = REC_CONFIG[tradePlan.recommendation]
  const convCfg = CONVICTION_CONFIG[tradePlan.conviction]

  const currencySymbol = report.currency === 'USD' ? '$' : report.currency === 'ARS' ? '$' : report.currency

  return (
    <div
      onClick={onSelect}
      className={`
        bg-surface-container-lowest rounded-xl border transition-all cursor-pointer
        ${selected
          ? 'border-primary shadow-[0_4px_24px_rgba(0,27,68,0.12)]'
          : `${recCfg.border} hover:shadow-[0_2px_16px_rgba(0,27,68,0.08)] hover:border-primary/20`
        }
      `}
    >
      {/* Header */}
      <div className="p-4 pb-3">
        <div className="flex items-start justify-between gap-2 mb-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-extrabold uppercase tracking-wide ${recCfg.bg} ${recCfg.text}`}>
              {recCfg.label}
            </span>
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wide ${convCfg.bg} ${convCfg.text}`}>
              {convCfg.label}
            </span>
          </div>
          <div className="text-right shrink-0">
            <div className="text-xl font-extrabold text-primary leading-none">{report.finalScore.toFixed(1)}</div>
            <div className="text-[9px] text-on-surface-variant font-semibold uppercase">score</div>
          </div>
        </div>

        {/* Ticker + name */}
        <div>
          <div className="flex items-center gap-2">
            <span className="font-extrabold text-base text-primary">{report.displayTicker}</span>
            {report.isCedear && (
              <span className="px-1.5 py-0.5 bg-tertiary-fixed/30 text-on-tertiary-fixed-variant text-[9px] font-bold rounded uppercase">CEDEAR</span>
            )}
            <span className="text-xs text-on-surface-variant">
              #{report.marketRank} {report.market}
            </span>
          </div>
          <p className="text-xs text-on-surface-variant mt-0.5 truncate">{report.name}</p>
          {report.sector && (
            <p className="text-[10px] text-on-surface-variant/70 mt-0.5">{report.sector}</p>
          )}
        </div>
      </div>

      {/* Current price */}
      <div className="px-4 pb-2">
        <div className="flex items-baseline gap-2">
          <span className="text-2xl font-extrabold text-on-surface">
            {currencySymbol}{report.price.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
          </span>
          <span className={`text-sm font-bold ${report.change1DPct >= 0 ? 'text-secondary' : 'text-error'}`}>
            {report.change1DPct >= 0 ? '+' : ''}{report.change1DPct.toFixed(2)}%
          </span>
        </div>
      </div>

      {/* Entry / Target / Stop */}
      <div className="px-4 pb-3 space-y-0.5">
        <PriceLevelRow
          label="Entry"
          price={tradePlan.entryZone.immediate.price}
          pct={0}
          currency={currencySymbol}
          highlight
        />
        {tradePlan.entryZone.waitForPullback && tradePlan.entryZone.better && (
          <div className="px-3 py-1">
            <p className="text-[10px] text-tertiary-fixed-dim font-semibold">
              ⚠ Better entry: {currencySymbol}{tradePlan.entryZone.better.price.toLocaleString(undefined, { minimumFractionDigits: 2 })} ({tradePlan.entryZone.better.pctFromCurrent.toFixed(1)}%)
            </p>
          </div>
        )}
        <PriceLevelRow
          label="Target"
          price={tradePlan.exitLevels.primaryTarget.price}
          pct={tradePlan.exitLevels.primaryTarget.pctFromCurrent}
          currency={currencySymbol}
        />
        <PriceLevelRow
          label="Stop"
          price={tradePlan.exitLevels.stopLoss.price}
          pct={tradePlan.exitLevels.stopLoss.pctFromCurrent}
          currency={currencySymbol}
          danger
        />
      </div>

      {/* R/R + Horizon */}
      <div className="px-4 pb-3 flex items-center gap-3">
        <div className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg ${tradePlan.poorRiskReward ? 'bg-error-container/30' : 'bg-secondary-container/20'}`}>
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">R/R</span>
          <span className={`text-sm font-extrabold ${tradePlan.poorRiskReward ? 'text-on-error-container' : 'text-secondary'}`}>
            {tradePlan.riskRewardRatio.toFixed(1)}×
          </span>
          {tradePlan.poorRiskReward && (
            <span className="text-[9px] text-on-error-container font-bold">Poor</span>
          )}
        </div>
        <div className="flex items-center gap-1.5 px-2.5 py-1.5 bg-surface-container rounded-lg">
          <span className="text-[10px] font-bold text-on-surface-variant uppercase">Horizon</span>
          <span className="text-xs font-bold text-on-surface">{tradePlan.timeHorizon}</span>
        </div>
      </div>

      {/* Factor alignment mini-bars */}
      {factorAlignment.length > 0 && (
        <div className={`px-4 pb-4 grid gap-2`} style={{ gridTemplateColumns: `repeat(${factorAlignment.length}, 1fr)` }}>
          {factorAlignment.map((f) => (
            <MiniFactorBar key={f.name} name={f.name} score={f.score} />
          ))}
        </div>
      )}
    </div>
  )
}
