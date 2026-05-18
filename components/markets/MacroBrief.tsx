'use client'
import { useState } from 'react'
import type { MarketContextPayload, MacroSignalTile } from '@/lib/market-context/types'

interface Props {
  macroBrief: string | null
  briefCachedAt: string | null
  signals: MarketContextPayload['signals']
  pulse: MarketContextPayload['pulse']
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3600000)
  const m = Math.floor((diff % 3600000) / 60000)
  if (h > 0) return `${h}h ago`
  return `${m}m ago`
}

export default function MacroBrief({ macroBrief, briefCachedAt, signals, pulse }: Props) {
  const [text, setText] = useState(macroBrief)
  const [cachedAt, setCachedAt] = useState(briefCachedAt)
  const [loading, setLoading] = useState(false)

  async function generate() {
    setLoading(true)
    try {
      const res = await fetch('/api/market-context/brief', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ signals, pulse }),
      })
      const data = await res.json()
      if (data.brief) {
        setText(data.brief)
        setCachedAt(data.cachedAt)
      }
    } catch {
      // silently fail
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <h2 className="text-sm font-bold text-slate-900">Macro Brief</h2>
        {cachedAt && <span className="text-[10px] text-slate-400">Updated {timeAgo(cachedAt)}</span>}
      </div>
      {text ? (
        <p className="text-sm text-slate-600 leading-relaxed">{text}</p>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-400 italic">AI analysis not yet generated for this regime.</p>
          <button
            onClick={generate}
            disabled={loading}
            className="shrink-0 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50"
            style={{ background: '#0F2A5E' }}
          >
            {loading ? 'Generating…' : 'Generate'}
          </button>
        </div>
      )}
    </div>
  )
}
