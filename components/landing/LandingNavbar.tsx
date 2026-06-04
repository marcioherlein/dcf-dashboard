'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { Menu, X } from 'lucide-react'
import { InsicLogo } from '@/components/ui/InsicLogo'
import { motion, AnimatePresence } from 'motion/react'

const NAV_LINKS = [
  { label: 'Product',      href: '/analyze'      },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing',      href: '/pricing'      },
  { label: 'Markets',      href: '/markets'      },
]

export default function LandingNavbar() {
  const { data: session } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 12)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      {/* ── Floating navbar ───────────────────────────────────────────────── */}
      <header className="fixed top-0 left-0 right-0 z-50 px-3 sm:px-5 pt-3 pointer-events-none">
        <div className="mx-auto pointer-events-auto" style={{ maxWidth: '1280px' }}>
          <div
            className="h-[72px] px-6 sm:px-8 rounded-2xl"
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'center',
              background: 'rgba(255,255,255,0.97)',
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
              border: '1px solid rgba(227,230,224,0.85)',
              boxShadow: scrolled
                ? '0 8px 32px rgba(6,16,31,0.12), 0 2px 8px rgba(6,16,31,0.06)'
                : '0 4px 24px rgba(6,16,31,0.08), 0 1px 4px rgba(6,16,31,0.04)',
              transition: 'box-shadow 0.3s ease',
            }}
          >
            {/* ── Column 1: Logo — left-aligned ── */}
            <div style={{ display: 'flex', alignItems: 'center' }}>
              <Link href="/" aria-label="insic home" style={{ display: 'flex', alignItems: 'center', lineHeight: 0 }}>
                <InsicLogo
                  variant="horizontal"
                  className="block w-auto"
                  style={{ height: '44px' }}
                />
              </Link>
            </div>

            {/* ── Column 2: Nav links — mathematically centered ── */}
            <nav className="hidden lg:flex items-center gap-0.5">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  className="px-4 py-2 rounded-[8px] text-[14.5px] font-medium text-[#536174] hover:text-[#0A1424] hover:bg-[#F3F2EC] transition-all duration-150 whitespace-nowrap"
                >
                  {link.label}
                </Link>
              ))}
            </nav>

            {/* ── Column 3: CTA — right-aligned ── */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'flex-end', gap: '12px' }}>
              {session ? (
                <Link
                  href="/analyze"
                  className="hidden sm:inline-flex items-center justify-center rounded-[10px] px-6 py-2.5 text-[14px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95 whitespace-nowrap"
                  style={{ background: '#5F790B', boxShadow: '0 4px 12px rgba(95,121,11,0.25)', minHeight: '44px' }}
                >
                  Go to app
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => signIn('google')}
                    className="hidden sm:block text-[14px] font-medium text-[#536174] hover:text-[#0A1424] transition-colors px-3 whitespace-nowrap"
                    style={{ minHeight: '44px' }}
                  >
                    Sign in
                  </button>
                  <button
                    onClick={() => signIn('google')}
                    className="hidden sm:inline-flex items-center justify-center rounded-[10px] px-7 py-2.5 text-[14px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95 whitespace-nowrap"
                    style={{ background: '#5F790B', boxShadow: '0 4px 12px rgba(95,121,11,0.25)', minHeight: '44px' }}
                  >
                    Get started
                  </button>
                </>
              )}

              {/* Mobile hamburger */}
              <button
                onClick={() => setMobileOpen(v => !v)}
                className="lg:hidden flex items-center justify-center w-10 h-10 rounded-[8px] text-[#536174] hover:bg-[#F3F2EC] hover:text-[#0A1424] transition-colors"
                aria-label="Toggle menu"
              >
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* ── Mobile menu ───────────────────────────────────────────────────── */}
      <AnimatePresence>
        {mobileOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
            className="fixed top-[88px] left-3 right-3 z-40 lg:hidden rounded-2xl overflow-hidden"
            style={{
              background: 'rgba(255,255,255,0.98)',
              border: '1px solid #E3E6E0',
              boxShadow: '0 16px 40px rgba(6,16,31,0.14)',
            }}
          >
            <nav className="flex flex-col p-3 gap-0.5">
              {NAV_LINKS.map(link => (
                <Link
                  key={link.label}
                  href={link.href}
                  onClick={() => setMobileOpen(false)}
                  className="flex items-center py-3 px-4 rounded-[10px] text-[15px] font-medium text-[#536174] hover:bg-[#EEF4DD] hover:text-[#0A1424] transition-colors"
                  style={{ minHeight: '44px' }}
                >
                  {link.label}
                </Link>
              ))}
            </nav>
            <div className="px-3 pb-3 flex flex-col gap-2.5">
              {session ? (
                <Link
                  href="/analyze"
                  onClick={() => setMobileOpen(false)}
                  className="w-full text-center rounded-[10px] py-3.5 text-[15px] font-semibold text-white flex items-center justify-center"
                  style={{ background: '#5F790B', minHeight: '48px' }}
                >
                  Go to app
                </Link>
              ) : (
                <>
                  <button
                    onClick={() => { setMobileOpen(false); signIn('google') }}
                    className="w-full rounded-[10px] py-3.5 text-[15px] font-semibold text-white"
                    style={{ background: '#5F790B', minHeight: '48px' }}
                  >
                    Get started free
                  </button>
                  <button
                    onClick={() => { setMobileOpen(false); signIn('google') }}
                    className="w-full rounded-[10px] py-3.5 text-[15px] font-semibold text-[#536174] border border-[#E3E6E0] hover:bg-[#F3F2EC] transition-colors"
                    style={{ minHeight: '48px' }}
                  >
                    Sign in
                  </button>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  )
}
