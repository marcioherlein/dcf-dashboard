'use client'

import Link from 'next/link'
import { X, Lock, Bell, TrendingUp, BarChart2 } from 'lucide-react'
import { useEffect } from 'react'
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

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-[2px] px-4"
      onClick={onClose}
    >
      <div
        className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={onClose}
          className="absolute top-4 right-4 text-slate-400 hover:text-slate-600 transition-colors"
          aria-label="Close"
        >
          <X size={18} />
        </button>

        {/* Icon */}
        <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-blue-50">
          <Lock className="h-7 w-7 text-blue-600" />
        </div>

        <h2 className="text-lg font-bold text-slate-900 leading-snug">
          {config.label} is a Pro feature
        </h2>
        <p className="mt-2 text-sm text-slate-500 leading-relaxed">
          {config.description}
        </p>

        <ul className="mt-5 space-y-3">
          {PRO_BULLETS.map(({ Icon, text }, i) => (
            <li key={i} className="flex items-center gap-3 text-sm text-slate-700">
              <div className="w-7 h-7 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
                <Icon size={14} className="text-blue-600" />
              </div>
              {text}
            </li>
          ))}
        </ul>

        <Link
          href="/pricing"
          onClick={onClose}
          className="mt-6 flex w-full items-center justify-center rounded-xl py-3 px-4 text-sm font-bold text-white transition-colors"
          style={{ background: '#0F2A5E' }}
        >
          Upgrade to Pro →
        </Link>

        <button
          onClick={onClose}
          className="mt-3 w-full text-center text-[12px] text-slate-400 hover:text-slate-600 transition-colors"
        >
          Maybe later
        </button>
      </div>
    </div>
  )
}
