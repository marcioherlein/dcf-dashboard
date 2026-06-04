'use client'

import {
  Compass,
  ArrowRight,
  GitCompareArrows,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const CARD =
  'bg-white border border-[#E6ECF5] rounded-[18px] shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]'

interface NextStepsCardProps {
  ticker: string
  onViewValuation: () => void
  onViewAssumptions: () => void
  onViewRisks: () => void
}

export default function NextStepsCard({
  ticker,
  onViewValuation,
  onViewAssumptions,
  onViewRisks,
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

      <p className="text-[13px] text-[#475569] leading-relaxed">
        Adjust assumptions, explore scenarios, and stress-test the model to build or challenge your conviction.
      </p>

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
        <button
          onClick={onViewRisks}
          className="w-full h-10 rounded-[10px] bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 text-[13px] font-medium transition-colors"
        >
          Risks &amp; health scores
        </button>
        <Link
          href={`/compare?a=${ticker}`}
          className="w-full h-10 rounded-[10px] bg-white border border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50 text-[13px] font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <GitCompareArrows size={14} className="text-slate-400" />
          Compare with another stock
        </Link>
      </div>
    </div>
  )
}
