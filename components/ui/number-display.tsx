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
    positive === true  ? 'text-[#11875D]' :
    positive === false ? 'text-[#D83B3B]' :
    'text-[#E3E1DA]'

  return (
    <span className={cn('font-mono tabular-nums', sizeClass, colorClass, className)}>
      {value}
    </span>
  )
}
