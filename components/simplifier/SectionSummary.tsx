'use client'

interface SectionSummaryProps {
  text: string
  label?: string
}

export default function SectionSummary({ text, label = 'Analysis' }: SectionSummaryProps) {
  if (!text) return null
  return (
    <div className="rounded-xl border border-[#DCE6F5] bg-[#EEF4FF] px-5 py-4">
      <p className="text-[11px] font-semibold text-[#1f6feb] uppercase tracking-wider mb-1.5">{label}</p>
      <p className="text-[#2D2C31] text-sm leading-relaxed">{text}</p>
    </div>
  )
}
