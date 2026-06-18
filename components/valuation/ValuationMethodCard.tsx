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
          ? 'border-[#93B4F5]'
          : 'border-[#E3E1DA] hover:border-[#93B4F5]',
      )}
    >
      {/* Header strip */}
      <div className={cn(
        'flex items-center justify-between px-4 py-3 rounded-t-xl border-b',
        isActive ? 'bg-[#EAF1FF] border-[#93B4F5]' : 'bg-[#F0F1F6] border-[#E3E1DA]',
      )}>
        <div className="flex items-center gap-2">
          <span className={cn(
            'text-label uppercase tracking-wider font-bold px-2 py-0.5 rounded-md border',
            isActive
              ? 'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]'
              : 'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]',
          )}>
            {abbr}
          </span>
          {isRecommended && (
            <span className="bg-[#EAF1FF] text-[#2563EB] text-[10px] font-bold uppercase tracking-widest rounded-full px-2 py-0.5 border border-[#93B4F5]">
              Recommended
            </span>
          )}
        </div>
        {fv != null && (
          <span className="text-sm font-bold font-mono text-[#06101F]">
            {fmtPrice(fv, currency)}
          </span>
        )}
      </div>

      {/* Body */}
      <div className="px-4 py-3 space-y-2">
        <div className="text-sm font-semibold text-[#06101F]">{config.title}</div>
        <div className="text-micro text-[#566174] leading-relaxed">{bestFor}</div>

        {upside != null ? (
          <TrendBadge value={upside} size="sm" />
        ) : (
          <span className="inline-flex items-center gap-1 text-micro text-[#566174]">
            <Lock size={10} />
            No data available
          </span>
        )}
      </div>

      {/* Footer CTA */}
      <div className={cn(
        'flex items-center justify-between px-4 py-2.5 rounded-b-xl border-t text-xs font-medium transition-colors',
        isActive
          ? 'border-[#93B4F5] bg-[#EAF1FF] text-[#2563EB]'
          : 'border-[#E3E1DA] bg-[#F0F1F6] text-[#566174] group-hover:text-[#2563EB]',
      )}>
        <span>{isActive ? 'Model open' : 'Open model'}</span>
        <ChevronRight size={14} className={cn('transition-transform', isActive && 'rotate-90')} />
      </div>
    </motion.div>
  )
}
