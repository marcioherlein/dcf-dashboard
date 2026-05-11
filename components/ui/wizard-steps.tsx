import { cn } from '@/lib/utils'
import { Check } from 'lucide-react'

interface Step {
  label: string
  sublabel?: string
}

interface WizardStepsProps {
  steps: Step[]
  current: number   // 1-indexed
  className?: string
}

export function WizardSteps({ steps, current, className }: WizardStepsProps) {
  return (
    <div className={cn('flex items-center gap-0', className)}>
      {steps.map((step, i) => {
        const num    = i + 1
        const done   = num < current
        const active = num === current
        const future = num > current

        return (
          <div key={i} className="flex items-center">
            {/* Connector line */}
            {i > 0 && (
              <div className={cn(
                'h-px w-8 sm:w-12 flex-shrink-0',
                done ? 'bg-emerald-400' : 'bg-slate-200'
              )} />
            )}

            {/* Step pill */}
            <div className="flex flex-col items-center gap-0.5">
              <div className={cn(
                'flex items-center justify-center w-7 h-7 rounded-full border-2 text-xs font-bold transition-all',
                done   && 'bg-emerald-500 border-emerald-500 text-white',
                active && 'bg-blue-600 border-blue-600 text-white ring-4 ring-blue-100',
                future && 'bg-white border-slate-300 text-slate-400',
              )}>
                {done ? <Check size={13} strokeWidth={3} /> : num}
              </div>
              <span className={cn(
                'text-[10px] font-medium whitespace-nowrap hidden sm:block',
                active ? 'text-blue-600' : done ? 'text-emerald-600' : 'text-slate-400'
              )}>
                {step.label}
              </span>
            </div>
          </div>
        )
      })}
    </div>
  )
}
