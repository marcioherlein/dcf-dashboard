'use client'
import { cn } from '@/lib/utils'

export type NAReasonId =
  | 'no-data'
  | 'calc-error'
  | 'negative-base'
  | 'not-applicable'
  | 'model-unsupported'
  | 'insufficient-history'
  | 'no-coverage'
  | 'requires-positive-earnings'

const REASON_LABELS: Record<NAReasonId, string> = {
  'no-data':                    'Data not available from provider',
  'calc-error':                 'Could not be calculated',
  'negative-base':              'Negative base value — ratio undefined',
  'not-applicable':             'Not applicable for this instrument',
  'model-unsupported':          'Not supported by this valuation model',
  'insufficient-history':       'Insufficient historical data',
  'no-coverage':                'No analyst coverage available',
  'requires-positive-earnings': 'Requires positive earnings (company is unprofitable)',
}

interface NABadgeProps {
  reason?: NAReasonId
  className?: string
  size?: 'xs' | 'sm'
}

export function NABadge({ reason = 'no-data', className, size = 'xs' }: NABadgeProps) {
  const label = REASON_LABELS[reason]
  return (
    <span
      title={label}
      className={cn(
        'inline-flex items-center rounded px-1 font-mono font-semibold text-[#8A95A6] bg-[#F0F1F6] border border-[#E3E1DA] cursor-help',
        size === 'xs' ? 'text-[10px] py-px' : 'text-[11px] py-0.5',
        className,
      )}
    >
      N/A
    </span>
  )
}
