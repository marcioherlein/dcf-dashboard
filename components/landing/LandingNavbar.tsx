'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession } from 'next-auth/react'
import { Menu, X } from 'lucide-react'
import { InsicLogoLockup } from '@/components/ui/InsicLogo'
import { motion, AnimatePresence } from 'motion/react'

const NAV_LINKS = [
  { label: 'Product',      href: '/analyze'      },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing',      href: '#pricing'      },
]

export default function LandingNavbar() {
  const { data: session } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 48)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  useEffect(() => {
    if (!mobileOpen) return
    const close = (e: KeyboardEvent) => { if (e.key === 'Escape') setMobileOpen(false) }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [mobileOpen])

  const atTop = !scrolled

  return (
    <>
      {/* ── Floating navbar ───────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-5 pointer-events-none" style={{ paddingTop: 'calc(0.75rem + env(safe-area-inset-top, 0px))' }}>
        <style>{`:root { --navbar-height: 3.5rem; } @media (min-width: 640px) { :root { --navbar-height: 4.5rem; } }`}</style>
        <div className="mx-auto pointer-events-auto" style={{ maxWidth: '1280px' }}>
          <div
            className="grid items-center h-14 sm:h-[72px] px-4 sm:px-6 rounded-2xl"
            style={{
              gridTemplateColumns: '1fr auto 1fr',
              background: atTop
                ? 'rgba(15,23,42,0.30)'
                : 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: atTop
                ? '1px solid rgba(255,255,255,0.10)'
                : '1px solid rgba(0,0,0,0.10)',
              boxShadow: atTop
                ? 'none'
                : '0 8px 32px rgba(0,0,0,0.14), 0 2px 8px rgba(0,0,0,0.06)',
              transition: 'background 0.35s ease, border-color 0.35s ease, box-shadow 0.35s ease',
            }}
          >
            {/* ── Col 1: Logo — left edge ── */}
            <div className="flex items-center">
              <Link href="/" onClick={() => setMobileOpen(false)} aria-label="insic home" className="flex items-center" style={{ lineHeight: 0 }}>
                <InsicLogoLockup size="lg" on={atTop ? 'dark' : 'light'} />
              </Link>
            </div>

            {/* ── Col 2: Nav — dead center of the bar ── */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="px-4 py-2 rounded-lg text-[14.5px] font-medium transition-all duration-150 whitespace-nowrap min-h-[44px] flex items-center"
                  style={{
                    color: atTop ? 'rgba(255,255,255,0.80)' : '#6B6B6B',
                  }}
                  onMouseEnter={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = atTop ? 'rgba(255,255,255,0.10)' : '#F5F5F5'
                    ;(e.currentTarget as HTMLElement).style.color = atTop ? 'rgba(255,255,255,1)' : '#111111'
                  }}
                  onMouseLeave={e => {
                    (e.currentTarget as HTMLElement).style.backgroundColor = 'transparent'
                    ;(e.currentTarget as HTMLElement).style.color = atTop ? 'rgba(255,255,255,0.80)' : '#6B6B6B'
                  }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* ── Col 3: CTA — right edge ── */}
            <div className="flex items-center justify-end gap-3">
              <Link
                href="/analyze"
                className="hidden sm:inline-flex items-center justify-center rounded-md px-6 py-2.5 text-[14px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95 whitespace-nowrap"
                style={{ background: '#5F790B', boxShadow: '0 4px 12px rgba(95,121,11,0.25)', minHeight: '44px' }}
              >
                {session ? 'Go to app' : 'Analyze for free'}
              </Link>
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="lg:hidden flex items-center justify-center w-11 h-11 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#5F790B] focus-visible:ring-offset-2"
                style={{ color: atTop ? 'rgba(255,255,255,0.80)' : '#6B6B6B' }}
                aria-label="Toggle menu"
                aria-expanded={mobileOpen}
                aria-controls="mobile-nav-menu"
              >
                {mobileOpen ? <X size={22} /> : <Menu size={22} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile menu ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            id="mobile-nav-menu"
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed left-3 right-3 z-40 lg:hidden rounded-2xl overflow-hidden"
            style={{ top: 'calc(var(--navbar-height) + 0.75rem + env(safe-area-inset-top, 0px))', background: 'rgba(255,255,255,0.98)', border: '1px solid #E5E5E5', boxShadow: '0 16px 48px rgba(0,0,0,0.14), 0 4px 12px rgba(0,0,0,0.07)' }}
          >
            <nav className="flex flex-col p-3 gap-0.5">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center py-3 px-4 rounded-md text-[15px] font-medium text-[#6B6B6B] hover:bg-[#EEF4DD] hover:text-[#111111] transition-colors"
                  style={{ minHeight: '44px' }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="px-3 pb-3 flex flex-col gap-2.5">
              <Link
                href="/analyze"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center rounded-md py-3.5 text-[15px] font-semibold text-white flex items-center justify-center"
                style={{ background: '#5F790B', minHeight: '48px' }}
              >
                {session ? 'Go to app' : 'Analyze for free'}
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
