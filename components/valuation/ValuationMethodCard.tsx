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
        'rounded-xl border bg-white cursor-pointer transition-all select-none group',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
        isActive
          ? 'border-blue-300 shadow-card-md ring-2 ring-blue-100'
          : 'border-slate-200 shadow-card hover:border-blue-200 hover:shadow-card-md',
      )}
    >
      {/* Header strip */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 rounded-t-xl border-b',
        isActive ? 'bg-blue-50 border-blue-100' : 'bg-slate-50 border-slate-100',
      )}>
        <span className={cn(
          'text-label uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border',
          isActive
            ? 'bg-blue-600 text-white border-blue-600'
            : 'bg-white text-blue-600 border-blue-200',
        )}>
          {abbr}
        </span>
        {fv != null && (
          <span className="text-sm font-bold font-mono text-slate-900">
            {fmtPrice(fv, currency)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <div className="text-sm font-semibold text-slate-800">{config.title}</div>
        <div className="text-micro text-slate-400 leading-relaxed">{bestFor}</div>

        {upside != null ? (
          <TrendBadge value={upside} size="sm" />
        ) : (
          <span className="inline-flex items-center gap-1 text-micro text-slate-400">
            <Lock size={10} />
            No data available
          </span>
        )}
      </div>

      {/* Footer CTA */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 rounded-b-xl border-t text-xs font-medium transition-colors',
        isActive
          ? 'border-blue-100 bg-blue-50/50 text-blue-600'
          : 'border-slate-100 bg-slate-50/50 text-slate-500 group-hover:text-blue-600',
      )}>
        <span>{isActive ? 'Model open' : 'Open model'}</span>
        <ChevronRight size={14} className={cn('transition-transform', isActive && 'rotate-90')} />
      </div>
    </div>
  )
}
