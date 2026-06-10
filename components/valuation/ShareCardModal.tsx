'use client'

import { useState, useCallback, useRef, useEffect } from 'react'
import { X, Download, Share2, Check, Twitter, Instagram, Smartphone, AlertCircle, RefreshCw, Loader2 } from 'lucide-react'
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
}

type Format = 'portrait' | 'landscape' | 'square'
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

const FORMAT_CONFIG = [
  { id: 'portrait'  as Format, label: 'Portrait',  sub: '1080×1350', Icon: Smartphone, aspect: 'aspect-[1080/1350]' },
  { id: 'landscape' as Format, label: 'Twitter',   sub: '1200×630',  Icon: Twitter,    aspect: 'aspect-[1200/630]'  },
  { id: 'square'    as Format, label: 'Instagram', sub: '1080×1080', Icon: Instagram,  aspect: 'aspect-square'      },
]

export default function ShareCardModal({
  open, onClose, ticker, companyName, output, currentPrice, currency,
  checkPassed, checkTotal, checkLabel, passBullets, failBullets,
}: Props) {
  const [format, setFormat] = useState<Format>('portrait')
  const [previewState, setPreviewState] = useState<PreviewState>('loading')
  const [copying, setCopying] = useState(false)
  const [downloading, setDownloading] = useState(false)
  // retryKey forces the <img> to remount and refetch even for the same URL
  const [retryKey, setRetryKey] = useState(0)
  const dialogRef = useRef<HTMLDialogElement>(null)
  // Track loading timeout — if image hasn't loaded in 15s, mark as error
  const loadTimeoutRef = useRef<ReturnType<typeof setTimeout>>()

  const methodsParam = (() => {
    const valid = output.methods
      .filter(m => m.fairValue != null && m.fairValue > 0)
      .sort((a, b) => b.weight - a.weight)
      .slice(0, 3)
      .map(m => ({ label: m.method, fv: m.fairValue as number }))
    return valid.length > 0 ? encodeURIComponent(JSON.stringify(valid)) : undefined
  })()

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
  }

  const urlForFormat = useCallback((f: Format) => {
    const base = f === 'portrait' ? '/api/og/portrait' : f === 'landscape' ? '/api/og' : '/api/og/square'
    return buildUrl(base, baseParams)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ticker, companyName, currentPrice, format])

  const previewUrl = urlForFormat(format)

  // Synchronously reset preview state when format or retryKey changes
  // Using a ref to track the "current" preview request, so stale handlers can't update state
  const currentPreviewRef = useRef({ format, retryKey, url: previewUrl })

  const startLoading = useCallback((f: Format, key: number) => {
    clearTimeout(loadTimeoutRef.current)
    const url = urlForFormat(f)
    currentPreviewRef.current = { format: f, retryKey: key, url }
    setPreviewState('loading')
    // 15-second hard timeout — if image hasn't loaded, mark as error
    loadTimeoutRef.current = setTimeout(() => {
      if (currentPreviewRef.current.format === f && currentPreviewRef.current.retryKey === key) {
        setPreviewState('error')
      }
    }, 15_000)
  }, [urlForFormat])

  // When format changes, immediately reset state
  const handleFormatChange = useCallback((f: Format) => {
    setFormat(f)
    setRetryKey(k => {
      const next = k + 1
      startLoading(f, next)
      return next
    })
  }, [startLoading])

  const handleRetry = useCallback(() => {
    setRetryKey(k => {
      const next = k + 1
      startLoading(format, next)
      return next
    })
  }, [format, startLoading])

  // Start loading when modal opens
  useEffect(() => {
    if (open) {
      setRetryKey(k => {
        const next = k + 1
        startLoading(format, next)
        return next
      })
    } else {
      clearTimeout(loadTimeoutRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Cleanup timeout on unmount
  useEffect(() => () => clearTimeout(loadTimeoutRef.current), [])

  // Native dialog open/close
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

  const handleImageLoad = useCallback((f: Format, key: number) => {
    // Only update state if this is still the current request
    if (currentPreviewRef.current.format === f && currentPreviewRef.current.retryKey === key) {
      clearTimeout(loadTimeoutRef.current)
      setPreviewState('ready')
    }
  }, [])

  const handleImageError = useCallback((f: Format, key: number) => {
    if (currentPreviewRef.current.format === f && currentPreviewRef.current.retryKey === key) {
      clearTimeout(loadTimeoutRef.current)
      setPreviewState('error')
    }
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
      a.download = `${ticker.toLowerCase()}-analysis-${format}.png`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      // Revoke after a brief delay to ensure download initiated
      setTimeout(() => URL.revokeObjectURL(url), 1000)
    } catch (err) {
      console.error('[ShareCardModal] Download failed:', err)
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
        const file = new File([blob], `${ticker.toLowerCase()}-analysis.png`, { type: 'image/png' })
        if (navigator.canShare({ files: [file] })) {
          await navigator.share({
            files: [file],
            title: `$${ticker} Analysis — insic`,
            text: `$${ticker} looks ${output.verdict} — see the analysis on insic.app`,
          })
          return
        }
      } catch { /* fall through to clipboard */ }
    }
    try {
      await navigator.clipboard.writeText(`https://insic.app/stock/${ticker}`)
      setCopying(true)
      setTimeout(() => setCopying(false), 2000)
    } catch { /* ignore */ }
  }

  const currentConfig = FORMAT_CONFIG.find(f => f.id === format) ?? FORMAT_CONFIG[0]

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
          {FORMAT_CONFIG.map(({ id, label, sub, Icon }) => (
            <button
              key={id}
              onClick={() => handleFormatChange(id)}
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
          <div className={cn('w-full rounded-xl overflow-hidden border border-[#E3E1DA] bg-[#F4F3EF] relative', currentConfig.aspect)}>

            {/* Loading state */}
            {previewState === 'loading' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#F4F3EF]">
                <Loader2 size={20} className="text-[#5F790B] animate-spin" />
                <p className="text-[12px] text-[#8A95A6]">Generating preview…</p>
              </div>
            )}

            {/* Error state with retry */}
            {previewState === 'error' && (
              <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-[#F4F3EF]">
                <AlertCircle size={20} className="text-[#D83B3B]" />
                <p className="text-[12px] text-[#566174] font-semibold">Preview failed</p>
                <button
                  onClick={handleRetry}
                  className="flex items-center gap-1.5 text-[12px] font-[600] text-[#5F790B] hover:text-[#526A08] transition-colors px-3 py-1.5 rounded-lg border border-[#BFD2A1] bg-white hover:bg-[#F6FAEA]"
                >
                  <RefreshCw size={12} />
                  Retry
                </button>
              </div>
            )}

            {/* The actual image — always in DOM, hidden when not ready */}
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              key={`${format}-${retryKey}`}
              src={previewUrl}
              alt={`$${ticker} analysis card`}
              className={cn(
                'w-full h-full object-cover transition-opacity duration-300',
                previewState === 'ready' ? 'opacity-100' : 'opacity-0',
              )}
              onLoad={() => handleImageLoad(format, retryKey)}
              onError={() => handleImageError(format, retryKey)}
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
