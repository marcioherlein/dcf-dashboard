'use client'

import type { ValuationMethodConfig } from './ValuationModelDrawer'
import { TrendBadge } from '@/components/ui/trend-badge'
import { fmtPrice } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { ChevronRight, Lock } from 'lucide-react'

const METHOD_BEST_FOR: Record<string, string> = {
  forward_pe:        'Profitable growth companies',
  revenue_multiple:  'Pre-profit or high-growth companies',
  dcf:               'Established companies with stable FCF',
  reverse_dcf:       'Understanding what the market prices in',
  scenario_blend:    'Probability-weighted fair value range',
  ev_ebitda:         'Asset-heavy or acquisitive businesses',
}

const METHOD_ABBR: Record<string, string> = {
  forward_pe:       'P/E',
  revenue_multiple: 'EV/R',
  dcf:              'DCF',
  reverse_dcf:      'Rev',
  scenario_blend:   'Blend',
  ev_ebitda:        'EV/EBITDA',
}

export default function ValuationMethodCard({
  config,
  isActive,
  onOpen,
}: {
  config: ValuationMethodConfig
  isActive?: boolean
  onOpen: () => void
}) {
  const fv       = config.fairValueSummary ?? null
  const price    = config.currentPrice ?? 0
  const upside   = fv != null && price > 0 ? (fv - price) / price : null
  const currency = config.currency ?? 'USD'
  const abbr     = METHOD_ABBR[config.id] ?? config.id.toUpperCase()
  const bestFor  = METHOD_BEST_FOR[config.id] ?? config.subtitle

  return (
    <div
      role="button"
      tabIndex={0}
      aria-expanded={isActive}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      className={cn(
        'rounded-xl border cursor-pointer transition-all select-none group glass-card',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        isActive
          ? 'border-blue-400/50 shadow-glow-sm'
          : 'border-[rgba(59,130,246,0.15)] hover:border-[rgba(59,130,246,0.4)] hover:shadow-glow-sm',
      )}
    >
      {/* Header strip */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 rounded-t-xl border-b',
        isActive ? 'bg-blue-500/15 border-blue-500/20' : 'bg-white/3 border-[rgba(59,130,246,0.08)]',
      )}>
        <span className={cn(
          'text-label uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border',
          isActive
            ? 'bg-blue-500/20 text-blue-300 border-blue-400/40'
            : 'bg-white/5 text-blue-400 border-blue-500/20',
        )}>
          {abbr}
        </span>
        {fv != null && (
          <span className="text-sm font-bold font-mono text-slate-100">
            {fmtPrice(fv, currency)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <div className="text-sm font-semibold text-slate-200">{config.title}</div>
        <div className="text-micro text-slate-500 leading-relaxed">{bestFor}</div>

        {upside != null ? (
          <TrendBadge value={upside} size="sm" />
        ) : (
          <span className="inline-flex items-center gap-1 text-micro text-slate-500">
            <Lock size={10} />
            No data available
          </span>
        )}
      </div>

      {/* Footer CTA */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 rounded-b-xl border-t text-xs font-medium transition-colors',
        isActive
          ? 'border-blue-500/20 bg-blue-500/10 text-blue-300'
          : 'border-[rgba(59,130,246,0.08)] bg-white/3 text-slate-500 group-hover:text-blue-400',
      )}>
        <span>{isActive ? 'Model open' : 'Open model'}</span>
        <ChevronRight size={14} className={cn('transition-transform', isActive && 'rotate-90')} />
      </div>
    </div>
  )
}
