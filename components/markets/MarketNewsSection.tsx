'use client'
import { ExternalLink } from 'lucide-react'
import type { NewsItem } from '@/app/api/markets/data/route'

const SOURCE_COLORS: Record<string, string> = {
  'Reuters':          'bg-orange-50 text-orange-700',
  'Reuters Finance':  'bg-orange-50 text-orange-700',
  'BBC Business':     'bg-red-50 text-red-700',
  'The Guardian':     'bg-blue-50 text-blue-700',
  'MarketWatch':      'bg-green-50 text-green-700',
  'MarketWatch RT':   'bg-green-50 text-green-700',
  'CNBC':             'bg-sky-50 text-sky-700',
  'CNBC Investing':   'bg-sky-50 text-sky-700',
  'Yahoo Finance':    'bg-violet-50 text-violet-700',
  'WSJ Markets':      'bg-slate-100 text-slate-600',
  'CNN Business':     'bg-red-50 text-red-700',
  'Investopedia':     'bg-teal-50 text-teal-700',
  "Barron's":         'bg-slate-100 text-slate-600',
  'Nasdaq':           'bg-blue-50 text-blue-700',
  'Forbes':           'bg-yellow-50 text-yellow-700',
  'TheStreet':        'bg-emerald-50 text-emerald-700',
  'Seeking Alpha':    'bg-indigo-50 text-indigo-700',
  'Motley Fool':      'bg-purple-50 text-purple-700',
  'Kiplinger':        'bg-cyan-50 text-cyan-700',
  'Business Insider': 'bg-pink-50 text-pink-700',
  'Zacks':            'bg-amber-50 text-amber-700',
  'Bloomberg':        'bg-slate-100 text-slate-700',
}

export default function MarketNewsSection({ news }: { news: NewsItem[] }) {
  if (!news.length) return null

  return (
    <div className="rounded-xl glass-card-light overflow-hidden">
      <div className="px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">Market News</span>
        <span className="text-[10px] text-slate-400 font-mono">{news.length} articles</span>
      </div>

      <div className="overflow-y-auto max-h-[600px] divide-y divide-slate-100">
        {news.map((item, i) => {
          const sourceCls = SOURCE_COLORS[item.source] ?? 'bg-slate-100 text-slate-600'
          const inner = (
            <div className="px-4 py-3 min-h-[44px] hover:bg-indigo-50/40 transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12.5px] font-medium text-slate-700 leading-snug line-clamp-2 flex-1 group-hover:text-slate-900">
                  {item.title}
                </p>
                {item.url && (
                  <ExternalLink
                    className="shrink-0 mt-0.5 w-3 h-3 text-slate-400 group-hover:text-slate-600 transition-colors"
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
