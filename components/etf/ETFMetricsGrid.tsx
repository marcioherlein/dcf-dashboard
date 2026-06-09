'use client'

import { useState } from 'react'
import { ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils'
import { fmtPctAbs } from '@/lib/formatters'
import { InfoTooltip } from '@/components/ui/info-tooltip'
import { scoreColor, scoreBarColor, explainScore } from '@/lib/data/etfScore'

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

function MetricRow({ label, value, color, tooltip }: { label: string; value: string; color?: string; tooltip?: string }) {
  return (
    <div className="flex items-center justify-between py-1.5 border-b border-[#E3E1DA] last:border-0">
      <div className="flex items-center gap-1">
        <span className="text-[12px] text-[#6B6B6B]">{label}</span>
        {tooltip && <InfoTooltip text={tooltip} side="top" />}
      </div>
      <span className={cn('text-[12px] font-semibold font-mono', color ?? 'text-[#06101F]')}>{value}</span>
    </div>
  )
}

function peColor(v: number | null): string {
  if (v == null) return ''
  if (v <= 15) return 'text-[#11875D]'
  if (v <= 22) return 'text-[#B56A00]'
  return 'text-[#D83B3B]'
}
function pbColor(v: number | null): string {
  if (v == null) return ''
  if (v <= 1.5) return 'text-[#11875D]'
  if (v <= 3) return 'text-[#B56A00]'
  return 'text-[#D83B3B]'
}

function ScoreGauge({ score, label }: { score: number; label: string }) {
  const barColor = scoreBarColor(score)
  const textColor = scoreColor(score)
  const badgeTextColor = score >= 30 && score < 50 ? 'text-[#713F12]' : 'text-white'

  return (
    <div className="flex flex-col items-center gap-2">
      <div className={cn('text-4xl font-bold font-sans', textColor)}>{score}</div>
      <div className={cn('text-xs font-semibold px-2 py-0.5 rounded-full', barColor, badgeTextColor)}>{label}</div>
      <div className="w-full h-3 bg-[#E3E1DA] rounded-md overflow-hidden mt-1">
        <div
          role="progressbar"
          aria-valuenow={score}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label="Value Score"
          className={cn('h-full rounded-md transition-all', barColor)}
          style={{ width: `${score}%` }}
        />
      </div>
    </div>
  )
}

// Score explanation table
const _FACTOR_BENCHMARKS = [
  { key: 'pe',           label: 'P/E ratio',       ideal: '≤ 15× ideal',  max: 30 },
  { key: 'pb',           label: 'P/B ratio',        ideal: '≤ 1.5× ideal', max: 25 },
  { key: 'yieldPts',     label: 'Dividend yield',   ideal: '≥ 4% ideal',   max: 25 },
  { key: 'expensePenalty', label: 'Expense ratio',  ideal: '≤ 0.05% ideal', max: 20, isPenalty: true },
] as const

function ScoreRationale({ metrics }: { metrics: ETFMetrics }) {
  const [open, setOpen] = useState(true)
  const bd = metrics.scoreBreakdown

  const rows: { label: string; thisETF: string; ideal: string; pts: number; max: number; isPenalty: boolean; barColor: string }[] = [
    {
      label: 'P/E ratio',
      thisETF: metrics.peRatio != null ? `${metrics.peRatio.toFixed(1)}×` : '—',
      ideal: '≤ 15× ideal',
      pts: bd.pe,
      max: 30,
      isPenalty: false,
      barColor: 'bg-[#2563EB]',
    },
    {
      label: 'P/B ratio',
      thisETF: metrics.pbRatio != null ? `${metrics.pbRatio.toFixed(1)}×` : '—',
      ideal: '≤ 1.5× ideal',
      pts: bd.pb,
      max: 25,
      isPenalty: false,
      barColor: 'bg-[#93C5FD]',
    },
    {
      label: 'Dividend yield',
      thisETF: metrics.yield != null ? fmtPctAbs(metrics.yield) : '—',
      ideal: '≥ 4% ideal',
      pts: bd.yieldPts,
      max: 25,
      isPenalty: false,
      barColor: 'bg-[#11875D]',
    },
    {
      label: 'Expense ratio',
      thisETF: metrics.expenseRatio != null ? `${(metrics.expenseRatio * 100).toFixed(2)}%` : '—',
      ideal: '≤ 0.05% ideal',
      pts: bd.expensePenalty,
      max: 20,
      isPenalty: true,
      barColor: 'bg-[#D83B3B]',
    },
  ]

  const narrative = explainScore(bd, metrics.valueScore, {
    peRatio: metrics.peRatio,
    pbRatio: metrics.pbRatio,
    yieldVal: metrics.yield,
    expenseRatio: metrics.expenseRatio,
  })

  const TIERS = [
    { range: '70–100', label: 'Deep Value', color: 'text-[#11875D]', bg: 'bg-[#E8F7EF]' },
    { range: '50–69',  label: 'Fair Value', color: 'text-[#2563EB]', bg: 'bg-[#EAF1FF]' },
    { range: '30–49',  label: 'Stretched',  color: 'text-[#B56A00]', bg: 'bg-[#FFF4DA]' },
    { range: '0–29',   label: 'Expensive',  color: 'text-[#D83B3B]', bg: 'bg-[#FCEAEA]' },
  ]

  return (
    <div className="glass-card-light rounded-xl overflow-hidden">
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-[#F5F5F5] transition-colors focus-visible:ring-2 focus-visible:ring-olive-700 focus-visible:ring-inset focus-visible:outline-none"
        aria-expanded={open}
      >
        <div className="flex items-center gap-3">
          <span className="text-[11px] font-[700] text-[#566174] uppercase tracking-wider">Score Rationale</span>
          <span className={cn('text-[11px] font-semibold px-2 py-0.5 rounded-full', scoreColor(metrics.valueScore))}>
            {metrics.valueScore} · {metrics.valueScoreLabel}
          </span>
        </div>
        {open ? <ChevronUp size={14} className="text-[#6B6B6B] shrink-0" /> : <ChevronDown size={14} className="text-[#6B6B6B] shrink-0" />}
      </button>

      {open && (
        <div className="px-4 pb-4 border-t border-[#E3E1DA]">
          {/* Narrative sentence */}
          <p className="text-[13px] text-[#06101F] leading-relaxed mt-3 mb-4">{narrative}</p>

          {/* Factor table */}
          <div className="rounded-lg overflow-x-auto border border-[#E3E1DA]">
            <table className="w-full text-xs">
              <thead>
                <tr className="bg-[#F5F5F5] border-b border-[#E3E1DA]">
                  <th className="text-left px-3 py-2 text-[10px] font-semibold text-[#6B6B6B] uppercase tracking-wide">Factor</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#6B6B6B] uppercase tracking-wide">This ETF</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#8A95A6] uppercase tracking-wide hidden sm:table-cell">Ideal range</th>
                  <th className="text-right px-3 py-2 text-[10px] font-semibold text-[#6B6B6B] uppercase tracking-wide w-28">Contribution</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E3E1DA]">
                {rows.map((row) => (
                  <tr key={row.label} className="bg-white">
                    <td className="px-3 py-2.5 text-[12px] text-[#06101F]">{row.label}</td>
                    <td className="px-3 py-2.5 text-right font-mono text-[12px] font-semibold text-[#06101F]">{row.thisETF}</td>
                    <td className="px-3 py-2.5 text-right text-[11px] text-[#8A95A6] hidden sm:table-cell">{row.ideal}</td>
                    <td className="px-3 py-2.5">
                      <div className="flex items-center justify-end gap-2">
                        <div className="w-14 h-1.5 bg-[#E3E1DA] rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', row.barColor)}
                            style={{ width: `${(row.pts / row.max) * 100}%` }}
                          />
                        </div>
                        <span className={cn('text-[11px] font-mono font-semibold w-10 text-right', row.isPenalty ? 'text-[#D83B3B]' : 'text-[#06101F]')}>
                          {row.isPenalty ? `−${row.pts}` : `${row.pts}/${row.max}`}
                        </span>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Tier legend */}
          <div className="mt-3 flex flex-wrap gap-2">
            {TIERS.map((t) => (
              <div key={t.label} className={cn('flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px]', t.bg)}>
                <span className={cn('font-bold tabular-nums', t.color)}>{t.range}</span>
                <span className={cn('font-semibold', t.color)}>{t.label}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}

export function ETFMetricsGrid({ metrics }: { metrics: ETFMetrics }) {
  const er = metrics.expenseRatio != null ? (metrics.expenseRatio * 100).toFixed(2) + '%' : '—'
  const yld = metrics.yield != null ? fmtPctAbs(metrics.yield) : '—'

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Basket Valuation */}
        <div className="glass-card-light rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-[11px] font-[600] text-[#566174]">Basket valuation</p>
            <InfoTooltip text="Weighted average ratios of the ETF's underlying holdings, not the ETF's own trading price." />
          </div>
          <MetricRow label="P/E ratio" value={fmt(metrics.peRatio)} color={peColor(metrics.peRatio)} tooltip="Price-to-Earnings: basket weighted average. Lower = more earnings per dollar paid." />
          <MetricRow label="P/B ratio" value={fmt(metrics.pbRatio)} color={pbColor(metrics.pbRatio)} tooltip="Price-to-Book: how much you pay vs. net assets. Below 1.5x is institutional value territory." />
          <MetricRow label="P/S ratio" value={fmt(metrics.psRatio)} tooltip="Price-to-Sales: basket price relative to revenue. Not included in the Value Score." />
          <MetricRow label="P/CF ratio" value={fmt(metrics.pcfRatio)} tooltip="Price-to-Cash Flow: price relative to operating cash generation. Not included in the Value Score." />
        </div>

        {/* Value Score */}
        <div className="glass-card-light rounded-xl p-4 sm:p-5">
          <div className="flex items-center gap-1.5 mb-3">
            <p className="text-[11px] font-[600] text-[#566174]">Value score</p>
            <InfoTooltip text="Score = P/E (30 pts) + P/B (25 pts) + Yield (25 pts) − Expense ratio penalty (20 pts). 70+ = Deep Value." />
          </div>
          <ScoreGauge score={metrics.valueScore} label={metrics.valueScoreLabel} />
          <div className="mt-3 space-y-1">
            <div className="flex justify-between text-xs text-[#6B6B6B]">
              <span>P/E contribution</span><span className="font-mono">{metrics.scoreBreakdown.pe}/30</span>
            </div>
            <div className="flex justify-between text-xs text-[#6B6B6B]">
              <span>P/B contribution</span><span className="font-mono">{metrics.scoreBreakdown.pb}/25</span>
            </div>
            <div className="flex justify-between text-xs text-[#6B6B6B]">
              <span>Yield contribution</span><span className="font-mono">{metrics.scoreBreakdown.yieldPts}/25</span>
            </div>
            <div className="flex justify-between text-xs text-[#6B6B6B]">
              <span>Expense penalty</span><span className="font-mono text-red-400">−{metrics.scoreBreakdown.expensePenalty}</span>
            </div>
          </div>
        </div>

        {/* Fund Profile */}
        <div className="glass-card-light rounded-xl p-4 sm:p-5">
          <p className="text-[11px] font-[600] text-[#566174] mb-3">Fund profile</p>
          <MetricRow label="Expense ratio" value={er} />
          <MetricRow label="Issuer" value={metrics.issuer ?? '—'} />
          <MetricRow label="Category" value={metrics.category ?? '—'} />
          <MetricRow label="Management" value={metrics.managementStyle ?? '—'} />
        </div>

        {/* Income */}
        <div className="glass-card-light rounded-xl p-4 sm:p-5">
          <p className="text-[11px] font-[600] text-[#566174] mb-3">Income</p>
          <MetricRow label="Trailing yield" value={yld} color={metrics.yield && metrics.yield > 0.02 ? 'text-[#11875D]' : 'text-[#06101F]'} />
          <MetricRow label="Annual dividend" value={metrics.dividendRate != null ? `$${metrics.dividendRate.toFixed(2)}` : '—'} />
        </div>
      </div>

      {/* Score Rationale panel */}
      <ScoreRationale metrics={metrics} />
    </div>
  )
}
