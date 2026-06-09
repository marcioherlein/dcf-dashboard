'use client'

import { type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import Link from 'next/link'

interface ProGateProps {
  children: ReactNode
  featureName: string
  isPro: boolean
  /** Height of the placeholder shown to free users. Defaults to h-48. */
  placeholderHeight?: string
}

export default function ProGate({ children, featureName, isPro, placeholderHeight = 'h-48' }: ProGateProps) {
  // Pro users: render children with no wrapper overhead
  if (isPro) return <>{children}</>

  // Free users: show a placeholder — do NOT render children at all.
  // Rendering children and blurring them costs full component mount time
  // (recharts, heavy memos, etc.) for content the user can't see.
  return (
    <div className={`relative ${placeholderHeight} flex items-center justify-center bg-[#F9F8F6] border border-[#E5E5E5] rounded-xl`}>
      <div className="flex flex-col items-center gap-3 px-6 text-center">
        <div className="w-10 h-10 rounded-full bg-[#EEF4DD] border border-[#BFD2A1] flex items-center justify-center">
          <Lock size={16} className="text-[#5F790B]" />
        </div>
        <div>
          <p className="text-[14px] font-semibold text-[#111111]">{featureName}</p>
          <span className="inline-block mt-1 text-[10px] font-bold bg-[#EEF4DD] text-[#5F790B] px-2 py-0.5 rounded uppercase tracking-wide">
            Pro feature
          </span>
        </div>
        <Link
          href="/pricing"
          className="mt-1 bg-[#5F790B] text-white rounded-lg px-4 py-2 text-[13px] font-semibold hover:bg-[#526A08] transition-colors"
        >
          Upgrade to Pro
        </Link>
      </div>
    </div>
  )
}
