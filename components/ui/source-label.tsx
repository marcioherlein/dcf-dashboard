import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const sourceLabelVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border',
  {
    variants: {
      source: {
        yahoo:    'bg-violet-50 text-violet-600 border-violet-200',
        wacc:     'bg-blue-500/15 text-blue-400 border-blue-500/20',
        user:     'bg-amber-50 text-amber-600 border-amber-200',
        calc:     'bg-white/8 text-slate-400 border-white/12',
        default:  'bg-white/8 text-slate-400 border-white/12',
      },
    },
    defaultVariants: { source: 'default' },
  }
)

interface SourceLabelProps extends VariantProps<typeof sourceLabelVariants> {
  children: React.ReactNode
  className?: string
}

export function SourceLabel({ children, source, className }: SourceLabelProps) {
  const dot = source === 'yahoo' ? '◉' : source === 'wacc' ? '⊕' : source === 'user' ? '✎' : '·'
  return (
    <span className={cn(sourceLabelVariants({ source }), className)}>
      <span>{dot}</span>
      {children}
    </span>
  )
}
