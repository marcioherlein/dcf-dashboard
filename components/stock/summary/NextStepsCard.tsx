'use client'

import {
  Compass,
  ArrowRight,
  GitCompareArrows,
} from 'lucide-react'
import Link from 'next/link'
import { cn } from '@/lib/utils'

const CARD =
  'bg-white border border-[#E5E5E5] rounded-xl shadow-card'

interface NextStepsCardProps {
  ticker: string
  onViewValuation: () => void
  onViewAssumptions: () => void
  onViewConviction: () => void
}

export default function NextStepsCard({
  ticker,
  onViewValuation,
  onViewAssumptions,
  onViewConviction,
}: NextStepsCardProps) {
  return (
    <div className={cn(CARD, 'p-4 sm:p-5 flex flex-col gap-4')}>
      {/* Header */}
      <div className="flex items-center gap-2">
        <div className="w-7 h-7 rounded-full bg-[#EFF6FF] flex items-center justify-center shrink-0">
          <Compass size={15} className="text-[#2563EB]" />
        </div>
        <p className="text-[13px] font-[700] text-[#111111] leading-tight">Next Steps</p>
      </div>

      <p className="text-[13px] text-[#566174] leading-relaxed">
        Adjust assumptions, explore scenarios, and stress-test the model to build or challenge your conviction.
      </p>

      {/* CTAs */}
      <div className="flex flex-col gap-2 mt-auto">
        <button
          onClick={onViewValuation}
          className="w-full h-11 rounded-lg bg-olive-700 hover:bg-olive-600 text-white text-[14px] font-[650] transition-colors flex items-center justify-center gap-1.5"
        >
          View full valuation <ArrowRight size={15} />
        </button>
        <button
          onClick={onViewAssumptions}
          className="w-full h-11 rounded-lg bg-white border border-[#C8C8C8] text-olive-700 hover:bg-olive-50 text-[14px] font-[650] transition-colors"
        >
          Review assumptions
        </button>
        <button
          onClick={onViewConviction}
          className="w-full h-11 rounded-lg bg-white border border-[#E3E1DA] text-[#566174] hover:border-[#CDD1C8] hover:bg-[#F0F1F6] text-[13px] font-medium transition-colors"
        >
          Risks &amp; health scores
        </button>
        <Link
          href={`/compare?a=${ticker}`}
          className="w-full h-11 rounded-lg bg-white border border-[#E3E1DA] text-[#566174] hover:border-[#CDD1C8] hover:bg-[#F0F1F6] text-[13px] font-medium transition-colors flex items-center justify-center gap-1.5"
        >
          <GitCompareArrows size={14} className="text-[#8A95A6]" />
          Compare with another stock
        </Link>
      </div>
    </div>
  )
}
