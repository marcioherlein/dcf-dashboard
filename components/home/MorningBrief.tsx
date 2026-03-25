'use client'
import { useEffect, useState } from 'react'

export default function MorningBrief() {
  const [available, setAvailable] = useState<boolean | null>(null)

  useEffect(() => {
    fetch('/api/brief')
      .then((r) => r.json())
      .then((d) => setAvailable(d.available))
      .catch(() => setAvailable(false))
  }, [])

  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 text-center">
          <p className="text-[11px] font-bold tracking-[0.3em] uppercase text-blue-400">Morning Brief</p>
          <p className="mt-1 text-xs text-white/25">Daily intelligence · Auto-updates at 7am &amp; 5pm ART</p>
        </div>

        {available === null && (
          <div className="animate-pulse overflow-hidden rounded-2xl border border-white/8 bg-[#111]" style={{ height: 120 }} />
        )}

        {available === true && (
          <div className="overflow-hidden rounded-2xl border border-white/8" style={{ height: 'max(80vh, 600px)' }}>
            <iframe
              src="/briefs/latest.html"
              className="h-full w-full"
              title="Morning Brief"
              loading="lazy"
            />
          </div>
        )}

        {available === false && (
          <div className="rounded-2xl border border-white/8 bg-[#111] px-8 py-12 text-center">
            <p className="mb-2 text-4xl">📋</p>
            <p className="text-base font-semibold text-white">No brief yet for today</p>
            <p className="mt-2 text-sm text-white/40 max-w-md mx-auto">
              Generate a brief and save it to{' '}
              <code className="rounded bg-white/8 px-1.5 py-0.5 text-xs text-white/60">public/briefs/latest.html</code>{' '}
              in the dcf-dashboard repo, then push — it will appear here automatically.
            </p>
            <div className="mt-6 text-left mx-auto max-w-sm rounded-xl border border-white/8 bg-white/3 p-4 text-xs text-white/40 font-mono">
              <p className="text-white/60 mb-2"># Brief workflow (run from dcf-dashboard/)</p>
              <p>cp your-brief.html public/briefs/YYYY-MM-DD.html</p>
              <p>cp your-brief.html public/briefs/latest.html</p>
              <p>git add public/briefs/ &amp;&amp; git commit -m &quot;Brief YYYY-MM-DD&quot;</p>
              <p>git push</p>
            </div>
          </div>
        )}
      </div>
    </section>
  )
}
