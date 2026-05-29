'use client'
import { useState, useEffect } from 'react'
import { motion, useReducedMotion } from 'motion/react'
import { stagger } from '@/lib/motion'

interface NewsItem { title: string; link: string; publisher: string; providerPublishTime: number }

function relativeTime(epochSeconds: number): string {
  const diff = Math.floor(Date.now() / 1000) - epochSeconds
  if (diff < 60)     return 'Just now'
  if (diff < 3600)   return `${Math.floor(diff / 60)}m ago`
  if (diff < 86400)  return `${Math.floor(diff / 3600)}h ago`
  if (diff < 604800) return `${Math.floor(diff / 86400)}d ago`
  return new Date(epochSeconds * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function SkeletonCard() {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-4 animate-pulse min-h-[80px]">
      <div className="h-4 bg-slate-200 rounded w-3/4 mb-2" />
      <div className="h-3.5 bg-slate-200 rounded w-1/2 mb-3" />
      <div className="flex gap-2">
        <div className="h-5 w-20 bg-slate-200 rounded-full" />
        <div className="h-5 w-14 bg-slate-200 rounded-full" />
      </div>
    </div>
  )
}

export default function NewsPanel({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)
  const reduced = useReducedMotion()

  useEffect(() => {
    setLoading(true)
    fetch(`/api/news?ticker=${ticker}`)
      .then((r) => r.json())
      .then((data) => { setNews(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  return (
    <div className="rounded-xl card px-4 py-4 sm:p-6">
      <div className="flex items-center justify-between mb-4 sm:mb-5">
        <h2 className="text-[15px] font-semibold text-slate-900">Latest News</h2>
        <span className="text-[12px] text-slate-400 font-mono">{ticker}</span>
      </div>

      {loading ? (
        <div className="space-y-3">
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
      ) : (
        <motion.div
          className="space-y-3"
          initial="hidden"
          animate="visible"
          variants={reduced ? {} : { visible: { transition: { staggerChildren: 0.06, delayChildren: 0.05 } } }}
        >
          {news.map((item, i) => (
            <motion.a
              key={i}
              href={item.link}
              target="_blank"
              rel="noreferrer"
              variants={reduced ? {} : stagger.item}
              className="group block rounded-xl border border-slate-200 bg-white px-4 py-4 min-h-[80px] hover:border-blue-300 hover:bg-slate-50 transition-all"
            >
              <p className="text-[14px] font-semibold leading-snug text-slate-800 group-hover:text-blue-600 transition-colors mb-2.5 line-clamp-2">
                {item.title}
              </p>
              <div className="flex items-center gap-2 min-w-0">
                <span className="rounded-full bg-slate-100 text-slate-600 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide truncate max-w-[140px] sm:max-w-none">
                  {item.publisher}
                </span>
                <span className="text-[11px] text-slate-400 shrink-0">
                  {relativeTime(item.providerPublishTime)}
                </span>
                <svg
                  className="w-3.5 h-3.5 text-slate-400 group-hover:text-blue-500 transition-colors ml-auto shrink-0"
                  fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 6H5.25A2.25 2.25 0 0 0 3 8.25v10.5A2.25 2.25 0 0 0 5.25 21h10.5A2.25 2.25 0 0 0 18 18.75V10.5m-10.5 6L21 3m0 0h-5.25M21 3v5.25" />
                </svg>
              </div>
            </motion.a>
          ))}
        </motion.div>
      )}
    </div>
  )
}
