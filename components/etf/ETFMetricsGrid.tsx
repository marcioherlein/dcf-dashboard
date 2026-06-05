'use client'

import { cn } from '@/lib/utils'
import { fmtPctAbs } from '@/lib/formatters'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { scoreColor, scoreBarColor } from '@/lib/data/etfScore'

interface ETFMetrics {
  peRatio: number | null
  pbRatio: number | null
  psRatio: number | null
  pcfRatio: number | null
  valueScore: number
  valueScoreLabel: string
  scoreBreakdown: { pe: number; pb: number; yieldPts: number; expensePenalty: number }
  expenseRatio: number | null
  issuer: string | null
  category: string | null
  managementStyle: string | null
  yield: number | null
  dividendRate: number | null
}

function fmt(v: number | null, decimals = 1): string {
  if (v == null) return '—'
  return v.toFixed(decimals) + 'x'
}

function MetricRow({ label, value, color }: { label: string; value: string; color?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-slate-100 last:border-0">
      <span className="text-[12px] text-slate-500">{label}</span>
      <span className={cn('text-[12px] font-semibold font-mono', color ?? 'text-slate-800')}>{value}</span>
    </div>
  )
}

function peColor(v: number | null): string {
  if (v == null) return ''
  if (v <= 15) return 'text-emerald-600'
  if (v <= 22) return 'text-amber-600'
  return 'text-red-500'
}
function pbColor(v: number | null): string {
  if (v == null) return ''
  if (v <= 1.5) return 'text-emerald-600'
  if (v <= 3) return 'text-amber-600'
  return 'text-red-500'
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const barColor = scoreBarColor(score)
  const textColor = scoreColor(score)
  const badgeTextColor = score >= 30 && score < 50 ? 'text-amber-900' : 'text-white'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('text-4xl font-black font-mono', textColor)}>{score}</div>
      <div className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', barColor, badgeTextColor)}>{label}</div>
      <div className="w-full h-2 bg-slate-100 rounded-full overflow-hidden mt-1">
        <div
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Value Score"
          className={cn('h-full rounded-full transition-all', barColor)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

export function ETFMetricsGrid({ metrics }: { metrics: ETFMetrics }) {
  const er = metrics.expenseRatio != null ? (metrics.expenseRatio * 100).toFixed(2) + '%' : '—'
  const yld = metrics.yield != null ? fmtPctAbs(metrics.yield) : '—'

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      {/* Basket Valuation */}
      <div className="glass-card-light rounded-xl p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-sm font-semibold text-slate-600">Basket valuation</p>
          <InfoTooltip text="Weighted average ratios of the ETF's underlying holdings, not the ETF's own trading price." />
        </div>
        <MetricRow label="P/E ratio" value={fmt(metrics.peRatio)} color={peColor(metrics.peRatio)} />
        <MetricRow label="P/B ratio" value={fmt(metrics.pbRatio)} color={pbColor(metrics.pbRatio)} />
        <MetricRow label="P/S ratio" value={fmt(metrics.psRatio)} />
        <MetricRow label="P/CF ratio" value={fmt(metrics.pcfRatio)} />
      </div>

      {/* Value Score */}
      <div className="glass-card-light rounded-xl p-4">
        <div className="flex items-center gap-1.5 mb-3">
          <p className="text-sm font-semibold text-slate-600">Value score</p>
          <InfoTooltip text="Score = P/E (30 pts) + P/B (25 pts) + Yield (25 pts) − Expense ratio penalty (20 pts). 70+ = Deep Value." />
        </div>
        <ScoreGauge score={metrics.valueScore} label={metrics.valueScoreLabel} />
        <div className="mt-3 space-y-1">
          <div className="flex justify-between text-xs text-slate-500">
            <span>P/E contribution</span><span className="font-mono">{metrics.scoreBreakdown.pe}/30</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>P/B contribution</span><span className="font-mono">{metrics.scoreBreakdown.pb}/25</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Yield contribution</span><span className="font-mono">{metrics.scoreBreakdown.yieldPts}/25</span>
          </div>
          <div className="flex justify-between text-xs text-slate-500">
            <span>Expense penalty</span><span className="font-mono text-red-400">−{metrics.scoreBreakdown.expensePenalty}</span>
          </div>
        </div>
      </div>

      {/* Fund Profile */}
      <div className="glass-card-light rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-600 mb-3">Fund profile</p>
        <MetricRow label="Expense ratio" value={er} />
        <MetricRow label="Issuer" value={metrics.issuer ?? '—'} />
        <MetricRow label="Category" value={metrics.category ?? '—'} />
        <MetricRow label="Management" value={metrics.managementStyle ?? '—'} />
      </div>

      {/* Income */}
      <div className="glass-card-light rounded-xl p-4">
        <p className="text-sm font-semibold text-slate-600 mb-3">Income</p>
        <MetricRow label="Trailing yield" value={yld} color={metrics.yield && metrics.yield > 0.02 ? 'text-emerald-600' : 'text-slate-800'} />
        <MetricRow label="Annual dividend" value={metrics.dividendRate != null ? `$${metrics.dividendRate.toFixed(2)}` : '—'} />
      </div>
    </div>
  )
}
