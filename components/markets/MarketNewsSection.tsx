'use client'
import { ExternalLink } from 'lucide-react'
import type { NewsItem } from '@/app/api/markets/data/route'

export default function MarketNewsSection({ news }: { news: NewsItem[] }) {
  if (!news.length) return null
  const visible = news.slice(0, 6)

  return (
    <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
      <div className="divide-y divide-slate-100">
        {visible.map((item, i) => {
          const inner = (
            <div className="px-4 py-3 flex items-center gap-3 min-h-[52px] hover:bg-indigo-50/30 transition-colors group">
              <p className="flex-1 text-[12.5px] font-medium text-slate-700 leading-snug group-hover:text-slate-900 line-clamp-1 min-w-0">
                {item.title}
              </p>
              <div className="flex items-center gap-2 shrink-0">
                {item.source && (
                  <span className="text-[10px] font-semibold text-slate-500 whitespace-nowrap">{item.source}</span>
                )}
                {item.time && (
                  <span className="text-[10px] text-slate-400 font-mono whitespace-nowrap">{item.time}</span>
                )}
                {item.url && (
                  <ExternalLink size={11} className="text-slate-300 group-hover:text-slate-500 transition-colors shrink-0" />
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
