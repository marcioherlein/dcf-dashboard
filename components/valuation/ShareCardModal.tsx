'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Download, Share2, Check, Twitter, Instagram, Smartphone, AlertCircle } from 'lucide-react'
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
  // Conviction / checklist data from InvestmentVerdict
  checkPassed?: number | null
  checkTotal?: number | null
  checkLabel?: string | null        // "Strong" | "Mixed" | "Weak"
  passBullets?: string[]            // Top 3 plain-English passing signals
  failBullets?: string[]            // Top 1 plain-English failing signal
}

type Format = 'portrait' | 'landscape' | 'square'

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

export default function ShareCardModal({
  open, onClose, ticker, companyName, output, currentPrice, currency,
  checkPassed, checkTotal, checkLabel, passBullets, failBullets,
}: Props) {
  // Default to portrait on mobile, landscape on desktop
  const [format, setFormat] = useState<Format>(() => {
    if (typeof window !== 'undefined' && window.innerWidth < 768) return 'portrait'
    return 'portrait' // portrait as default always — it's the most shareable
  })
  const [copying, setCopying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [imgLoading, setImgLoading] = useState(true)
  const [imgError, setImgError] = useState(false)
  const dialogRef = useRef<HTMLDialogElement>(null)

  // Serialize top-3 valid methods
  const methodsParam = (() => {
    const valid = output.methods
      .filter(m => m.fairValue != null && m.fairValue > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(m => ({ label: m.method, fv: m.fairValue as number }))
    return valid.length > 0 ? encodeURIComponent(JSON.stringify(valid)) : undefined
  })()

  // Base params shared across formats
  const baseParams = {
    ticker,
    name:       companyName,
    price:      currentPrice,
    fv:         output.blendedFairValue ?? 'none',
    upside:     output.upsidePct        ?? 'none',
    bear:       output.scenarios.bear.fairValue,
    bull:       output.scenarios.bull.fairValue,
    currency,
    verdict:    output.verdict,
    conviction: CONVICTION_MAP[output.divergence.overallConfidence] ?? '',
    methods:    methodsParam,
    mig:        output.marketImpliedGrowth ?? undefined,
    migAssumed: output.scenarios.base.cagr ?? undefined,
    // Conviction / checklist
    checkPassed:  checkPassed ?? undefined,
    checkTotal:   checkTotal  ?? undefined,
    checkLabel:   checkLabel  ?? undefined,
    passBullets:  passBullets?.length ? passBullets.join('|') : undefined,
    failBullets:  failBullets?.length ? failBullets.join('|') : undefined,
  }

  const portraitUrl  = buildUrl('/api/og/portrait', baseParams)
  const landscapeUrl = buildUrl('/api/og', baseParams)
  const squareUrl    = buildUrl('/api/og/square', baseParams)

  const previewUrl = format === 'portrait' ? portraitUrl
    : format === 'landscape' ? landscapeUrl
    : squareUrl

  useEffect(() => {
    setImgLoading(true)
    setImgError(false)
  }, [previewUrl])

  useEffect(() => {
    const d = dialogRef.current
    if (!d) return
    if (open && !d.open) d.showModal()
    else if (!open && d.open) d.close()
  }, [open])

  function handleBackdrop(e: React.MouseEvent<HTMLDialogElement>) {
    const rect = dialogRef.current?.getBoundingClientRect()
    if (!rect) return
    if (e.clientX < rect.left || e.clientX > rect.right || e.clientY < rect.top || e.clientY > rect.bottom) onClose()
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
      a.download = `${ticker.toLowerCase()}-analysis-${format}.png`
      a.click()
      URL.revokeObjectURL(url)
    } catch { /* silent */ }
    finally { setDownloading(false) }
  }

  async function handleShare() {
    if (typeof navigator !== 'undefined' && navigator.canShare) {
      try {
        const res = await fetch(previewUrl)
        if (!res.ok) throw new Error('fetch failed')
        const blob = await res.blob()
        const file = new File([blob], `${ticker.toLowerCase()}-analysis.png`, { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `$${ticker} Analysis — insic`,
            text: `$${ticker} looks ${output.verdict} — see the analysis on insic.app`,
          })
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

  const aspectClass = format === 'portrait'
    ? 'aspect-[1080/1350]'
    : format === 'landscape' ? 'aspect-[1200/630]'
    : 'aspect-square'

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdrop}
      onClose={onClose}
      className="p-0 rounded-2xl border-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm max-w-[500px] w-[calc(100vw-32px)] outline-none"
    >
      <div className="flex flex-col bg-white rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3E1DA]">
          <div>
            <p className="text-[13px] font-[700] text-[#06101F]">Share ${ticker} analysis</p>
            <p className="text-[11px] text-[#8A95A6] mt-0.5">Download to post on Twitter, Instagram, or WhatsApp</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            className="w-11 h-11 flex items-center justify-center rounded-full text-[#8A95A6] hover:text-[#06101F] hover:bg-[#E3E1DA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Format picker */}
        <div className="flex items-center gap-2 px-5 pt-4 flex-wrap">
          {[
            { id: 'portrait',  label: 'Portrait',  sub: '1080×1350', Icon: Smartphone },
            { id: 'landscape', label: 'Twitter',   sub: '1200×630',  Icon: Twitter    },
            { id: 'square',    label: 'Instagram', sub: '1080×1080', Icon: Instagram  },
          ].map(({ id, label, sub, Icon }) => (
            <button
              key={id}
              onClick={() => setFormat(id as Format)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg border text-[12px] font-[600] transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B]',
                format === id
                  ? 'bg-[#5F790B] border-[#5F790B] text-white'
                  : 'bg-white border-[#E3E1DA] text-[#566174] hover:border-[#BFD2A1] hover:text-[#5F790B]',
              )}
            >
              <Icon size={12} />
              {label}
              <span className="text-[10px] opacity-60 font-normal">{sub}</span>
            </button>
          ))}
        </div>

        {/* Preview */}
        <div className="px-5 pt-3 pb-4">
          <div className={cn('w-full rounded-xl overflow-hidden border border-[#E3E1DA] bg-[#F4F3EF] relative', aspectClass)}>
            {imgLoading && !imgError && (
              <div className="absolute inset-0 bg-[#E3E1DA] animate-pulse rounded-xl" />
            )}
            {imgError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-[#F4F3EF]">
                <AlertCircle size={20} className="text-[#8A95A6]" />
                <p className="text-[12px] text-[#8A95A6]">Preview unavailable</p>
                <p className="text-[11px] text-[#8A95A6]">Image will still download correctly</p>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={previewUrl}
              src={previewUrl}
              alt={`$${ticker} analysis card`}
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
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-[650] bg-[#5F790B] text-white hover:bg-[#526A08] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#5F790B]"
          >
            <Download size={14} />
            {downloading ? 'Downloading…' : 'Download image'}
          </button>
          <button
            onClick={handleShare}
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-[13px] font-[650] border border-[#E3E1DA] bg-white text-[#06101F] hover:bg-[#F4F3EF] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1"
          >
            {copying ? <Check size={14} className="text-[#11875D]" /> : <Share2 size={14} />}
            {copying ? 'Link copied' : 'Share'}
          </button>
        </div>

      </div>
    </dialog>
  )
}
