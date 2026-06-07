'use client'
import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { stagger } from '@/lib/motion'

interface NewsItem { title: string; link: string; publisher: string; providerPublishTime: number }

type Sentiment = 'Bullish' | 'Bearish' | 'Earnings' | 'Guidance' | 'Upgrade' | 'Downgrade' | 'Neutral'

const SENTIMENT_RULES: Array<{ pattern: RegExp; label: Sentiment }> = [
  { pattern: /upgrad|outperform|buy rating|target raise|price target.*(raise|increas|hike|lift|up)/i, label: 'Upgrade' },
  { pattern: /downgrad|underperform|sell rating|target (cut|lower|decreas|reduc)/i, label: 'Downgrade' },
  { pattern: /earnings?|eps|quarter(ly)?|profit|revenue\s*(beat|miss|top|top|exceed|surpass)/i, label: 'Earnings' },
  { pattern: /guidance|outlook|forecast|forward.*(revenue|eps|guidance)/i, label: 'Guidance' },
  { pattern: /beat|surpass|record|strong|solid|exceed|rally|jump|soar|surge|bull|optimis/i, label: 'Bullish' },
  { pattern: /miss|warning|slump|plunge|fall|decline|weak|disapp|concern|bear|pessim|layoff|cut|worr/i, label: 'Bearish' },
]

const SENTIMENT_STYLE: Record<Sentiment, { badge: string; card: string; dot: string }> = {
  Bullish:   { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', card: 'border-emerald-200 bg-emerald-50/25', dot: 'bg-emerald-400' },
  Bearish:   { badge: 'bg-red-50 text-red-600 border-red-200',             card: 'border-red-200 bg-red-50/25',        dot: 'bg-red-400' },
  Earnings:  { badge: 'bg-blue-50 text-blue-700 border-blue-200',          card: 'border-blue-200 bg-blue-50/20',      dot: 'bg-blue-400' },
  Guidance:  { badge: 'bg-violet-50 text-violet-700 border-violet-200',    card: 'border-violet-200 bg-violet-50/20',  dot: 'bg-violet-400' },
  Upgrade:   { badge: 'bg-emerald-50 text-emerald-700 border-emerald-200', card: 'border-emerald-200 bg-emerald-50/25',dot: 'bg-emerald-500' },
  Downgrade: { badge: 'bg-orange-50 text-orange-700 border-orange-200',    card: 'border-orange-200 bg-orange-50/20',  dot: 'bg-orange-400' },
  Neutral:   { badge: 'bg-slate-100 text-slate-500 border-slate-200',      card: 'border-slate-200 bg-white',          dot: 'bg-slate-300' },
}

// Stable color for publisher initial avatar (hashed from publisher name)
function publisherColor(name: string): string {
  const palette = ['bg-blue-100 text-blue-700', 'bg-violet-100 text-violet-700', 'bg-amber-100 text-amber-700',
    'bg-emerald-100 text-emerald-700', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700',
    'bg-indigo-100 text-indigo-700', 'bg-orange-100 text-orange-700']
  let h = 0
  for (let i = 0; i < name.length; i++) h = (h * 31 + name.charCodeAt(i)) & 0xffff
  return palette[h % palette.length]
}

function classify(title: string): Sentiment {
  for (const { pattern, label } of SENTIMENT_RULES) {
    if (pattern.test(title)) return label
  }
  return 'Neutral'
}

function formatTime(epochSeconds: number): { relative: string; absolute: string; isNew: boolean } {
  const diff = Math.floor(Date.now() / 1000) - epochSeconds
  const isNew = diff < 21600 // 6 hours
  let relative: string
  if (diff < 60)     relative = 'Just now'
  else if (diff < 3600)  relative = `${Math.floor(diff / 60)}m ago`
  else if (diff < 86400) relative = `${Math.floor(diff / 3600)}h ago`
  else if (diff < 604800) relative = `${Math.floor(diff / 86400)}d ago`
  else relative = new Date(epochSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
  const absolute = new Date(epochSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: diff > 86400 * 365 ? 'numeric' : undefined })
  return { relative, absolute, isNew }
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-white px-4 py-4 motion-safe:animate-pulse min-h-[88px]">
      <div className="h-4 bg-slate-200 rounded w-4/5 mb-1.5" />
      <div className="h-3.5 bg-slate-200 rounded w-3/5 mb-3" />
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 bg-slate-200 rounded-full" />
        <div className="h-3.5 w-24 bg-slate-200 rounded" />
        <div className="h-5 w-14 bg-slate-200 rounded-full ml-auto" />
      </div>
    </div>
  )
}

const FILTERS: Array<{ label: string; sentiment: Sentiment | null }> = [
  { label: 'All', sentiment: null },
  { label: 'Bullish', sentiment: 'Bullish' },
  { label: 'Bearish', sentiment: 'Bearish' },
  { label: 'Earnings', sentiment: 'Earnings' },
  { label: 'Upgrades', sentiment: 'Upgrade' },
  { label: 'Downgrades', sentiment: 'Downgrade' },
]

