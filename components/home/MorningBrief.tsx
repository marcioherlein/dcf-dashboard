'use client'

export default function MorningBrief() {
  return (
    <section className="px-4 pb-20">
      <div className="mx-auto max-w-6xl">
        <div className="mb-6 text-center">
          <p className="text-[11px] font-bold tracking-[0.3em] uppercase text-blue-400">Morning Brief</p>
          <p className="mt-1 text-xs text-white/25">Daily intelligence · Auto-updates at 7am &amp; 5pm ART</p>
        </div>
        <div
          className="overflow-hidden rounded-2xl border border-white/8"
          style={{ height: 'max(80vh, 600px)' }}
        >
          <iframe
            src="https://marcioherlein.github.io/morning/"
            className="h-full w-full"
            title="Morning Brief"
            loading="lazy"
          />
        </div>
      </div>
    </section>
  )
}
