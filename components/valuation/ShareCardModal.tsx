'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Download, Share2, Check, Twitter, Instagram, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import type { CockpitOutput } from '@/lib/valuation/cockpit'

interface Props {
  open: boolean
  onClose: () => void
  ticker: string
  companyName: string
  output: CockpitOutput
  currentPrice: number
  currency: string
}

type Format = 'landscape' | 'square'

function buildUrl(base: string, params: Record<string, string | number | null | undefined>): string {
  const u = new URLSearchParams()
  for (const [k, v] of Object.entries(params)) {
    if (v != null && v !== '') u.set(k, String(v))
  }
  return `${base}?${u.toString()}`
}

const CONVICTION_MAP: Record<string, string> = {
  high:   'High confidence',
  medium: 'Moderate confidence',
  low:    'Low confidence',
}

export default function ShareCardModal({ open, onClose, ticker, companyName, output, currentPrice, currency }: Props) {
  const [format, setFormat] = useState<Format>('landscape')
  const [copying, setCopying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [imgLoading, setImgLoading] = useState(true)
  const [imgError, setImgError] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Serialize top-3 valid methods for the model consensus panel
  const methodsParam = (() => {
    const valid = output.methods
      .filter(m => m.fairValue != null && m.fairValue > 0)
      .slice(0, 3)
      .map(m => ({ label: m.method, fv: m.fairValue as number }))
    return valid.length > 0 ? encodeURIComponent(JSON.stringify(valid)) : undefined
  })()

  // Base params shared across both formats
  const baseParams = {
    ticker,
    name: companyName,
    price: currentPrice,
    fv:     output.blendedFairValue ?? 'none',
    upside: output.upsidePct        ?? 'none',
    bear: output.scenarios.bear.fairValue,
    bull: output.scenarios.bull.fairValue,
    currency,
    verdict: output.verdict,
    conviction: CONVICTION_MAP[output.divergence.overallConfidence] ?? '',
    methods: methodsParam,
    mig: output.marketImpliedGrowth ?? undefined,
    migAssumed: output.scenarios.base.cagr ?? undefined,
  }

  const landscapeUrl = buildUrl('/api/og', baseParams)
  const squareUrl    = buildUrl('/api/og/square', baseParams)
  const previewUrl   = format === 'landscape' ? landscapeUrl : squareUrl

  // Reset image state when URL changes
  useEffect(() => {
    setImgLoading(true)
    setImgError(false)
  }, [previewUrl])

  // Native dialog open/close
  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) {
      d.showModal()
    } else if (!open && d.open) {
      d.close()
    }
  }, [open])

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = dialogRef.current?.getBoundingClientRect()
    if (!rect) return
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) {
      onClose()
    }
  }

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(previewUrl)
      if (!res.ok) throw new Error(`Image generation failed (${res.status})`)
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${ticker.toLowerCase()}-valuation-${format}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch {
      // surface nothing — user sees no change, can retry
    } finally {
      setDownloading(false)
    }
  }

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const res = await fetch(previewUrl)
        if (!res.ok) throw new Error('fetch failed')
        const blob = await res.blob()
        const file = new File([blob], `${ticker.toLowerCase()}-valuation.png`, { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], title: `${ticker} Valuation — Insic`, text: `${ticker} looks ${output.verdict} — check the analysis on Insic.` })
          return
        }
      } catch { /* fall through */ }
    }
    try {
      await navigator.clipboard.writeText(`https://insic.app/stock/${ticker}`)
      setCopying(true)
      setTimeout(() => setCopying(false), 2000)
    } catch { /* ignore */ }
  }

  const aspectClass = format === 'landscape' ? 'aspect-[1200/630]' : 'aspect-square'

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdrop}
      onClose={onClose}
      className="p-0 rounded-2xl border-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm max-w-[600px] w-[calc(100vw-32px)] outline-none"
    >
      <div className="flex flex-col bg-white rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3E1DA]">
          <div>
            <p className="text-[13px] font-[700] text-[#06101F]">Share valuation card</p>
            <p className="text-[11px] text-[#8A95A6] mt-0.5">Download an image to post on Twitter, Instagram, or WhatsApp</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center rounded-full text-[#8A95A6] hover:text-[#06101F] hover:bg-[#E3E1DA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            <X size={14} />
          </button>
        </div>

        {/* Format picker */}
        <div className="flex items-center gap-2 px-5 pt-4">
          <button
            onClick={() => setFormat('landscape')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-[600] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              format === 'landscape'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-[#E3E1DA] text-[#566174] hover:border-[#93B4F5] hover:text-[#2563EB]'
            )}
          >
            <Twitter size={12} />
            Twitter / LinkedIn
            <span className="text-[10px] opacity-60 font-normal">1200×630</span>
          </button>
          <button
            onClick={() => setFormat('square')}
            className={cn(
              'flex items-center gap-2 px-3 py-1.5 rounded-lg border text-[12px] font-[600] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500',
              format === 'square'
                ? 'bg-blue-600 border-blue-600 text-white'
                : 'bg-white border-[#E3E1DA] text-[#566174] hover:border-[#93B4F5] hover:text-[#2563EB]'
            )}
          >
            <Instagram size={12} />
            Instagram / WhatsApp
            <span className="text-[10px] opacity-60 font-normal">1080×1080</span>
          </button>
        </div>

        {/* Preview */}
        <div className="px-5 pt-3 pb-4">
          <div className={cn('w-full rounded-xl overflow-hidden border border-[#E3E1DA] bg-[#F4F3EF] relative', aspectClass)}>
            {/* Loading skeleton */}
            {imgLoading && !imgError && (
              <div className="absolute inset-0 bg-[#E3E1DA] animate-pulse rounded-xl" />
            )}
            {/* Error state */}
            {imgError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#F4F3EF]">
                <AlertCircle size={20} className="text-[#8A95A6]" />
                <p className="text-[12px] text-[#8A95A6]">Preview unavailable</p>
                <p className="text-[11px] text-[#8A95A6]">The image will still download correctly</p>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={previewUrl}
              src={previewUrl}
              alt={`${ticker} valuation card preview`}
              className={cn('w-full h-full object-cover transition-opacity duration-300', imgLoading || imgError ? 'opacity-0' : 'opacity-100')}
              onLoad={() => { setImgLoading(false); setImgError(false) }}
              onError={() => { setImgLoading(false); setImgError(true) }}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 pb-5">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-[650] bg-[#2563EB] text-white hover:bg-[#1D4ED8] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-blue-600"
          >
            <Download size={14} />
            {downloading ? 'Downloading…' : 'Download image'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-[13px] font-[650] border border-[#E3E1DA] bg-white text-[#06101F] hover:bg-[#F4F3EF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-1"
          >
            {copying ? <Check size={14} className="text-[#11875D]" /> : <Share2 size={14} />}
            {copying ? 'Link copied' : 'Share'}
          </button>
        </div>

      </div>
    </dialog>
  )
}
