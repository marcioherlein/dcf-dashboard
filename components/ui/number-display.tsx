import { cn } from '@/lib/utils'

interface NumberDisplayProps {
  value: string        // pre-formatted string (use fmtPrice from lib/formatters)
  size?: 'sm' | 'md' | 'lg' | 'xl'
  positive?: boolean   // undefined = neutral
  className?: string
}

export function NumberDisplay({ value, size = 'lg', positive, className }: NumberDisplayProps) {
  const sizeClass =
    size === 'xl' ? 'text-display' :
    size === 'lg' ? 'text-hero' :
    size === 'md' ? 'text-2xl font-bold' :
    'text-xl font-semibold'

  const colorClass =
    positive === true  ? 'text-emerald-600' :
    positive === false ? 'text-red-600' :
    'text-slate-900'

  return (
    <span className={cn('font-mono tabular-nums', sizeClass, colorClass, className)}>
      {value}
    </span>
  )
}
