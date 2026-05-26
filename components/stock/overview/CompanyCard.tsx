'use client'
import { useState } from 'react'
import { cn } from '@/lib/utils'
import { Globe } from 'lucide-react'

interface CompanyCardProps {
  description: string
  industry: string
  country: string
  employees: number | null
  ticker: string
}

const CLIP_LENGTH = 220

export default function CompanyCard({ description, industry, country, employees, ticker }: CompanyCardProps) {
  const [expanded, setExpanded] = useState(false)

  const isLong   = description.length > CLIP_LENGTH
  const displayed = !expanded && isLong ? description.slice(0, CLIP_LENGTH).trimEnd() + '…' : description

  const tags = [
    industry && industry !== 'N/A' ? industry : null,
    country  && country  !== 'N/A' ? country  : null,
    employees != null ? `${(employees / 1000).toFixed(0)}K employees` : null,
  ].filter(Boolean) as string[]

  return (
    <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-slate-400 mb-3">
        Company Overview
      </p>

      {/* Description */}
      <p className="text-[13px] text-slate-600 leading-relaxed mb-1">
        {displayed}
      </p>
      {isLong && (
        <button
          onClick={() => setExpanded(e => !e)}
          className="text-[12px] font-semibold text-blue-600 hover:text-blue-700 transition-colors mb-3"
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
              className="text-[11px] font-medium text-slate-600 bg-slate-50 border border-slate-200 rounded-md px-2.5 py-1"
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
        className="inline-flex items-center gap-1.5 mt-3 text-[13px] font-semibold text-blue-600 hover:text-blue-700 transition-colors"
      >
        <Globe size={13} />
        View on Yahoo Finance →
      </a>
    </div>
  )
}
