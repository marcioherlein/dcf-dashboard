'use client'

interface AutoHintChipProps {
  displayValue: string
  rationale: string
}

export default function AutoHintChip({ displayValue, rationale }: AutoHintChipProps) {
  return (
    <span
      title={rationale}
      className="inline-flex items-center gap-1 rounded bg-[#1f2d3d] border border-[#388bfd]/30 text-[#79c0ff] text-[11px] font-mono px-1.5 py-0.5 cursor-help"
    >
      <svg width="10" height="10" viewBox="0 0 16 16" fill="currentColor" className="shrink-0 opacity-70">
        <path d="M8 0a8 8 0 1 1 0 16A8 8 0 0 1 8 0Zm0 1.5a6.5 6.5 0 1 0 0 13 6.5 6.5 0 0 0 0-13ZM7.25 6h1.5v5.5h-1.5Zm0-2.5h1.5v1.5h-1.5Z"/>
      </svg>
      {displayValue}
    </span>
  )
}
