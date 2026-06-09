'use client'
import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { stagger } from '@/lib/motion'

interface NewsItem { title: string; link: string; publisher: string; providerPublishTime: number }

type Sentiment = 'Bullish' | 'Bearish' | 'Earnings' | 'Guidance' | 'Upgrade' | 'Downgrade' | 'Neutral'

const SENTIMENT_CONFIG: Array<{
  pattern: RegExp
  label: Sentiment
  badge: string
  card: string
  dot: string
}> = [
  { pattern: /upgrad|outperform|buy rating|target raise|price target.*(raise|increas|hike|lift|up)/i, label: 'Upgrade',   badge: 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]', card: 'border-[#A3D9BE] bg-[#E8F7EF]/25', dot: 'bg-[#E8F7EF]0' },
  { pattern: /downgrad|underperform|sell rating|target (cut|lower|decreas|reduc)/i,                   label: 'Downgrade', badge: 'bg-orange-50 text-orange-700 border-orange-200',    card: 'border-orange-200 bg-orange-50/20',  dot: 'bg-orange-400' },
  { pattern: /earnings?|eps|quarter(ly)?|profit|revenue\s*(beat|miss|top|top|exceed|surpass)/i,       label: 'Earnings',  badge: 'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]',      card: 'border-[#93B4F5] bg-[#EAF1FF]/20',  dot: 'bg-blue-400' },
  { pattern: /guidance|outlook|forecast|forward.*(revenue|eps|guidance)/i,                            label: 'Guidance',  badge: 'bg-violet-50 text-violet-700 border-violet-200',      card: 'border-violet-200 bg-violet-50/20', dot: 'bg-violet-400' },
  { pattern: /beat|surpass|record|strong|solid|exceed|rally|jump|soar|surge|bull|optimis/i,           label: 'Bullish',   badge: 'bg-[#E8F7EF] text-[#11875D] border-[#A3D9BE]',      card: 'border-[#A3D9BE] bg-[#E8F7EF]/25',  dot: 'bg-[#11875D]' },
  { pattern: /miss|warning|slump|plunge|fall|decline|weak|disapp|concern|bear|pessim|layoff|cut|worr/i, label: 'Bearish', badge: 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]',      card: 'border-[#F0B8B8] bg-[#FCEAEA]/25',  dot: 'bg-[#D83B3B]' },
]

const NEUTRAL_STYLE = { badge: 'bg-[#F4F3EF] text-[#566174] border-[#E3E1DA]', card: 'border-[#E3E1DA] bg-white', dot: 'bg-[#CDD1C8]' }

// Thin shims for call sites expecting the old structures
const SENTIMENT_RULES = SENTIMENT_CONFIG.map(({ pattern, label }) => ({ pattern, label }))
const SENTIMENT_STYLE: Record<Sentiment, { badge: string; card: string; dot: string }> = Object.fromEntries(
  [...SENTIMENT_CONFIG.map(({ label, badge, card, dot }) => [label, { badge, card, dot }]),
   ['Neutral', NEUTRAL_STYLE]]
) as Record<Sentiment, { badge: string; card: string; dot: string }>

// Stable color for publisher initial avatar (hashed from publisher name)
function publisherColor(name: string): string {
  const palette = ['bg-[#EAF1FF] text-[#2563EB]', 'bg-violet-100 text-violet-700', 'bg-[#FFF4DA] text-[#B56A00]',
    'bg-[#E8F7EF] text-[#11875D]', 'bg-rose-100 text-rose-700', 'bg-cyan-100 text-cyan-700',
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
    <div className="rounded-xl border border-[#E3E1DA] bg-white px-4 py-4 motion-safe:animate-pulse min-h-[88px]">
      <div className="h-4 bg-[#E3E1DA] rounded w-4/5 mb-1.5" />
      <div className="h-3.5 bg-[#E3E1DA] rounded w-3/5 mb-3" />
      <div className="flex items-center gap-2">
        <div className="h-5 w-5 bg-[#E3E1DA] rounded-full" />
        <div className="h-3.5 w-24 bg-[#E3E1DA] rounded" />
        <div className="h-5 w-14 bg-[#E3E1DA] rounded-full ml-auto" />
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
        <h2 className="text-[15px] font-bold text-[#06101F]">Latest News</h2>
        <span className="text-[12px] text-[#8A95A6] font-mono">{ticker}</span>
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
                    : 'bg-white text-[#566174] border-[#E3E1DA] hover:border-[#CDD1C8] hover:text-[#06101F]'
                }`}
              >
                {style && <span className={`w-1.5 h-1.5 rounded-full shrink-0 ${active ? style.dot : 'bg-[#CDD1C8]'}`} />}
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
          <div className="w-10 h-10 rounded-full bg-[#F4F3EF] flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-[#8A95A6]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 7.5h1.5m-1.5 3h1.5m-7.5 3h7.5m-7.5 3h7.5m3-9h3.375c.621 0 1.125.504 1.125 1.125V18a2.25 2.25 0 0 1-2.25 2.25M16.5 7.5V18a2.25 2.25 0 0 0 2.25 2.25M16.5 7.5V4.875c0-.621-.504-1.125-1.125-1.125H4.125C3.504 3.75 3 4.254 3 4.875V18a2.25 2.25 0 0 0 2.25 2.25h13.5M6 7.5h3v3H6v-3Z" />
            </svg>
          </div>
          <p className="text-[14px] font-medium text-[#566174]">No recent news</p>
          <p className="text-[12px] text-[#8A95A6] mt-1">Check back later for updates</p>
        </div>
      ) : filtered.length === 0 ? (
        <p className="text-[13px] text-[#8A95A6] text-center py-8">No {filter} articles in the last batch.</p>
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
                className={`group block rounded-xl border px-4 py-3.5 hover:border-[#93B4F5] hover:bg-[#EAF1FF]/30 transition-all ${sentStyle.card}`}
              >
                {/* Title row */}
                <p className="text-[13.5px] font-semibold leading-snug text-[#06101F] group-hover:text-[#2563EB] transition-colors mb-2.5 line-clamp-2">
                  {item.title}
                </p>

                {/* Meta row */}
                <div className="flex items-center gap-2 min-w-0">
                  {/* Publisher initial avatar */}
                  <span className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0 ${pubColor}`}>
                    {pubInitial}
                  </span>

                  {/* Publisher name */}
                  <span className="text-[11.5px] text-[#566174] font-medium truncate max-w-[120px] sm:max-w-[180px]">
                    {item.publisher}
                  </span>

                  {/* Time */}
                  <span className="text-[11px] text-[#8A95A6] shrink-0 tabular-nums">
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
                      className="w-3.5 h-3.5 text-[#8A95A6] group-hover:text-[#2563EB] transition-colors"
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