export default function NewsPanel({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const [filter, setFilter] = useState<Sentiment | null>(null)
  const reduced = useReducedMotion()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/news?ticker=${ticker}`)
      .then((r) => r.json())
      .then((data) => { setNews(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  const tagged = news.map(item => ({ ...item, sentiment: classify(item.title) }))
  const filtered = filter ? tagged.filter(item => item.sentiment === filter) : tagged

  const counts = FILTERS.slice(1).reduce<Record<string, number>>((acc, f) => {
    if (f.sentiment) acc[f.sentiment] = tagged.filter(i => i.sentiment === f.sentiment).length
    return acc
  }, {})

  return (
    <div className="rounded-xl card px-4 py-4 sm:p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-[15px] font-bold text-slate-900">Latest News</h2>
        <span className="text-[12px] text-slate-400 font-mono">{ticker}</span>
      </div>

      {/* Filter chips */}
      {!loading && news.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mb-4">
          {FILTERS.map(f => {
            const count = f.sentiment ? counts[f.sentiment] ?? 0 : news.length
            if (f.sentiment && count === 0) return null
            const active = filter === f.sentiment
            const style = f.sentiment ? SENTIMENT_STYLE[f.sentiment] : null
            return (
              <button
                key={f.label}
                onClick={() => setFilter(active ? null : f.sentiment)}
                className={`inline-flex items-center gap-1.5 text-[11px] font-semibold px-2.5 py-1 rounded-full border transition-colors ${
                  active
                    ? (style ? style.badge + ' border' : 'bg-slate-800 text-white border-slate-800')
                    : 'bg-white text-slate-500 border-slate-200 hover:border-slate-300 hover:text-slate-700'
                }`}
              >
                {style && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? style.dot : 'bg-slate-300'}`} />}
                {f.label}
                {count > 0 && count !== news.length ? <span className="opacity-70">({count})</span> : ''}
              </button>
            )
          })}
        </div>
      )}

      {loading ? (
        <div className="space-y-2.5">
          {[1, 2, 3].map(i => <SkeletonCard key={i} />)}
        </div>
      ) : news.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-12 text-center">
          <div className="w-10 h-10 rounded-full bg-slate-100 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-slate-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-slate-500">No recent news</p>
          <p className="text-[12px] text-slate-400 mt-1">Check back later for updates</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-slate-400 text-center py-8">No {filter} articles in the last batch.</p>
      ) : (
        <motion.div
          className="space-y-2.5"
          initial="hidden"
          animate="visible"
          variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } }}
        >
          {filtered.map((item, i) => {
            const { relative, absolute, isNew } = formatTime(item.providerPublishTime)
            const sentStyle = SENTIMENT_STYLE[item.sentiment]
            const pubInitial = item.publisher.charAt(0).toUpperCase()
            const pubColor = publisherColor(item.publisher)
            return (
              <motion.a
                key={i}
                href={item.link}
                target="_blank"
                rel="noreferrer"
                variants={reduced ? {} : stagger.item}
                className={`group block rounded-xl border px-4 py-3.5 hover:border-blue-200 hover:bg-blue-50/30 transition-all ${sentStyle.card}`}
              >
                {/* Title row */}
                <p className="text-[13.5px] font-semibold leading-snug text-slate-800 group-hover:text-blue-700 transition-colors mb-2.5 line-clamp-2">
                  {item.title}
                </p>

                {/* Meta row */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* Publisher initial avatar */}
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${pubColor}`}>
                    {pubInitial}
                  </span>

                  {/* Publisher name */}
                  <span className="text-[11.5px] text-slate-600 font-medium truncate max-w-[120px] sm:max-w-[180px]">
                    {item.publisher}
                  </span>

                  {/* Time */}
                  <span className="text-[11px] text-slate-400 shrink-0 tabular-nums">
                    {relative !== absolute ? `${relative} · ${absolute}` : relative}
                  </span>

                  <div className="flex items-center gap-1.5 ml-auto shrink-0">
                    {/* New badge */}
                    {isNew && (
                      <span className="text-[10px] font-bold uppercase tracking-wider px-1.5 py-0.5 rounded bg-olive-700 text-white leading-none">
                        New
                      </span>
                    )}
                    {/* Sentiment badge */}
                    {item.sentiment !== 'Neutral' && (
                      <span className={`text-[10px] font-semibold px-2 py-0.5 rounded-full border ${sentStyle.badge}`}>
                        {item.sentiment}
                      </span>
                    )}
                    {/* External link icon */}
                    <svg
                      className="w-3.5 h-3.5 text-slate-300 group-hover:text-blue-400 transition-colors"
                      fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                    </svg>
                  </div>
                </div>
              </motion.a>
            )
          })}
        </motion.div>
      )}
    </div>
  )
}
