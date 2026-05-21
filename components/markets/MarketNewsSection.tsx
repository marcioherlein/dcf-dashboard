'use client'
import { ExternalLink } from 'lucide-react'
import type { NewsItem } from '@/app/api/markets/data/route'

const SOURCE_COLORS: Record<string, string> = {
  'Reuters':          'bg-orange-500/20 text-orange-300',
  'Reuters Finance':  'bg-orange-500/20 text-orange-300',
  'BBC Business':     'bg-red-500/20 text-red-300',
  'The Guardian':     'bg-blue-500/20 text-blue-300',
  'MarketWatch':      'bg-green-500/20 text-green-300',
  'MarketWatch RT':   'bg-green-500/20 text-green-300',
  'CNBC':             'bg-sky-500/20 text-sky-300',
  'CNBC Investing':   'bg-sky-500/20 text-sky-300',
  'Yahoo Finance':    'bg-violet-500/20 text-violet-300',
  'WSJ Markets':      'bg-white/10 text-slate-300',
  'CNN Business':     'bg-red-500/20 text-red-300',
  'Investopedia':     'bg-teal-500/20 text-teal-300',
  "Barron's":         'bg-white/10 text-slate-300',
  'Nasdaq':           'bg-blue-500/20 text-blue-300',
  'Forbes':           'bg-yellow-500/20 text-yellow-300',
  'TheStreet':        'bg-emerald-500/20 text-emerald-300',
  'Seeking Alpha':    'bg-indigo-500/20 text-indigo-300',
  'Motley Fool':      'bg-purple-500/20 text-purple-300',
  'Kiplinger':        'bg-cyan-500/20 text-cyan-300',
  'Business Insider': 'bg-pink-500/20 text-pink-300',
  'Zacks':            'bg-amber-500/20 text-amber-300',
  'Bloomberg':        'bg-white/10 text-slate-200',
}

export default function MarketNewsSection({ news }: { news: NewsItem[] }) {
  if (!news.length) return null

  return (
    <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] overflow-hidden">
      <div className="px-4 py-2.5 border-b border-white/10 flex items-center justify-between">
        <span className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">Market News</span>
        <span className="text-[10px] text-slate-400 font-mono">{news.length} articles</span>
      </div>

      <div className="overflow-y-auto max-h-[600px] divide-y divide-white/8">
        {news.map((item, i) => {
          const sourceCls = SOURCE_COLORS[item.source] ?? 'bg-white/8 text-slate-400'
          const inner = (
            <div className="px-4 py-3 hover:bg-white/5 transition-colors group">
              <div className="flex items-start justify-between gap-2">
                <p className="text-[12.5px] font-medium text-slate-200 leading-snug line-clamp-2 flex-1 group-hover:text-slate-100">
                  {item.title}
                </p>
                {item.url && (
                  <ExternalLink
                    className="shrink-0 mt-0.5 w-3 h-3 text-slate-500 group-hover:text-slate-300 transition-colors"
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
