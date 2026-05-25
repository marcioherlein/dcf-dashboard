'use client'
import { useState } from 'react'
import { Lock } from 'lucide-react'
import Link from 'next/link'
import type { MarketContextPayload } from '@/lib/market-context/types'
import { useFeatureGate } from '@/lib/monetization/featureGates'

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
  const { allowed } = useFeatureGate('macro_brief')

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

  // Split text into first sentence (free preview) and remainder (Pro)
  const firstSentenceEnd = text ? text.search(/[.!?]\s/) : -1
  const preview = text && firstSentenceEnd > 0 ? text.slice(0, firstSentenceEnd + 1) : text
  const remainder = text && firstSentenceEnd > 0 ? text.slice(firstSentenceEnd + 2) : null

  return (
    <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] px-5 py-4">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <h2 className="text-sm font-bold text-slate-100">Macro Brief</h2>
          {!allowed && (
            <span className="inline-flex items-center gap-1 text-[9px] px-1.5 py-0.5 rounded-full bg-blue-500/20 text-blue-300 font-bold border border-blue-500/30">
              <Lock size={8} /> PRO
            </span>
          )}
        </div>
        {cachedAt && <span className="text-[10px] text-slate-400">Updated {timeAgo(cachedAt)}</span>}
      </div>

      {text ? (
        <div>
          <p className="text-sm text-slate-300 leading-relaxed">{preview}</p>
          {remainder && (
            allowed ? (
              <p className="text-sm text-slate-300 leading-relaxed mt-2">{remainder}</p>
            ) : (
              <div className="relative mt-2">
                <p className="text-sm text-slate-300 leading-relaxed blur-sm select-none" aria-hidden>
                  {remainder}
                </p>
                <div className="absolute inset-0 flex items-center justify-center">
                  <Link
                    href="/pricing"
                    className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-blue-600 hover:bg-blue-500 text-white text-xs font-bold transition-colors shadow-lg"
                  >
                    <Lock size={11} /> Unlock full brief — Pro
                  </Link>
                </div>
              </div>
            )
          )}
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <p className="text-sm text-slate-400 italic">AI analysis not yet generated for this regime.</p>
          {allowed ? (
            <button
              onClick={generate}
              disabled={loading}
              className="shrink-0 text-xs font-semibold text-white px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 bg-blue-600 hover:bg-blue-500"
            >
              {loading ? 'Generating…' : 'Generate'}
            </button>
          ) : (
            <Link
              href="/pricing"
              className="shrink-0 inline-flex items-center gap-1 text-xs font-semibold text-blue-400 hover:text-blue-300 transition-colors"
            >
              <Lock size={11} /> Upgrade for full brief
            </Link>
          )}
        </div>
      )}
    </div>
  )
}
