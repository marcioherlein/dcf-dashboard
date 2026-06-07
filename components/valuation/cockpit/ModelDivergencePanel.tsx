'use client'

import { TrendingUp, BarChart2, BarChart, Target } from 'lucide-react'
import type { DivergenceAnalysis } from '@/lib/valuation/cockpit'

interface Props {
  divergence: DivergenceAnalysis
}

const LEVEL_BADGE = {
  low:      { bg: 'bg-[#E8F7EF] border-[#A3D9BE]', text: 'text-[#11875D]', label: 'Low divergence'      },
  moderate: { bg: 'bg-[#FFF4DA] border-[#F3D391]',     text: 'text-[#B56A00]',   label: 'Moderate divergence' },
  high:     { bg: 'bg-[#FCEAEA] border-[#F0B8B8]',         text: 'text-[#D83B3B]',     label: 'High divergence'     },
}

function spreadQual(v: number) {
  if (v > 0.80) return { label: 'Wide',     cls: 'text-[#D83B3B]'     }
  if (v > 0.30) return { label: 'Moderate', cls: 'text-[#B56A00]'   }
  return               { label: 'Narrow',   cls: 'text-[#11875D]' }
}

function cvQual(v: number) {
  if (v > 0.30) return { label: 'High',     cls: 'text-[#D83B3B]'     }
  if (v > 0.15) return { label: 'Moderate', cls: 'text-[#B56A00]'   }
  return               { label: 'Low',      cls: 'text-[#11875D]' }
}

type IconComp = React.ComponentType<{ size?: number; className?: string }>

const METHOD_ICON: Record<string, { iconBg: string; iconText: string; Icon: IconComp }> = {
  forward_pe:       { iconBg: 'bg-[#EAF1FF]',    iconText: 'text-[#2563EB]',    Icon: TrendingUp as IconComp },
  ev_ebitda:        { iconBg: 'bg-indigo-100',  iconText: 'text-indigo-600',  Icon: BarChart2  as IconComp },
  revenue_multiple: { iconBg: 'bg-purple-100',  iconText: 'text-purple-600',  Icon: BarChart   as IconComp },
  core_dcf:         { iconBg: 'bg-[#E8F7EF]', iconText: 'text-[#11875D]', Icon: Target     as IconComp },
}

const CONFIDENCE_CHIP = {
  high:   { bg: 'bg-[#E8F7EF] border-[#A3D9BE]', text: 'text-[#11875D]', label: 'High confidence'   },
  medium: { bg: 'bg-[#FFF4DA] border-[#F3D391]',     text: 'text-[#B56A00]',   label: 'Medium confidence' },
  low:    { bg: 'bg-[#F4F3EF] border-[#E3E1DA]',    text: 'text-[#566174]',   label: 'Low confidence'    },
}

export default function ModelDivergencePanel({ divergence }: Props) {
  const badge   = LEVEL_BADGE[divergence.level]
  const spreadS = spreadQual(divergence.spreadVsPrice)
  const cvS     = cvQual(divergence.cv)

  return (
    <div className="bg-white rounded-xl border border-[#E3E1DA] shadow-sm overflow-hidden">

      {/* ── Header: description | Spread vs Price | Coefficient of Variation ── */}
      <div className="grid grid-cols-1 md:grid-cols-[minmax(0,1fr)_160px_200px] divide-y md:divide-y-0 md:divide-x divide-[#E3E1DA]">

        {/* Left: title + summary */}
        <div className="px-5 py-5">
          <div className="flex flex-wrap items-center gap-2 mb-3">
            <svg className="w-5 h-5 text-[#D83B3B] shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126zM12 15.75h.007v.008H12v-.008z" />
            </svg>
            <span className="text-sm font-bold text-[#D83B3B]">Model Divergence</span>
            <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${badge.bg} ${badge.text}`}>
              {badge.label}
            </span>
          </div>
          <p className="text-[13px] text-[#566174] leading-relaxed mb-2">{divergence.summary}</p>
          <p className="text-[12px] font-semibold text-[#06101F]">
            Use the ranges and individual model insights below to form your own view.
          </p>
        </div>

        {/* Center: Spread vs. Price */}
        <div className="px-6 py-6 flex flex-col justify-center">
          <p className="text-[10px] font-bold text-[#566174] mb-2">Spread vs. Price</p>
          <p className="text-4xl font-bold tabular-nums text-[#06101F] leading-none mb-1">
            {(divergence.spreadVsPrice * 100).toFixed(0)}%
          </p>
          <p className={`text-sm font-semibold ${spreadS.cls}`}>{spreadS.label}</p>
        </div>

        {/* Right: Coefficient of Variation */}
        <div className="px-6 py-6 flex flex-col justify-center">
          <p className="text-[10px] font-bold text-[#566174] mb-2">Coefficient of Variation</p>
          <p className="text-4xl font-bold tabular-nums text-[#06101F] leading-none mb-1">
            {(divergence.cv * 100).toFixed(0)}%
          </p>
          <p className={`text-sm font-semibold ${cvS.cls}`}>{cvS.label}</p>
          <p className="text-[10px] text-[#8A95A6] mt-1">(threshold: 15% / 30%)</p>
        </div>
      </div>

      {/* ── What's Driving the Divergence ── */}
      {divergence.methodExplanations.length > 0 && (
        <div className="border-t border-[#E3E1DA]">
          <div className="px-5 py-3 bg-[#F4F3EF]/70">
            <p className="text-[10px] font-bold text-[#566174]">
              What&apos;s Driving the Divergence?
            </p>
          </div>
          <div className="divide-y divide-[#E3E1DA]">
            {divergence.methodExplanations.map(e => {
              const cfg  = METHOD_ICON[e.methodId]
              const conf = CONFIDENCE_CHIP[e.confidence]
              return (
                <div key={e.methodId} className="px-4 py-4 flex items-start gap-3 flex-wrap sm:flex-nowrap min-w-0">
                  {/* Icon */}
                  {cfg && (
                    <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${cfg.iconBg}`}>
                      <cfg.Icon size={14} className={cfg.iconText} />
                    </div>
                  )}
                  {/* Method name */}
                  <span className="text-sm font-bold text-[#06101F] shrink-0 w-auto sm:w-36">{e.methodName}</span>
                  {/* Confidence badge */}
                  <span className={`text-[10px] font-bold px-3 py-1 rounded-full border shrink-0 ${conf.bg} ${conf.text}`}>
                    {conf.label}
                  </span>
                  {/* Reason text — flows to the right */}
                  <p className="text-[12px] text-[#566174] leading-relaxed flex-1 min-w-0">{e.reason}</p>
                </div>
              )
            })}
          </div>
        </div>
      )}
    </div>
  )
}
