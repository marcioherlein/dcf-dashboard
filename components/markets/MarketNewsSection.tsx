'use client'
import type { NewsItem } from '@/app/api/markets/data/route'

export default function MarketNewsSection({ news }: { news: NewsItem[] }) {
  if (!news.length) return null
  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-3 py-2 border-b border-slate-100">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Market News</span>
      </div>
      <div className="divide-y divide-slate-50">
        {news.map((item, i) => (
          <div key={i} className="px-3 py-2.5 hover:bg-slate-50/60 transition-colors">
            <p className="text-[12px] font-medium text-slate-800 leading-snug line-clamp-2">{item.title}</p>
            <div className="flex items-center gap-2 mt-1">
              {item.source && (
                <span className="flex items-center gap-1 text-[10px] text-slate-400 font-medium">
                  <span className="w-1 h-1 rounded-full bg-slate-300" />
                  {item.source}
                </span>
              )}
              {item.time && <span className="text-[10px] text-slate-400">{item.time}</span>}
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
