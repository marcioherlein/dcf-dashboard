'use client'
import { useState, useEffect } from 'react'

interface NewsItem { title: string; link: string; publisher: string; providerPublishTime: number }

export default function NewsPanel({ ticker }: { ticker: string }) {
  const [news, setNews] = useState<NewsItem[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/news?ticker=${ticker}`)
      .then((r) => r.json())
      .then((data) => { setNews(data); setLoading(false) })
      .catch(() => setLoading(false))
  }, [ticker])

  return (
    <div className="rounded-xl bg-surface-container-lowest dark:bg-[#111] shadow-card border border-outline-variant/10 dark:border-white/8 p-6">
      <h2 className="text-sm font-headline font-semibold text-on-surface dark:text-white/70">Latest News</h2>
      {loading ? (
        <p className="mt-4 text-sm text-gray-400 dark:text-white/25">Loading…</p>
      ) : news.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400 dark:text-white/25">No news found.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100 dark:divide-white/5">
          {news.map((item, i) => (
            <li key={i} className="py-3">
              <a href={item.link} target="_blank" rel="noreferrer" className="group block">
                <p className="text-sm font-medium leading-snug text-gray-800 transition group-hover:text-blue-600 dark:text-white/70 dark:group-hover:text-blue-400">
                  {item.title}
                </p>
                <div className="mt-1 flex gap-3 text-xs text-gray-400 dark:text-white/25">
                  <span>{item.publisher}</span>
                  <span>·</span>
                  <span>{new Date(item.providerPublishTime * 1000).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}</span>
                </div>
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
