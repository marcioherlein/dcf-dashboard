'use client'
import { useEffect, useState, useRef, useCallback } from 'react'

export default function MorningBrief() {
  const [available, setAvailable] = useState<boolean | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [generating, setGenerating] = useState(false)
  const [liveHtml, setLiveHtml] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const iframeRef = useRef<HTMLIFrameElement>(null)
  const [iframeHeight, setIframeHeight] = useState(0)

  useEffect(() => {
    fetch('/api/brief')
      .then((r) => r.json())
      .then((d) => {
        setAvailable(d.available)
        if (d.generatedAt) setGeneratedAt(d.generatedAt)
      })
      .catch(() => setAvailable(false))
  }, [])

  const handleUpdate = async () => {
    setGenerating(true)
    setError(null)
    setIframeHeight(0)
    try {
      const res = await fetch('/api/brief/generate', { method: 'POST' })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Generation failed'); return }
      setLiveHtml(data.html)
      setGeneratedAt(data.generatedAt)
      setAvailable(true)
    } catch {
      setError('Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const formatStamp = (iso: string) => {
    const d = new Date(iso)
    return d.toLocaleString('en-US', {
      timeZone: 'America/Argentina/Buenos_Aires',
      weekday: 'short', month: 'short', day: 'numeric',
      hour: '2-digit', minute: '2-digit', hour12: true,
    }) + ' ART'
  }

  const onIframeLoad = useCallback(() => {
    try {
      const body = iframeRef.current?.contentDocument?.body
      if (body) setIframeHeight(body.scrollHeight + 32)
    } catch {
      setIframeHeight(4000)
    }
  }, [])

  const showBrief = (available === true || liveHtml !== null) && !generating

  return (
    <section className="px-4 pb-20 pt-5">
      <div className="mx-auto max-w-4xl">

        {/* Toolbar */}
        <div className="mb-3 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {generatedAt ? (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
                <span className="text-xs text-white/30">Generated {formatStamp(generatedAt)}</span>
              </>
            ) : available === null ? (
              <div className="h-3 w-44 animate-pulse rounded bg-white/8" />
            ) : (
              <span className="text-xs text-white/20">Auto-updates 7am &amp; 5pm ART on weekdays</span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {error && <span className="text-xs text-red-400">{error}</span>}
            <button
              onClick={handleUpdate}
              disabled={generating}
              className="flex items-center gap-1.5 rounded-lg border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs font-semibold text-white/50 transition-all hover:border-white/20 hover:bg-white/8 hover:text-white/80 disabled:cursor-not-allowed disabled:opacity-40"
            >
              {generating ? (
                <>
                  <div className="h-3 w-3 animate-spin rounded-full border border-white/20 border-t-white/60" />
                  <span>Generating…</span>
                </>
              ) : (
                <>
                  <svg className="h-3 w-3" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M13.65 2.35A8 8 0 1 0 15 8h-1.5A6.5 6.5 0 1 1 8 1.5a6.45 6.45 0 0 1 4.6 1.9L10 6h5V1l-1.35 1.35z"/>
                  </svg>
                  <span>Update</span>
                </>
              )}
            </button>
          </div>
        </div>

        {/* Loading skeleton */}
        {available === null && (
          <div className="animate-pulse overflow-hidden rounded-2xl border border-white/8 bg-[#111]" style={{ height: 200 }} />
        )}

        {/* Generating overlay */}
        {generating && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-[#0d0d0d] py-24">
            <div className="relative mb-5">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-white/10 border-t-amber-400/80" />
              <div className="absolute inset-0 flex items-center justify-center text-lg">☀️</div>
            </div>
            <p className="text-sm font-semibold text-white/80">Generating Morning Brief</p>
            <p className="mt-1.5 text-xs text-white/25">Searching the web · Composing with Claude · ~60s</p>
          </div>
        )}

        {/* Brief content */}
        {showBrief && (
          <div className="overflow-hidden rounded-2xl border border-white/8 shadow-[0_0_80px_rgba(255,255,255,0.02)]">
            {iframeHeight === 0 && (
              <div className="h-48 animate-pulse bg-white/[0.02]" />
            )}
            <iframe
              ref={iframeRef}
              key={liveHtml ? 'live' : 'static'}
              {...(liveHtml ? { srcDoc: liveHtml } : { src: '/briefs/latest.html', loading: 'lazy' as const })}
              className="w-full"
              style={{ height: iframeHeight || 0, display: iframeHeight ? 'block' : 'none' }}
              title="Morning Brief"
              scrolling="no"
              onLoad={onIframeLoad}
            />
          </div>
        )}

        {/* No brief yet */}
        {available === false && !generating && !liveHtml && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-white/8 bg-[#0d0d0d] px-8 py-16 text-center">
            <p className="mb-3 text-4xl opacity-40">📋</p>
            <p className="text-sm font-semibold text-white/70">No brief yet today</p>
            <p className="mt-1.5 text-xs text-white/30 max-w-xs">
              Generates automatically at 7am &amp; 5pm ART, or click <strong className="text-white/50">Update</strong> above to generate now.
            </p>
          </div>
        )}
      </div>
    </section>
  )
}
