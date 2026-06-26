'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Download, Share2, Check, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
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
  checkPassed?: number | null
  checkTotal?: number | null
  checkLabel?: string | null
  passBullets?: string[]
  failBullets?: string[]
  peRatio?: number | null
  peHistory?: Array<{ year: string; pe: number }>
}

type PreviewState = 'loading' | 'ready' | 'error'

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
  peRatio, peHistory,
}: Props) {
  const [previewState, setPreviewState] = useState<PreviewState>('loading')
  const [copying, setCopying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  const [retryKey, setRetryKey] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout>>()
  const currentKeyRef = useRef(0)

  const methodsParam = (() => {
    const valid = output.methods
      .filter(m => m.fairValue != null && m.fairValue > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(m => ({ label: m.method, fv: m.fairValue as number }))
    return valid.length > 0 ? encodeURIComponent(JSON.stringify(valid)) : undefined
  })()

  const peHistParam = peHistory && peHistory.length > 0
    ? peHistory.map(x => `${x.year}:${x.pe}`).join('|')
    : undefined

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
    checkPassed:  checkPassed ?? undefined,
    checkTotal:   checkTotal  ?? undefined,
    checkLabel:   checkLabel  ?? undefined,
    passBullets:  passBullets?.length ? passBullets.join('|') : undefined,
    failBullets:  failBullets?.length ? failBullets.join('|') : undefined,
    pe:           peRatio ?? undefined,
    peHist:       peHistParam,
  }

  const previewUrl = buildUrl('/api/og/portrait', baseParams)

  const startLoading = useCallback((key: number) => {
    clearTimeout(loadTimeoutRef.current)
    currentKeyRef.current = key
    setPreviewState('loading')
    loadTimeoutRef.current = setTimeout(() => {
      if (currentKeyRef.current === key) setPreviewState('error')
    }, 15_000)
  }, [])

  const handleRetry = useCallback(() => {
    setRetryKey(k => { const next = k + 1; startLoading(next); return next })
  }, [startLoading])

  useEffect(() => {
    if (open) {
      setRetryKey(k => { const next = k + 1; startLoading(next); return next })
    } else {
      clearTimeout(loadTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  useEffect(() => () => clearTimeout(loadTimeoutRef.current), [])

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

  const handleImageLoad = useCallback((key: number) => {
    if (currentKeyRef.current === key) { clearTimeout(loadTimeoutRef.current); setPreviewState('ready') }
  }, [])

  const handleImageError = useCallback((key: number) => {
    if (currentKeyRef.current === key) { clearTimeout(loadTimeoutRef.current); setPreviewState('error') }
  }, [])

  async function handleDownload() {
    setDownloading(true)
    try {
      const res = await fetch(previewUrl)
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const blob = await res.blob()
      if (blob.size === 0) throw new Error('Empty response')
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${ticker.toLowerCase()}-analysis.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('[ShareCardModal] Download failed:', err)
    } finally {
      setDownloading(false)
    }
  }

  function handleShareTwitter() {
    const verdict = output.verdict
    const upsidePct = output.upsidePct
    const upsideStr = upsidePct != null
      ? ` (${upsidePct >= 0 ? '+' : ''}${(upsidePct * 100).toFixed(1)}% to fair value)`
      : ''
    const conviction = checkLabel ? ` — ${checkLabel} conviction` : ''
    const text = `$${ticker} looks ${verdict.toLowerCase()}${upsideStr}${conviction}.\n\nFull DCF model (free) 👇\nhttps://insic.app/stock/${ticker}`
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(text)}`
    window.open(twitterUrl, '_blank', 'noopener,noreferrer')
  }

  async function handleShareNative() {
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
            text: `$${ticker} looks ${output.verdict} — see the full analysis on insic.app`,
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

  return (
    <dialog
      ref={dialogRef}
      onClick={handleBackdrop}
      onClose={onClose}
      className="p-0 rounded-2xl border-0 shadow-2xl backdrop:bg-black/60 backdrop:backdrop-blur-sm max-w-[460px] w-[calc(100vw-32px)] outline-none"
    >
      <div className="flex flex-col bg-white rounded-2xl overflow-hidden">

        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E3E1DA]">
          <div>
            <p className="text-[13px] font-[700] text-[#06101F]">Share ${ticker} analysis</p>
            <p className="text-[11px] text-[#8A95A6] mt-0.5">Download the card or share directly to Twitter</p>
          </div>
          <button
            onClick={onClose}
            aria-label="Close"
            data-no-min-h
            className="w-11 h-11 flex items-center justify-center rounded-full text-[#8A95A6] hover:text-[#06101F] hover:bg-[#E3E1DA] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B]"
          >
            <X size={14} />
          </button>
        </div>

        {/* Preview — portrait only */}
        <div className="px-5 pt-4 pb-3">
          <div className="w-full rounded-xl overflow-hidden border border-[#E3E1DA] bg-[#F0F1F6] relative aspect-[1080/1350]">
            {previewState === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#F0F1F6]">
                <Loader2 size={20} className="text-[#5F790B] animate-spin" />
                <p className="text-[12px] text-[#8A95A6]">Generating card…</p>
              </div>
            )}
            {previewState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#F0F1F6]">
                <AlertCircle size={20} className="text-[#D83B3B]" />
                <p className="text-[12px] text-[#566174] font-semibold">Preview failed</p>
                <button
                  onClick={handleRetry}
                  data-no-min-h
                  className="flex items-center gap-1.5 text-[12px] font-[600] text-[#5F790B] hover:text-[#526A08] px-3 py-1.5 rounded-lg border border-[#BFD2A1] bg-white"
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
              </div>
            )}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={retryKey}
              src={previewUrl}
              alt={`$${ticker} analysis card`}
              className={cn('w-full h-full object-cover transition-opacity duration-300', previewState === 'ready' ? 'opacity-100' : 'opacity-0')}
              onLoad={() => handleImageLoad(retryKey)}
              onError={() => handleImageError(retryKey)}
            />
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2 px-5 pb-5">
          <button
            onClick={handleDownload}
            disabled={downloading}
            className="flex-1 flex items-center justify-center gap-2 rounded-xl py-2.5 text-[13px] font-[650] bg-[#4A6109] text-white hover:bg-[#3E5206] transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white focus-visible:ring-offset-2 focus-visible:ring-offset-[#4A6109]"
          >
            <Download size={14} />
            {downloading ? 'Downloading…' : 'Download'}
          </button>

          {/* Twitter — opens tweet composer with pre-filled narrative */}
          <button
            onClick={handleShareTwitter}
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-[13px] font-[650] bg-[#000000] text-white hover:bg-[#1a1a1a] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#000] focus-visible:ring-offset-1"
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
              <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.259 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
            </svg>
            Post
          </button>

          {/* Native share / copy link */}
          <button
            onClick={handleShareNative}
            className="flex items-center justify-center gap-2 rounded-xl py-2.5 px-4 text-[13px] font-[650] border border-[#E3E1DA] bg-white text-[#06101F] hover:bg-[#F0F1F6] transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-1"
          >
            {copying ? <Check size={14} className="text-[#11875D]" /> : <Share2 size={14} />}
            {copying ? 'Copied' : 'Share'}
          </button>
        </div>

      </div>
    </dialog>
  )
}
