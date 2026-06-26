import { cn } from '@/lib/utils'
import { cva, type VariantProps } from 'class-variance-authority'
import { NABadge, type NAReasonId } from '@/components/ui/na-badge'
import { InfoTooltip } from '@/components/ui/info-tooltip'

const chipVariants = cva(
  'inline-flex flex-col items-center rounded-lg border px-3 py-2 min-w-[60px]',
  {
    variants: {
      variant: {
        default:  'bg-white/5 border-[rgba(59,130,246,0.15)]',
        positive: 'bg-[#E8F7EF]/10 border-emerald-500/20',
        negative: 'bg-[#FCEAEA]/10 border-red-500/20',
        warning:  'bg-[#FFF4DA]/10 border-amber-500/20',
        accent:   'bg-[#EAF1FF]/10 border-blue-500/20',
      },
    },
    defaultVariants: { variant: 'default' },
  }
)

const valueVariants = cva('text-sm font-bold font-mono mt-0.5', {
  variants: {
    variant: {
      default:  'text-[#CDD1C8]',
      positive: 'text-[#11875D]',
      negative: 'text-[#D83B3B]',
      warning:  'text-[#B56A00]',
      accent:   'text-[#2563EB]',
    },
  },
  defaultVariants: { variant: 'default' },
})

interface MetricChipProps extends VariantProps<typeof chipVariants> {
  label: string
  value: string
  naReason?: NAReasonId
  className?: string
  tooltip?: string
}

export function MetricChip({ label, value, naReason, variant, className, tooltip }: MetricChipProps) {
  const isNA = naReason != null || value === '—'
  return (
    <div className={cn(chipVariants({ variant: isNA ? 'default' : variant }), className)}>
      <span className="text-label uppercase tracking-wider text-[#566174] flex items-center gap-0.5">
        {label}
        {tooltip && <InfoTooltip text={tooltip} side="top" />}
      </span>
      {isNA
        ? <NABadge reason={naReason ?? 'no-data'} className="mt-0.5" />
        : <span className={cn(valueVariants({ variant }))}>{value}</span>
      }
    </div>
  )
}
