'use client'

import type { ValuationMethodConfig } from './ValuationModelDrawer'

interface ValuationMethodCardProps {
  config: ValuationMethodConfig
  isActive?: boolean
  onOpen: () => void
}

function trendIcon(upside: number | null): string {
  if (upside == null) return '—'
  if (upside >= 0.20) return '↑'
  if (upside >= 0)    return '→'
  return '↓'
}

function upsideColor(upside: number | null): string {
  if (upside == null) return 'text-[#666]'
  if (upside >= 0.20) return 'text-emerald-400'
  if (upside >= 0)    return 'text-amber-400'
  return 'text-red-400'
}

function fmtFairValue(v: number | null, currency: string): string {
  if (v == null) return '—'
  const prefix = currency === 'USD' ? '$' : (currency + ' ')
  if (v >= 1000) return prefix + v.toFixed(0)
  return prefix + v.toFixed(2)
}

const METHOD_BEST_FOR: Record<string, string> = {
  forward_pe:        'Profitable growth companies',
  revenue_multiple:  'Pre-profit or high-growth companies',
  dcf:               'Established companies with stable FCF',
  reverse_dcf:       'Understanding what the market is pricing in',
  scenario_blend:    'Probability-weighted fair value range',
}

const METHOD_ICON: Record<string, string> = {
  forward_pe:       'P/E',
  revenue_multiple: 'EV/R',
  dcf:              'DCF',
  reverse_dcf:      'Rev',
  scenario_blend:   'Scen',
}

export default function ValuationMethodCard({ config, isActive, onOpen }: ValuationMethodCardProps) {
  const fv      = config.fairValueSummary ?? null
  const price   = config.currentPrice ?? 0
  const upside  = fv != null && price > 0 ? (fv - price) / price : null
  const currency = config.currency ?? 'USD'

  return (
    <div
      className={`
        rounded-xl border p-4 cursor-pointer transition-all select-none
        ${isActive
          ? 'border-[#4a9eff] bg-[#0d1520]'
          : 'border-[#222] bg-[#0a0a0a] hover:border-[#333] hover:bg-[#111]'
        }
      `}
      onClick={onOpen}
    >
      <div className="flex items-start justify-between mb-3">
        <div className="text-[10px] font-bold text-[#4a9eff] bg-[#0d1520] border border-[#1e3050] px-2 py-0.5 rounded-md tracking-widest uppercase">
          {METHOD_ICON[config.id] ?? config.id}
        </div>
        {fv != null && (
          <span className={`text-[13px] font-bold ${upsideColor(upside)}`}>
            {trendIcon(upside)} {fmtFairValue(fv, currency)}
          </span>
        )}
      </div>

      <div className="text-[13px] font-semibold text-[#e2e2e2] mb-1">{config.title}</div>
      <div className="text-[11px] text-[#555] mb-3 leading-relaxed">
        {METHOD_BEST_FOR[config.id] ?? config.subtitle}
      </div>

      {upside != null && (
        <div className={`text-[11px] font-medium mb-3 ${upsideColor(upside)}`}>
          {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}% vs current price
        </div>
      )}

      <button
        onClick={e => { e.stopPropagation(); onOpen() }}
        className="w-full text-[11px] font-medium text-[#4a9eff] border border-[#1e3050] hover:bg-[#0d1520] rounded-lg py-1.5 transition-colors"
      >
        Open Model →
      </button>
    </div>
  )
}
