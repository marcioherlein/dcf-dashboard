'use client'

import { type ReactNode } from 'react'
import { Lock } from 'lucide-react'
import Link from 'next/link'

interface ProGateProps {
  children: ReactNode
  featureName: string
  isPro: boolean
}

export default function ProGate({ children, featureName, isPro }: ProGateProps) {
  if (isPro) return <>{children}</>

  return (
    <div className="relative">
      <div className="blur-sm pointer-events-none select-none" aria-hidden>
        {children}
      </div>

      <div className="absolute inset-0 flex items-center justify-center bg-white/80 backdrop-blur-sm rounded-xl z-10">
        <div className="flex flex-col items-center gap-3 px-6 text-center">
          <div className="w-10 h-10 rounded-full bg-[#EAF1FF] border border-blue-100 flex items-center justify-center">
            <Lock size={16} className="text-[#5F790B]" />
          </div>
          <div>
            <p className="text-sm font-semibold text-[#06101F]">{featureName}</p>
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
    </div>
  )
}
