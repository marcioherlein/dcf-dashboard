/**
 * SlateHeroZone
 *
 * Reusable slate gradient hero zone — applies the landing page aesthetic
 * (dark slate background, olive ambient glow, bottom fade to white) to any
 * app tab. Drop content inside; the zone fades cleanly into the page below.
 *
 * Usage:
 *   <SlateHeroZone>
 *     <SearchHero />
 *     <PopularSection dark />   ← pass dark={true} to flip text to white
 *   </SlateHeroZone>
 *   <div className="pt-0">     ← content below inherits white bg naturally
 *     <LeaderboardSection />
 *   </div>
 *
 * Props:
 *   children    — content rendered inside the slate zone
 *   fadeHeight  — height of the bottom fade gradient in px (default 160)
 *   className   — extra classes on the inner content wrapper
 *   maxWidth    — max-width class for inner container (default 'max-w-[960px]')
 */
'use client'

interface SlateHeroZoneProps {
  children: React.ReactNode
  fadeHeight?: number
  className?: string
  maxWidth?: string
}

export default function SlateHeroZone({
  children,
  fadeHeight = 160,
  className = '',
  maxWidth = 'max-w-[960px]',
}: SlateHeroZoneProps) {
  return (
    <div className="relative overflow-hidden">
      {/* Slate gradient — matches landing hero */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'linear-gradient(160deg, #1e293b 0%, #334155 55%, #475569 100%)',
        }}
      />

      {/* Olive ambient glow top-right — brand accent */}
      <div
        aria-hidden="true"
        className="absolute inset-0 pointer-events-none"
        style={{
          backgroundImage:
            'radial-gradient(ellipse 50% 80% at 90% -10%, rgba(95,121,11,0.18) 0%, transparent 60%)',
        }}
      />

      {/* Bottom fade — transparent → white, clears all hero content */}
      <div
        aria-hidden="true"
        className="absolute bottom-0 left-0 right-0 pointer-events-none"
        style={{
          height: `${fadeHeight}px`,
          background:
            'linear-gradient(to bottom, transparent 0%, rgba(255,255,255,0.6) 60%, #ffffff 100%)',
        }}
      />

      {/* Content */}
      <div
        className={`relative px-4 sm:px-6 lg:px-8 pt-8 pb-10 mx-auto ${maxWidth} ${className}`}
      >
        {children}
      </div>
    </div>
  )
}
