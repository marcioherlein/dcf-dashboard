'use client'

import {
  Compass,
  SlidersHorizontal,
  BarChart2,
  Users,
  Bell,
  ArrowRight,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const CARD =
  'bg-white border border-[#E6ECF5] rounded-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]'

interface NextStepsCardProps {
  onViewValuation: () => void
  onViewAssumptions: () => void
  onViewRisks: () => void
}

const ACTIONS = [
  { icon: SlidersHorizontal, label: 'Review key assumptions' },
  { icon: BarChart2, label: 'Run sensitivity analysis' },
  { icon: Users, label: 'Compare to peers' },
  { icon: Bell, label: 'Set price alert' },
] as const

export default function NextStepsCard({
  onViewValuation,
  onViewAssumptions,
}: NextStepsCardProps) {
  return (
    <div className={cn(CARD, 'p-5 flex flex-col gap-4')}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
          <Compass size={15} className="text-[#2563EB]" />
        </div>
        <p className="text-[14px] font-[750] text-[#0F172A]">Next Steps</p>
      </div>

      {/* Actions list */}
      <div className="flex flex-col gap-2">
        {ACTIONS.map(({ icon: Icon, label }) => (
          <div key={label} className="flex items-center gap-2">
            <Icon size={14} className="text-[#64748B] shrink-0" />
            <span className="text-[13px] text-[#334155]">{label}</span>
          </div>
        ))}
      </div>

      {/* CTAs */}
      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={onViewValuation}
          className="w-full h-11 rounded-[10px] bg-[#2563EB] hover:bg-[#1D4ED8] text-white text-[14px] font-[650] transition-colors flex items-center justify-center gap-1.5"
        >
          View full valuation <ArrowRight size={15} />
        </button>
        <button
          onClick={onViewAssumptions}
          className="w-full h-11 rounded-[10px] bg-white border border-[#2563EB] text-[#2563EB] hover:bg-[#EFF6FF] text-[14px] font-[650] transition-colors"
        >
          Review assumptions
        </button>
      </div>
    </div>
  )
}
