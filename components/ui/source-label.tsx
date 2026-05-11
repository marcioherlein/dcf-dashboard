import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'

const sourceLabelVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-medium border',
  {
    variants: {
      source: {
        yahoo:    'bg-violet-50 text-violet-600 border-violet-200',
        wacc:     'bg-blue-50 text-blue-600 border-blue-200',
        user:     'bg-amber-50 text-amber-600 border-amber-200',
        calc:     'bg-slate-50 text-slate-500 border-slate-200',
        default:  'bg-slate-50 text-slate-500 border-slate-200',
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
