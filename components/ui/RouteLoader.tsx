'use client'

import { useEffect, useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { InsicLogoLockup } from '@/components/ui/InsicLogo'

/**
 * Route-transition loader.
 *
 * Shows a branded loading overlay during client-side navigations.
 * Fires when pathname changes (navigation starts) and hides once the
 * new page's content has painted (next animation frame after pathname settles).
 *
 * Works for 'use client' pages where loading.tsx is ineffective because
 * Next.js loading.tsx only intercepts server-component render time.
 */
export default function RouteLoader() {
  const pathname = usePathname()
  const [visible, setVisible] = useState(false)
  const prevPathname = useRef(pathname)
  const hideTimer = useRef<ReturnType<typeof setTimeout>>()
  const showTimer = useRef<ReturnType<typeof setTimeout>>()

  useEffect(() => {
    // pathname just changed → navigation completed
    if (pathname !== prevPathname.current) {
      prevPathname.current = pathname

      // Hide after content has had one frame to paint
      clearTimeout(hideTimer.current)
      hideTimer.current = setTimeout(() => {
        setVisible(false)
      }, 50)
    }
  }, [pathname])

  // We need to detect navigation START, not end.
  // Intercept <Link> and router pushes via click / popstate.
  useEffect(() => {
    function handleStart() {
      clearTimeout(hideTimer.current)
      // Show loader after 120ms — fast navigations never see it
      showTimer.current = setTimeout(() => setVisible(true), 120)
    }

    // Capture clicks on <a> tags (Next.js Link renders <a>)
    function handleClick(e: MouseEvent) {
      const anchor = (e.target as HTMLElement).closest('a')
      if (!anchor) return
      const href = anchor.getAttribute('href')
      // Only internal navigations
      if (!href || href.startsWith('http') || href.startsWith('//') || href.startsWith('#')) return
      handleStart()
    }

    // Back/forward navigation
    window.addEventListener('popstate', handleStart)
    document.addEventListener('click', handleClick, true)

    return () => {
      window.removeEventListener('popstate', handleStart)
      document.removeEventListener('click', handleClick, true)
      clearTimeout(showTimer.current)
      clearTimeout(hideTimer.current)
    }
  }, [])

  if (!visible) return null

  return (
    <div
      className="fixed inset-0 z-[9999] flex flex-col items-center justify-center bg-white"
      aria-label="Loading"
      role="status"
    >
      <InsicLogoLockup size="lg" />

      <div
        className="relative mt-6 h-[2px] w-[200px] rounded-full bg-[#E5E5E5] overflow-hidden"
        aria-hidden="true"
      >
        <div className="absolute inset-y-0 w-12 rounded-full bg-[#5F790B] page-loader-bar" />
      </div>

      <span className="sr-only">Loading, please wait</span>
    </div>
  )
}
