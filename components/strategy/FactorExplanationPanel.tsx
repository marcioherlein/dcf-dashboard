'use client'

import type { FactorExplanation, TradePlan } from '@/lib/strategy/types'

interface FactorExplanationPanelProps {
  explanation: FactorExplanation
  tradePlan: TradePlan
  peerGroupSize: number
}

export default function FactorExplanationPanel({
  explanation,
  tradePlan,
  peerGroupSize,
}: FactorExplanationPanelProps) {
  return (
    <div className="space-y-4">
      {/* Summary */}
      <div className="bg-primary/6 border border-primary/10 rounded-xl p-4">
        <p className="text-sm text-on-surface leading-relaxed">{explanation.summary}</p>
      </div>

      {/* Drivers (bullish) */}
      {explanation.drivers.length > 0 && (
        <div>
          <h4 className="text-[10px] font-extrabold text-secondary uppercase tracking-widest mb-2">
            Bullish Drivers
          </h4>
          <ul className="space-y-2">
            {explanation.drivers.map((d, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-secondary-container/60 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-secondary" />
                </span>
                <span className="text-xs text-on-surface leading-relaxed">{d}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Risks (bearish) */}
      {explanation.risks.length > 0 && (
        <div>
          <h4 className="text-[10px] font-extrabold text-error uppercase tracking-widest mb-2">
            Risks / Weaknesses
          </h4>
          <ul className="space-y-2">
            {explanation.risks.map((r, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-error-container/40 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-error" />
                </span>
                <span className="text-xs text-on-surface leading-relaxed">{r}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Watch List */}
      {explanation.watchList.length > 0 && (
        <div>
          <h4 className="text-[10px] font-extrabold text-on-tertiary-fixed-variant uppercase tracking-widest mb-2">
            Watch List
          </h4>
          <ul className="space-y-2">
            {explanation.watchList.map((w, i) => (
              <li key={i} className="flex items-start gap-2.5">
                <span className="w-4 h-4 rounded-full bg-tertiary-fixed/30 flex items-center justify-center shrink-0 mt-0.5">
                  <span className="w-1.5 h-1.5 rounded-full bg-tertiary-fixed-dim" />
                </span>
                <span className="text-xs text-on-surface leading-relaxed">{w}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Trade plan summary */}
      <div className="bg-surface-container-low rounded-xl p-4 space-y-2">
        <h4 className="text-[10px] font-extrabold text-on-surface-variant uppercase tracking-widest mb-3">Trade Plan Summary</h4>
        <div className="grid grid-cols-2 gap-x-4 gap-y-2">
          <div className="flex justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wide">Dominant Factor</span>
            <span className="text-xs font-bold text-on-surface">{tradePlan.dominantFactor}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wide">Time Horizon</span>
            <span className="text-xs font-bold text-on-surface">{tradePlan.timeHorizon}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wide">Expected Return</span>
            <span className={`text-xs font-bold ${tradePlan.expectedReturnPct >= 0 ? 'text-secondary' : 'text-error'}`}>
              {tradePlan.expectedReturnPct >= 0 ? '+' : ''}{tradePlan.expectedReturnPct.toFixed(1)}%
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wide">Peer Group</span>
            <span className="text-xs font-bold text-on-surface">{peerGroupSize} instruments</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wide">Stop (ATR ×)</span>
            <span className="text-xs font-bold text-on-surface">{tradePlan.exitLevels.stopLossAtrMultiple}×</span>
          </div>
          <div className="flex justify-between">
            <span className="text-[10px] text-on-surface-variant uppercase tracking-wide">R/R Ratio</span>
            <span className={`text-xs font-bold ${tradePlan.poorRiskReward ? 'text-error' : 'text-secondary'}`}>
              {tradePlan.riskRewardRatio.toFixed(2)}×{tradePlan.poorRiskReward ? ' (poor)' : ''}
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
