'use client'

import Link from 'next/link'
import { X, Lock, Bell, TrendingUp, BarChart2 } from 'lucide-react'
import { useEffect, useRef } from 'react'
import { getGateConfig, type FeatureGate } from '@/lib/monetization/featureGates'

interface Props {
  gate: FeatureGate
  onClose: () => void
}

const PRO_BULLETS = [
  { Icon: BarChart2, text: 'Sensitivity table — fair value at every CAGR × WACC' },
  { Icon: Bell,      text: 'Price alerts — get notified when a stock enters your range' },
  { Icon: TrendingUp, text: 'Unlimited saved analyses + portfolio tracker' },
]

export default function PaywallModal({ gate, onClose }: Props) {
  const config = getGateConfig(gate)
  const titleId = 'paywall-modal-title'
  const ctaRef = useRef<HTMLAnchorElement>(null)

  useEffect(() => {
    ctaRef.current?.focus()
  }, [])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/30 backdrop-blur-[2px] px-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        className="relative w-full max-w-sm bg-white border border-[#E3E6E0] rounded-2xl shadow-2xl p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-[#8A96A8] hover:text-[#536174] transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-[#F3F2EC]"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-[#EEF4DD]">
          <Lock className="h-7 w-7 text-[#5F790B]" />
        </div>

        <h2 id={titleId} className="text-lg font-bold text-[#0A1424] leading-snug">
          {config.label} is a Pro feature
        </h2>
        <p className="mt-2 text-sm text-[#536174] leading-relaxed">
          {config.description}
        </p>

        <ul className="mt-5 space-y-3">
          {PRO_BULLETS.map(({ Icon, text }, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-[#0A1424]">
              <div className="w-7 h-7 rounded-lg bg-[#EEF4DD] flex items-center justify-center shrink-0">
                <Icon size={14} className="text-[#5F790B]" />
              </div>
              {text}
            </li>
          ))}
        </ul>

        <Link
          ref={ctaRef}
          href="/pricing"
          onClick={onClose}
          className="mt-6 flex w-full items-center justify-center rounded-xl py-3 px-4 text-sm font-bold text-white transition-colors bg-[#5F790B] hover:bg-[#526A08] active:bg-[#4A5E07]"
        >
          Upgrade to Pro →
        </Link>

        <button
          onClick={onClose}
          className="mt-3 w-full text-center text-[12px] text-[#8A96A8] hover:text-[#536174] transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
