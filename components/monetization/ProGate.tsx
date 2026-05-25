'use client'

import { useState } from 'react'
import { Lock } from 'lucide-react'
import { useFeatureGate, type FeatureGate, getGateConfig } from '@/lib/monetization/featureGates'
import PaywallModal from './PaywallModal'

interface ProGateProps {
  gate: FeatureGate
  children: React.ReactNode
  placeholder?: React.ReactNode
}

export default function ProGate({ gate, children, placeholder }: ProGateProps) {
  const [modalOpen, setModalOpen] = useState(false)
  const { allowed } = useFeatureGate(gate)
  const config = getGateConfig(gate)

  if (allowed) return <>{children}</>

  return (
    <>
      <div className="relative">
        <div className="select-none pointer-events-none" aria-hidden>
          <div className="blur-sm opacity-50">
            {placeholder ?? children}
          </div>
        </div>
        <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/60 backdrop-blur-[2px] rounded-xl">
          <div className="flex flex-col items-center gap-3 px-6 text-center">
            <div className="w-10 h-10 rounded-full bg-blue-50 border border-blue-100 flex items-center justify-center">
              <Lock size={16} className="text-blue-600" />
            </div>
            <div>
              <p className="text-sm font-semibold text-slate-800">{config.label}</p>
              <p className="text-xs text-slate-500 mt-0.5">{config.description}</p>
            </div>
            <button
              onClick={() => setModalOpen(true)}
              className="mt-1 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold transition-colors"
            >
              Unlock with Pro
            </button>
          </div>
        </div>
      </div>

      {modalOpen && <PaywallModal gate={gate} onClose={() => setModalOpen(false)} />}
    </>
  )
}
