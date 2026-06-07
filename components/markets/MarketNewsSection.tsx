'use client'
import { ExternalLink } from 'lucide-react'
import type { NewsItem } from '@/app/api/markets/data/route'

export default function MarketNewsSection({ news }: { news: NewsItem[] }) {
  if (!news.length) return null
  const visible = news.slice(0, 6)

  return (
    <div className="bg-white rounded-xl border border-[#E3E1DA] shadow-sm overflow-hidden">
      <div className="divide-y divide-[#E3E1DA]">
        {visible.map((item, i) => {
          const inner = (
            <div className="px-4 py-3 flex items-center gap-3 min-h-[52px] hover:bg-indigo-50/30 transition-colors group">
              <p className="flex-1 text-[12.5px] font-medium text-[#06101F] leading-snug group-hover:text-[#06101F] line-clamp-1 min-w-0">
                {item.title}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {item.source && (
                  <span className="text-[10px] font-semibold text-[#566174] whitespace-nowrap">{item.source}</span>
                )}
                {item.time && (
                  <span className="text-[10px] text-[#8A95A6] font-mono whitespace-nowrap">{item.time}</span>
                )}
                {item.url && (
                  <ExternalLink size={11} className="text-[#8A95A6] group-hover:text-[#566174] transition-colors shrink-0" />
                )}
              </div>
            </div>
          )

          return item.url ? (
            <a key={i} href={item.url} target="_blank" rel="noopener noreferrer" className="block">
              {inner}
            </a>
          ) : (
            <div key={i}>{inner}</div>
          )
        })}
      </div>
    </div>
  )
}
