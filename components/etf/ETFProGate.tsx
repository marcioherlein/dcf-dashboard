'use client'

import { useRouter } from 'next/navigation'
import { Lock } from 'lucide-react'
import { useFeatureGate, getGateConfig } from '@/lib/monetization/featureGates'
import type { FeatureGate } from '@/lib/monetization/featureGates'

interface Props {
  gate: FeatureGate
  children: React.ReactNode
  /** Show a compact inline nudge instead of the full blurred overlay */
  variant?: 'overlay' | 'inline'
}

/**
 * Wraps a Pro-only ETF feature. Free users see either:
 * - 'overlay': blurred placeholder card with upgrade CTA (for detail-page sections)
 * - 'inline': small banner nudge (for table rows, watchlist limit, etc.)
 */
export function ETFProGate({ gate, children, variant = 'overlay' }: Props) {
  const { allowed } = useFeatureGate(gate)
  const router = useRouter()
  const config = getGateConfig(gate)

  if (allowed) return <>{children}</>

  if (variant === 'inline') {
    return (
      <div className="flex items-center justify-between gap-3 rounded-xl border border-[#BFD2A1] bg-[#F6FAEA] px-4 py-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <Lock size={13} className="text-[#5F790B] shrink-0" aria-hidden="true" />
          <p className="text-[13px] text-[#566174] leading-snug">
            <strong className="text-[#06101F] font-semibold">{config.label}</strong>
            {' '}— {config.description}
          </p>
        </div>
        <button
          onClick={() => router.push('/pricing#pro')}
          className="shrink-0 rounded-lg bg-[#4A6109] hover:bg-[#3E5206] text-white px-3.5 py-1.5 text-[12px] font-semibold transition-colors whitespace-nowrap"
        >
          Upgrade to Pro
        </button>
      </div>
    )
  }

  // Overlay variant — blurred section with lock
  return (
    <div className="relative rounded-2xl border border-[#E3E1DA] bg-white overflow-hidden">
      {/* Blurred content preview */}
      <div className="opacity-30 pointer-events-none blur-[3px] select-none" aria-hidden="true">
        {children}
      </div>

      {/* Lock overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 px-6 text-center">
        <div className="w-10 h-10 rounded-full bg-[#FFF4DA] border border-[#FDE68A] flex items-center justify-center">
          <Lock size={16} className="text-[#B56A00]" strokeWidth={2.5} aria-hidden="true" />
        </div>
        <div>
          <p className="text-[14px] font-bold text-[#06101F]">{config.label}</p>
          <p className="text-[12px] text-[#566174] mt-0.5 max-w-[240px]">{config.description}</p>
        </div>
        <button
          onClick={() => router.push('/pricing#pro')}
          className="mt-1 rounded-lg bg-[#4A6109] hover:bg-[#3E5206] text-white px-4 py-2 text-[13px] font-semibold transition-colors"
        >
          Unlock with Pro
        </button>
      </div>
    </div>
  )
}
