import { cn } from '@/lib/utils'
import { TrendingUp, TrendingDown, Minus } from 'lucide-react'
import { fmtPct } from '@/lib/formatters'

interface TrendBadgeProps {
  value: number | null
  className?: string
  showIcon?: boolean
  size?: 'sm' | 'md' | 'lg'
}

export function TrendBadge({ value, className, showIcon = true, size = 'md' }: TrendBadgeProps) {
  if (value == null) return <span className="text-slate-400 text-micro">—</span>

  const isPositive = value >= 0.001
  const isNegative = value < -0.001

  const colorClass = isPositive ? 'text-emerald-700 bg-emerald-50 border-emerald-200'
    : isNegative ? 'text-red-700 bg-red-50 border-red-200'
    : 'text-slate-300 bg-white/8 border-white/15'

  const sizeClass = size === 'sm' ? 'text-[10px] px-1.5 py-0.5' : size === 'lg' ? 'text-base px-3 py-1' : 'text-xs px-2 py-0.5'
  const iconSize  = size === 'sm' ? 10 : size === 'lg' ? 16 : 12

  const Icon = isPositive ? TrendingUp : isNegative ? TrendingDown : Minus

  return (
    <span className={cn(
      'inline-flex items-center gap-1 rounded-full border font-semibold font-mono',
      colorClass, sizeClass, className
    )}>
      {showIcon && <Icon size={iconSize} strokeWidth={2.5} />}
      {fmtPct(value)}
    </span>
  )
}
