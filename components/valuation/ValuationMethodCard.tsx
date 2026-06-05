'use client'

import { motion } from 'motion/react'
import type { ValuationMethodConfig } from './ValuationModelDrawer'
import { TrendBadge } from '@/components/ui/trend-badge'
import { fmtPrice } from '@/lib/formatters'
import { cn } from '@/lib/utils'
import { ChevronRight, Lock } from 'lucide-react'

const METHOD_BEST_FOR: Record<string, string> = {
  forward_pe:        'Profitable growth companies',
  revenue_multiple:  'Pre-profit or high-growth companies',
  core_dcf:          'Established companies with stable FCF',
  reverse_dcf:       'Understanding what the market prices in',
  scenario_blend:    'Probability-weighted fair value range',
  ev_ebitda:         'Asset-heavy or acquisitive businesses',
}

const METHOD_ABBR: Record<string, string> = {
  forward_pe:       'P/E',
  revenue_multiple: 'EV/R',
  core_dcf:         'DCF',
  reverse_dcf:      'Rev',
  scenario_blend:   'Blend',
  ev_ebitda:        'EV/EBITDA',
}

export default function ValuationMethodCard({
  config,
  isActive,
  onOpen,
  index = 0,
}: {
  config: ValuationMethodConfig
  isActive?: boolean
  onOpen: () => void
  index?: number
}) {
  const fv       = config.fairValueSummary ?? null
  const price    = config.currentPrice ?? 0
  const upside   = fv != null && price > 0 ? (fv - price) / price : null
  const currency = config.currency ?? 'USD'
  const abbr     = METHOD_ABBR[config.id] ?? config.id.toUpperCase()
  const bestFor  = METHOD_BEST_FOR[config.id] ?? config.subtitle
  const isRecommended = config.id === 'core_dcf'

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.35, delay: index * 0.07, ease: [0.16, 1, 0.3, 1] }}
      role="button"
      tabIndex={0}
      aria-expanded={isActive}
      onClick={onOpen}
      onKeyDown={e => e.key === 'Enter' && onOpen()}
      className={cn(
        'rounded-xl border cursor-pointer transition-all select-none group card',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400',
        isActive
          ? 'border-blue-400'
          : 'border-slate-200 hover:border-blue-300',
      )}
    >
      {/* Header strip */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 rounded-t-xl border-b',
        isActive ? 'bg-blue-50 border-blue-200' : 'bg-slate-50 border-slate-100',
      )}>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-label uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border',
            isActive
              ? 'bg-blue-100 text-blue-700 border-blue-300'
              : 'bg-blue-50 text-blue-600 border-blue-200',
          )}>
            {abbr}
          </span>
          {isRecommended && (
            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 border border-blue-300">
              Recommended
            </span>
          )}
        </div>
        {fv != null && (
          <span className="text-sm font-bold font-mono text-slate-900">
            {fmtPrice(fv, currency)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <div className="text-sm font-semibold text-slate-800">{config.title}</div>
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
          ? 'border-blue-200 bg-blue-50 text-blue-600'
          : 'border-slate-100 bg-slate-50 text-slate-500 group-hover:text-blue-600',
      )}>
        <span>{isActive ? 'Model open' : 'Open model'}</span>
        <ChevronRight size={14} className={cn('transition-transform', isActive && 'rotate-90')} />
      </div>
    </motion.div>
  )
}
