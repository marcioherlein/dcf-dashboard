import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { NABadge, type NAReasonId } from '@/components/ui/na-badge'

const chipVariants = cva(
  'inline-flex flex-col items-center rounded-lg border px-3 py-2 min-w-[60px]',
  {
    variants: {
      variant: {
        default:  'bg-slate-50 border-slate-200',
        positive: 'bg-emerald-50 border-emerald-200',
        negative: 'bg-red-50 border-red-200',
        warning:  'bg-amber-50 border-amber-200',
        accent:   'bg-blue-50 border-blue-200',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

const valueVariants = cva('text-sm font-bold font-mono mt-0.5', {
  variants: {
    variant: {
      default:  'text-slate-800',
      positive: 'text-emerald-700',
      negative: 'text-red-700',
      warning:  'text-amber-700',
      accent:   'text-blue-700',
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
      <span className="text-label uppercase tracking-wider text-slate-400">{label}</span>
      {isNA
        ? <NABadge reason={naReason ?? 'no-data'} className="mt-0.5" />
        : <span className={cn(valueVariants({ variant }))}>{value}</span>
      }
    </div>
  )
}
