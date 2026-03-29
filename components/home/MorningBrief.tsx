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
    <section className="pb-20 pt-2">
      <div className="mx-auto max-w-4xl">

        {/* Toolbar */}
        <div className="mb-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            {generatedAt ? (
              <>
                <div className="h-1.5 w-1.5 rounded-full bg-secondary shadow-[0_0_6px_rgba(0,109,67,0.6)]" />
                <span className="text-xs text-on-surface-variant">Generated {formatStamp(generatedAt)}</span>
              </>
            ) : available === null ? (
              <div className="h-3 w-44 animate-pulse rounded bg-surface-container" />
            ) : (
              <span className="text-xs text-on-surface-variant">Auto-updates 7am &amp; 5pm ART on weekdays</span>
            )}
          </div>
          <div className="flex items-center gap-2.5">
            {error && <span className="text-xs text-error">{error}</span>}
            {(available === true || liveHtml !== null) && (
              <button
                onClick={handleUpdate}
                disabled={generating}
                className="flex items-center gap-1.5 rounded-xl border border-outline-variant/30 bg-surface-container px-3 py-1.5 text-xs font-semibold text-on-surface-variant transition-all hover:border-outline-variant hover:bg-surface-container-high hover:text-on-surface disabled:cursor-not-allowed disabled:opacity-40"
              >
                {generating ? (
                  <>
                    <div className="h-3 w-3 animate-spin rounded-full border border-outline-variant border-t-primary" />
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
            )}
          </div>
        </div>

        {/* Loading skeleton */}
        {available === null && (
          <div className="animate-pulse overflow-hidden rounded-2xl border border-outline-variant/20 bg-surface-container" style={{ height: 200 }} />
        )}

        {/* Generating overlay */}
        {generating && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container py-24">
            <div className="relative mb-5">
              <div className="h-10 w-10 animate-spin rounded-full border-2 border-outline-variant border-t-primary" />
              <div className="absolute inset-0 flex items-center justify-center text-lg">☀️</div>
            </div>
            <p className="text-sm font-semibold text-on-surface">Generating Morning Brief</p>
            <p className="mt-1.5 text-xs text-on-surface-variant">Searching the web · Composing with Claude · ~60s</p>
          </div>
        )}

        {/* Brief content */}
        {showBrief && (
          <div className="overflow-hidden rounded-2xl border border-outline-variant/20 shadow-[0_4px_24px_rgba(0,27,68,0.06)]">
            {iframeHeight === 0 && (
              <div className="h-48 animate-pulse bg-surface-container" />
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

        {/* No brief yet — prominent generate CTA */}
        {available === false && !generating && !liveHtml && (
          <div className="flex flex-col items-center justify-center rounded-2xl border border-outline-variant/20 bg-surface-container-low px-8 py-16 text-center">
            <div className="mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-primary">
              <svg className="h-7 w-7 text-on-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v1m0 16v1m8.66-9h-1M4.34 12h-1m15.07-6.36-.71.71M6.34 17.66l-.71.71m12.73 0-.71-.71M6.34 6.34l-.71-.71M12 8a4 4 0 1 0 0 8 4 4 0 0 0 0-8z" />
              </svg>
            </div>
            <h3 className="text-base font-bold text-on-surface mb-1">No brief yet today</h3>
            <p className="text-sm text-on-surface-variant max-w-xs mb-6">
              Generate your first Morning Brief — a curated intelligence report with live market data, powered by Claude.
            </p>
            <button
              onClick={handleUpdate}
              className="flex items-center gap-2 rounded-xl bg-primary px-6 py-3 text-sm font-bold text-on-primary hover:bg-primary-container transition-colors shadow-[0_4px_16px_rgba(0,27,68,0.2)]"
            >
              <svg className="h-4 w-4" viewBox="0 0 16 16" fill="currentColor">
                <path d="M13.65 2.35A8 8 0 1 0 15 8h-1.5A6.5 6.5 0 1 1 8 1.5a6.45 6.45 0 0 1 4.6 1.9L10 6h5V1l-1.35 1.35z"/>
              </svg>
              Generate Now
            </button>
            {error && <p className="mt-3 text-xs text-error">{error}</p>}
            <p className="mt-4 text-[11px] text-on-surface-variant/50">Requires ANTHROPIC_API_KEY · ~60s generation time</p>
          </div>
        )}
      </div>
    </section>
  )
}
