'use client'

import { useEffect, useState } from 'react'
import { InsicLogoLockup } from '@/components/ui/InsicLogo'

/**
 * Branded page loader — shown by Next.js loading.tsx convention while
 * a page's data fetches. Clean white bg, centered logo, animated olive
 * progress bar. Fades in after 80ms to avoid flashing on fast loads.
 */
export default function PageLoader() {
  // Delay visibility so fast navigations never show a flash
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 80)
    return () => clearTimeout(t)
  }, [])

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-white"
      style={{
        opacity: visible ? 1 : 0,
        transition: 'opacity 150ms ease',
      }}
      aria-label="Loading"
      role="status"
    >
      {/* Logo */}
      <InsicLogoLockup size="lg" />

      {/* Progress track */}
      <div
        className="relative mt-6 h-[2px] w-[200px] rounded-full bg-[#E5E5E5] overflow-hidden"
        aria-hidden="true"
      >
        {/* Sliding dot — CSS animation, respects prefers-reduced-motion */}
        <div className="absolute inset-y-0 w-12 rounded-full bg-[#5F790B] page-loader-bar" />
      </div>

      {/* Screen-reader only status text */}
      <span className="sr-only">Loading, please wait</span>
    </div>
  )
}
