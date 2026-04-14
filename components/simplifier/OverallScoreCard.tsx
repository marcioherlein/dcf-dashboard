'use client'

import dynamic from 'next/dynamic'
import { PHASES } from '@/lib/simplifier/phases'
import { overallScore } from '@/lib/simplifier/scoring'
import type { PhaseScores } from '@/lib/simplifier/types'
import PhaseScoreBadge from './PhaseScoreBadge'

const RadarChart     = dynamic(() => import('recharts').then((m) => m.RadarChart),     { ssr: false })
const Radar          = dynamic(() => import('recharts').then((m) => m.Radar),          { ssr: false })
const PolarGrid      = dynamic(() => import('recharts').then((m) => m.PolarGrid),      { ssr: false })
const PolarAngleAxis = dynamic(() => import('recharts').then((m) => m.PolarAngleAxis), { ssr: false })
const ResponsiveContainer = dynamic(() => import('recharts').then((m) => m.ResponsiveContainer), { ssr: false })

interface OverallScoreCardProps {
  phaseScores: PhaseScores
  companyName: string
  onGetFullAnalysis: () => void
}

export default function OverallScoreCard({
  phaseScores, companyName, onGetFullAnalysis,
}: OverallScoreCardProps) {
  const overall = overallScore(phaseScores)
  const pct     = Math.round(overall * 100)

  const radarData = PHASES.map((p) => ({
    phase: p.name,
    score: Math.round((phaseScores[p.id as keyof PhaseScores] ?? 0) * 100),
    fullMark: 100,
  }))

  const verdict =
    pct >= 75 ? { label: 'Strong Buy Candidate', color: 'text-[#3fb950]' }
    : pct >= 55 ? { label: 'Potential Buy', color: 'text-[#79c0ff]' }
    : pct >= 40 ? { label: 'Monitor Closely', color: 'text-[#e3b341]' }
    : { label: 'Avoid for Now', color: 'text-[#f85149]' }

  function handlePrint() {
    window.print()
  }

  return (
    <div className="rounded-xl border border-[#388bfd]/40 bg-[#0d1117] p-6 print:border-gray-300">
      <div className="flex items-center justify-between mb-5">
        <div>
          <h2 className="text-[#e6edf3] font-semibold text-base">Analysis Complete</h2>
          <p className="text-[#8b949e] text-xs mt-0.5">{companyName}</p>
        </div>
        <div className="text-right">
          <div className="flex items-center gap-2 justify-end">
            <span className="text-2xl font-bold font-mono text-[#e6edf3]">{pct}%</span>
            <PhaseScoreBadge score={overall} size="md" showLabel />
          </div>
          <p className={`text-sm font-semibold mt-0.5 ${verdict.color}`}>{verdict.label}</p>
        </div>
      </div>

      {/* Radar chart */}
      <div className="h-56 w-full mb-5">
        <ResponsiveContainer width="100%" height="100%">
          <RadarChart data={radarData} margin={{ top: 10, right: 20, bottom: 10, left: 20 }}>
            <PolarGrid stroke="#30363d" />
            <PolarAngleAxis dataKey="phase" tick={{ fill: '#8b949e', fontSize: 11 }} />
            <Radar
              name={companyName}
              dataKey="score"
              stroke="#388bfd"
              fill="#388bfd"
              fillOpacity={0.18}
              strokeWidth={2}
            />
          </RadarChart>
        </ResponsiveContainer>
      </div>

      {/* Phase score breakdown */}
      <div className="grid grid-cols-5 gap-2 mb-5">
        {PHASES.map((p) => (
          <div key={p.id} className="flex flex-col items-center gap-1 text-center">
            <span className="text-[10px] text-[#8b949e] leading-tight">{p.name}</span>
            <PhaseScoreBadge score={phaseScores[p.id as keyof PhaseScores] ?? null} size="sm" />
          </div>
        ))}
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={onGetFullAnalysis}
          className="flex-1 flex items-center justify-center gap-2 py-2.5 rounded text-sm font-semibold bg-[#1f6feb] border border-[#388bfd] text-white hover:bg-[#388bfd] transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M0 2.75A2.75 2.75 0 0 1 2.75 0h10.5A2.75 2.75 0 0 1 16 2.75v8.5A2.75 2.75 0 0 1 13.25 14H8.56l-2.35 2.35a1 1 0 0 1-1.7-.71V14H2.75A2.75 2.75 0 0 1 0 11.25Z"/>
          </svg>
          Get Full AI Analysis
        </button>
        <button
          onClick={handlePrint}
          className="flex items-center justify-center gap-2 px-4 py-2.5 rounded text-sm text-[#8b949e] border border-[#30363d] hover:border-[#6e7681] hover:text-[#e6edf3] transition-all"
        >
          <svg width="14" height="14" viewBox="0 0 16 16" fill="currentColor">
            <path d="M3.75 0h8.5c.966 0 1.75.784 1.75 1.75v2h.25c.966 0 1.75.784 1.75 1.75v5.75A1.75 1.75 0 0 1 14.25 13H14v1.25A1.75 1.75 0 0 1 12.25 16h-8.5A1.75 1.75 0 0 1 2 14.25V13H1.75A1.75 1.75 0 0 1 0 11.25V5.5c0-.966.784-1.75 1.75-1.75H2v-2C2 .784 2.784 0 3.75 0Zm0 1.5a.25.25 0 0 0-.25.25v2h9v-2a.25.25 0 0 0-.25-.25Zm8.5 10a.25.25 0 0 0 .25-.25V7.375H3.5v3.875c0 .138.112.25.25.25Z"/>
          </svg>
          Export PDF
        </button>
      </div>
    </div>
  )
}
