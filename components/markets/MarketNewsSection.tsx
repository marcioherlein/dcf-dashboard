'use client'
import { ExternalLink } from 'lucide-react'
import type { NewsItem } from '@/app/api/markets/data/route'

const SOURCE_COLORS: Record<string, string> = {
  'Reuters':          'bg-orange-100 text-orange-700',
  'Reuters Finance':  'bg-orange-100 text-orange-700',
  'BBC Business':     'bg-red-100 text-red-700',
  'The Guardian':     'bg-blue-100 text-blue-700',
  'MarketWatch':      'bg-green-100 text-green-700',
  'MarketWatch RT':   'bg-green-100 text-green-700',
  'CNBC':             'bg-sky-100 text-sky-700',
  'CNBC Investing':   'bg-sky-100 text-sky-700',
  'Yahoo Finance':    'bg-violet-100 text-violet-700',
  'WSJ Markets':      'bg-slate-200 text-slate-700',
  'CNN Business':     'bg-red-100 text-red-700',
  'Investopedia':     'bg-teal-100 text-teal-700',
  "Barron's":         'bg-slate-200 text-slate-700',
  'Nasdaq':           'bg-blue-100 text-blue-700',
  'Forbes':           'bg-yellow-100 text-yellow-700',
  'TheStreet':        'bg-emerald-100 text-emerald-700',
  'Seeking Alpha':    'bg-indigo-100 text-indigo-700',
  'Motley Fool':      'bg-purple-100 text-purple-700',
  'Kiplinger':        'bg-cyan-100 text-cyan-700',
  'Business Insider': 'bg-pink-100 text-pink-700',
  'Zacks':            'bg-amber-100 text-amber-700',
  'Bloomberg':        'bg-black/10 text-slate-800',
}

export default function MarketNewsSection({ news }: { news: NewsItem[] }) {
  if (!news.length) return null

  return (
    <div className="rounded-xl bg-white border border-slate-200 overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-100 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Market News</span>
        <span className="text-[10px] text-slate-400 font-mono">{news.length} articles</span>
      </div>

      <div className="overflow-y-auto max-h-[600px] divide-y divide-slate-50">
        {news.map((item, i) => {
          const sourceCls = SOURCE_COLORS[item.source] ?? 'bg-slate-100 text-slate-600'
          const inner = (
            <div className="px-4 py-3 hover:bg-slate-50/70 transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12.5px] font-medium text-slate-800 leading-snug line-clamp-2 flex-1 group-hover:text-slate-900">
                  {item.title}
                </p>
                {item.url && (
                  <ExternalLink
                    className="shrink-0 mt-0.5 w-3 h-3 text-slate-300 group-hover:text-slate-500 transition-colors"
                  />
                )}
              </div>
              <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                {item.source && (
                  <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[9.5px] font-semibold leading-none ${sourceCls}`}>
                    {item.source}
                  </span>
                )}
                {item.time && (
                  <span className="text-[10px] text-slate-400 font-mono">{item.time}</span>
                )}
              </div>
            </div>
          )

          return item.url ? (
            <a
              key={i}
              href={item.url}
              target="_blank"
              rel="noopener noreferrer"
              className="block"
            >
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
