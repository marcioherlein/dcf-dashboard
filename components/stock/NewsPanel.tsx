'use client'
import { useState, useEffect } from 'react'

interface NewsItem {
  title: string
  link: string
  publisher: string
  providerPublishTime: number
}

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
    <div className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <h2 className="text-sm font-semibold text-gray-700">Latest News</h2>
      {loading ? (
        <p className="mt-4 text-sm text-gray-400">Loading…</p>
      ) : news.length === 0 ? (
        <p className="mt-4 text-sm text-gray-400">No news found.</p>
      ) : (
        <ul className="mt-4 divide-y divide-gray-100">
          {news.map((item, i) => (
            <li key={i} className="py-3">
              <a href={item.link} target="_blank" rel="noreferrer" className="group block">
                <p className="text-sm font-medium text-gray-800 group-hover:text-blue-600 leading-snug">{item.title}</p>
                <div className="mt-1 flex gap-3 text-xs text-gray-400">
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
