'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Globe } from 'lucide-react'

interface CompanyCardProps {
  description: string
  sector?: string
  industry: string
  country: string
  employees: number | null
  ticker: string
}

const CLIP_LENGTH = 220

export default function CompanyCard({ description, sector, industry, country, employees, ticker }: CompanyCardProps) {
  const [expanded, setExpanded] = useState(false)

  const isLong   = description.length > CLIP_LENGTH
  const displayed = !expanded && isLong ? description.slice(0, CLIP_LENGTH).trimEnd() + '…' : description

  const tags = [
    sector   && sector   !== 'N/A' ? sector   : null,
    industry && industry !== 'N/A' ? industry : null,
    country  && country  !== 'N/A' ? country  : null,
    employees != null ? `${(employees / 1000).toFixed(0)}K employees` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="bg-white border border-[#E6ECF5] rounded-[18px] p-4 sm:p-5 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_rgba(15,23,42,0.04)]">
      {/* Description — clamp to 3 lines on mobile when collapsed */}
      <p className={cn(
        'text-[13px] text-[#475569] leading-relaxed mb-1',
        !expanded && isLong ? 'line-clamp-3 sm:line-clamp-none' : ''
      )}>
        {displayed}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[13px] font-[650] text-[#2563EB] hover:text-[#1D4ED8] transition-colors mb-3 min-h-[44px] flex items-center"
        >
          {expanded ? 'Show less' : 'Read more'}
        </button>
      )}

      {/* Tags */}
      {tags.length > 0 && (
        <div className={cn('flex flex-wrap gap-1.5', !isLong ? 'mt-3' : 'mt-1')}>
          {tags.map(tag => (
            <span
              key={tag}
              className="text-[11px] font-[600] text-[#475569] bg-[#F8FAFC] border border-[#E6ECF5] rounded-[6px] px-2.5 py-1"
            >
              {tag}
            </span>
          ))}
        </div>
      )}

      {/* Website link */}
      <a
        href={`https://finance.yahoo.com/quote/${ticker}`}
        target="_blank"
        rel="noopener noreferrer"
        className="inline-flex items-center gap-1.5 mt-3 min-h-[44px] text-[13px] font-[650] text-[#2563EB] hover:text-[#1D4ED8] transition-colors"
      >
        <Globe size={14} />
        View on Yahoo Finance →
      </a>
    </div>
  )
}
