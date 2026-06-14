'use client'
import { ExternalLink } from 'lucide-react'
import type { NewsItem } from '@/app/api/markets/data/route'

// Extract the first $TICKER pattern from a headline
function extractTicker(title: string): string | null {
  const m = title.match(/\$([A-Z]{1,5})\b/)
  return m ? m[1] : null
}

// Extract bare ticker mentions like "NVDA", "AAPL" etc. from headlines
// Only match well-known patterns to avoid false positives
const COMMON_TICKERS = new Set([
  'NVDA','AAPL','MSFT','AMZN','GOOGL','GOOG','META','TSLA','AMD','PLTR',
  'MELI','JPM','BAC','V','NFLX','ORCL','CRM','AVGO','ASML','ADBE','QCOM',
  'MU','TSM','PYPL','INTC','SPY','QQQ','DIA','IWM','BRK','GS','MS',
  'BTC','ETH','USO','GLD','TLT','XLK','XLF','XLE','XLV','XLY',
])

function extractKnownTicker(title: string): string | null {
  const words = title.split(/[\s,.:;()[\]"'!?/\\]+/)
  for (const w of words) {
    const up = w.toUpperCase()
    if (COMMON_TICKERS.has(up)) return up
  }
  return null
}

export default function MarketNewsSection({ news }: { news: NewsItem[] }) {
  if (!news.length) return null
  const visible = news.slice(0, 8)

  return (
    <div className="bg-white rounded-xl border border-[#E5E5E5] shadow-sm overflow-hidden">
      <div className="divide-y divide-[#E3E1DA]">
        {visible.map((item, i) => {
          const ticker = extractTicker(item.title) ?? extractKnownTicker(item.title)

          const inner = (
            <div className="px-4 py-3 flex items-start gap-3 min-h-[52px] hover:bg-[#FAFAFA] transition-colors group">
              <div className="flex-1 min-w-0">
                <p className="text-[12.5px] font-medium text-[#111111] leading-snug line-clamp-1">
                  {item.title}
                </p>
                <div className="flex items-center gap-2 mt-0.5">
                  {ticker && (
                    <span className="text-[10px] font-[700] text-[#2563EB] bg-[#EAF1FF] border border-[#C7D9FC] px-1.5 py-0 rounded leading-5">
                      ${ticker}
                    </span>
                  )}
                  {item.source && (
                    <span className="text-[10px] font-semibold text-[#6B6B6B]">{item.source}</span>
                  )}
                  {item.time && (
                    <span className="text-[10px] text-[#9B9B9B] font-mono">{item.time}</span>
                  )}
                </div>
              </div>
              {item.url && (
                <ExternalLink size={11} className="text-[#9B9B9B] group-hover:text-[#6B6B6B] shrink-0 mt-1" />
              )}
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
