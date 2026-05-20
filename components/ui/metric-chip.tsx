import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { NABadge, type NAReasonId } from '@/components/ui/na-badge'

const chipVariants = cva(
  'inline-flex flex-col items-center rounded-lg border px-3 py-2 min-w-[60px]',
  {
    variants: {
      variant: {
        default:  'bg-white/5 border-[rgba(59,130,246,0.15)]',
        positive: 'bg-emerald-500/10 border-emerald-500/20',
        negative: 'bg-red-500/10 border-red-500/20',
        warning:  'bg-amber-500/10 border-amber-500/20',
        accent:   'bg-blue-500/10 border-blue-500/20',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

const valueVariants = cva('text-sm font-bold font-mono mt-0.5', {
  variants: {
    variant: {
      default:  'text-slate-200',
      positive: 'text-emerald-400',
      negative: 'text-red-400',
      warning:  'text-amber-400',
      accent:   'text-blue-400',
    },
  },
  defaultVariants: { variant: 'default' },
})

interface MetricChipProps extends VariantProps<typeof chipVariants> {
  label: string
  value: string
  naReason?: NAReasonId
  className?: string
}

export function MetricChip({ label, value, naReason, variant, className }: MetricChipProps) {
  const isNA = naReason != null || value === '—'
  return (
    <div className={cn(chipVariants({ variant: isNA ? 'default' : variant }), className)}>
      <span className="text-label uppercase tracking-wider text-slate-500">{label}</span>
      {isNA
        ? <NABadge reason={naReason ?? 'no-data'} className="mt-0.5" />
        : <span className={cn(valueVariants({ variant }))}>{value}</span>
      }
    </div>
  )
}
