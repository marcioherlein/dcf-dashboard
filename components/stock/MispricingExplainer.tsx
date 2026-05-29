'use client'

import { useEffect, useState } from 'react'
import { Sparkles } from 'lucide-react'

interface Props {
  ticker: string
  fairValue: number | null
  currentPrice: number
  upsidePct: number | null
  wacc: number | null
  cagr: number | null
  sector?: string
}

export default function MispricingExplainer({ ticker, fairValue, currentPrice, upsidePct, wacc, cagr, sector = '' }: Props) {
  const [text, setText] = useState<string | null>(null)
  const [loading, setLoading] = useState(false)
  const [tried, setTried] = useState(false)

  useEffect(() => {
    if (!fairValue || !currentPrice || tried) return
    setTried(true)
    setLoading(true)

    const params = new URLSearchParams({
      ticker,
      fv: String(fairValue),
      price: String(currentPrice),
      ...(upsidePct != null ? { upside: String(upsidePct) } : {}),
      ...(wacc != null ? { wacc: String(wacc) } : {}),
      ...(cagr != null ? { cagr: String(cagr) } : {}),
      ...(sector ? { sector } : {}),
    })

    fetch(`/api/explain?${params}`)
      .then(r => r.ok ? r.json() : null)
      .then(d => { if (d?.explanation) setText(d.explanation) })
      .catch(() => null)
      .finally(() => setLoading(false))
  }, [ticker, fairValue, currentPrice, upsidePct, wacc, cagr, sector, tried])

  if (!text && !loading) return null

  return (
    <div className="glass-card-light rounded-xl px-4 py-4 flex items-start gap-3">
      <div className="shrink-0 mt-0.5 w-7 h-7 rounded-full bg-violet-100 flex items-center justify-center">
        <Sparkles size={13} className="text-violet-600" />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-1.5">AI Insight</p>
        {loading ? (
          <div className="flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-violet-400 animate-pulse" />
            <span className="text-[13px] text-slate-400">Analysing…</span>
          </div>
        ) : (
          <p className="text-[13px] text-slate-700 leading-relaxed">{text}</p>
        )}
      </div>
    </div>
  )
}
