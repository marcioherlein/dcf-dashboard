'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useSession, signIn } from 'next-auth/react'
import { Menu, X } from 'lucide-react'
import { InsicLogo } from '@/components/ui/InsicLogo'

const NAV_LINKS = [
  { label: 'Product',       href: '/analyze'      },
  { label: 'How it works',  href: '#how-it-works' },
  { label: 'Pricing',       href: '/pricing'      },
  { label: 'Markets',       href: '/markets'      },
]

export default function LandingNavbar() {
  const { data: session } = useSession()
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          height: '60px',
          background: 'rgba(248, 247, 242, 0.97)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: scrolled
            ? '1px solid #E3E6E0'
            : '1px solid rgba(227, 230, 224, 0.5)',
          boxShadow: scrolled ? '0 4px 20px rgba(6, 16, 31, 0.07)' : 'none',
        }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-full flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center shrink-0 leading-none" aria-label="insic home">
            <InsicLogo variant="horizontal" className="h-7 w-auto block" />
          </Link>

          {/* Center nav */}
          <nav className="hidden lg:flex items-center gap-8 flex-1 justify-center">
            {NAV_LINKS.map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] font-medium transition-colors duration-150 text-[#536174] hover:text-[#0A1424]"
              >
                {link.label}
              </Link>
            ))}
          </nav>

          {/* Right actions */}
          <div className="ml-auto flex items-center gap-3 shrink-0">
            {session ? (
              <Link
                href="/analyze"
                className="hidden sm:inline-flex items-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95 min-h-[44px]"
                style={{ background: '#5F790B', boxShadow: '0 4px 12px rgba(95, 121, 11, 0.22)' }}
              >
                Go to app
              </Link>
            ) : (
              <>
                <button
                  onClick={() => signIn('google')}
                  className="hidden sm:block text-[13px] font-medium text-[#536174] hover:text-[#0A1424] transition-colors min-h-[44px] px-2"
                >
                  Sign in
                </button>
                <Link
                  href="/analyze"
                  className="hidden lg:inline-flex items-center rounded-[10px] border border-[#CBD1C4] bg-white px-4 py-2.5 text-[13.5px] font-semibold text-[#0A1424] hover:bg-[#F6FAEA] hover:border-[#5F790B] transition-colors min-h-[44px]"
                >
                  Analyze a stock
                </Link>
                <button
                  onClick={() => signIn('google')}
                  className="hidden sm:inline-flex items-center rounded-[10px] px-4 py-2.5 text-[13.5px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95 min-h-[44px]"
                  style={{ background: '#5F790B', boxShadow: '0 4px 12px rgba(95, 121, 11, 0.22)' }}
                >
                  Get started free
                </button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden flex items-center justify-center w-11 h-11 rounded-[10px] text-[#536174] hover:bg-[#F3F2EC] hover:text-[#0A1424] transition-colors active:scale-95"
              aria-label="Toggle menu"
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="fixed top-[60px] left-0 right-0 z-40 border-b shadow-card lg:hidden"
          style={{
            padding: '16px 16px 20px',
            background: '#F8F7F2',
            borderColor: '#E3E6E0',
          }}
        >
          <nav className="flex flex-col gap-0.5">
            {NAV_LINKS.map(link => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="flex items-center py-3 px-4 rounded-[10px] text-[15px] font-medium text-[#536174] hover:bg-[#EEF4DD] hover:text-[#0A1424] transition-colors min-h-[44px] active:scale-95"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 pt-4 border-t border-[#E3E6E0] flex flex-col gap-3">
            {session ? (
              <Link
                href="/analyze"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center rounded-[10px] py-3.5 text-[15px] font-semibold text-white active:scale-95 transition-all min-h-[44px] flex items-center justify-center"
                style={{ background: '#5F790B' }}
              >
                Go to app
              </Link>
            ) : (
              <>
                <button
                  onClick={() => { setMobileOpen(false); signIn('google') }}
                  className="w-full text-center rounded-[10px] py-3.5 text-[15px] font-semibold text-white active:scale-95 transition-all min-h-[44px]"
                  style={{ background: '#5F790B' }}
                >
                  Get started free
                </button>
                <button
                  onClick={() => { setMobileOpen(false); signIn('google') }}
                  className="w-full text-center rounded-[10px] py-3.5 text-[15px] font-semibold text-[#536174] border border-[#E3E6E0] hover:bg-[#F3F2EC] transition-colors active:scale-95 min-h-[44px]"
                >
                  Sign in
                </button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  )
}
