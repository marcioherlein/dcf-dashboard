'use client'
import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { useSession, signIn } from 'next-auth/react'
import { Menu, X } from 'lucide-react'

const NAV_LINKS = [
  { label: 'Product', href: '/analyze' },
  { label: 'How it works', href: '#how-it-works' },
  { label: 'Pricing', href: '/pricing' },
  { label: 'Markets', href: '/markets' },
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
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-200"
        style={{
          height: '60px',
          background: scrolled ? 'rgba(255,255,255,0.96)' : 'rgba(255,255,255,0.92)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderBottom: scrolled ? '1px solid rgba(226,232,240,0.9)' : '1px solid rgba(226,232,240,0.5)',
          boxShadow: scrolled ? '0 1px 12px rgba(15,23,42,0.08)' : 'none',
        }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-full flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Image
              src="/logos/logo.png"
              alt="intrinsico"
              width={36}
              height={36}
              className="transition-transform duration-200 group-hover:scale-105"
            />
            <span
              className="font-black hidden sm:block"
              style={{
                fontSize: '20px',
                letterSpacing: '-0.04em',
                background: 'linear-gradient(135deg, #0F172A 20%, #1E40AF 65%, #2563EB 100%)',
                WebkitBackgroundClip: 'text',
                WebkitTextFillColor: 'transparent',
                backgroundClip: 'text',
              }}
            >
              intrinsico
            </span>
          </Link>

          {/* Center nav */}
          <nav className="hidden lg:flex items-center gap-9 flex-1 justify-center">
            {NAV_LINKS.map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] font-medium text-[#334155] hover:text-[#2563EB] transition-colors duration-150"
                style={{ fontWeight: 500 }}
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
                className="hidden sm:inline-flex items-center rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95"
                style={{
                  background: '#2563EB',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                  fontSize: '13px',
                  fontWeight: 650,
                  minHeight: '44px',
                }}
              >
                Go to app
              </Link>
            ) : (
              <>
                <button
                  onClick={() => signIn('google')}
                  className="hidden sm:block text-[13px] font-medium text-[#334155] hover:text-[#0F172A] transition-colors min-h-[44px] px-2"
                >
                  Sign in
                </button>
                <Link
                  href="/pricing"
                  className="hidden lg:inline-flex items-center rounded-xl border px-4 py-2.5 text-[13px] font-semibold text-[#1D4ED8] transition-all hover:bg-[#EFF6FF] active:scale-95"
                  style={{
                    borderColor: '#BFDBFE',
                    background: 'white',
                    minHeight: '44px',
                  }}
                >
                  Analyze a stock
                </Link>
                <button
                  onClick={() => signIn('google')}
                  className="hidden sm:inline-flex items-center rounded-xl px-4 py-2.5 text-[13px] font-semibold text-white transition-all hover:-translate-y-px active:scale-95"
                  style={{
                    background: '#2563EB',
                    boxShadow: '0 6px 16px rgba(37,99,235,0.22)',
                    fontSize: '13px',
                    minHeight: '44px',
                  }}
                >
                  Start free trial
                </button>
              </>
            )}

            {/* Mobile hamburger — thumb-reachable, min 44px */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden flex items-center justify-center rounded-lg text-[#334155] hover:bg-slate-100 transition-colors active:scale-95"
              aria-label="Toggle menu"
              style={{ width: '44px', height: '44px' }}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="fixed top-[60px] left-0 right-0 z-40 bg-white/96 backdrop-blur-xl border-b border-slate-200 shadow-lg lg:hidden"
          style={{ padding: '16px 16px 20px' }}
        >
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="py-3 px-4 rounded-xl text-[16px] font-medium text-[#334155] hover:text-[#2563EB] hover:bg-slate-50 transition-colors active:scale-95"
                style={{ minHeight: '44px', display: 'flex', alignItems: 'center' }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-3">
            {session ? (
              <Link
                href="/analyze"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center rounded-xl py-3.5 text-[15px] font-semibold text-white active:scale-95 transition-all"
                style={{ background: '#2563EB', minHeight: '44px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >
                Go to app
              </Link>
            ) : (
              <>
                <button
                  onClick={() => { setMobileOpen(false); signIn('google') }}
                  className="w-full text-center rounded-xl py-3.5 text-[15px] font-semibold text-white active:scale-95 transition-all"
                  style={{ background: '#2563EB', minHeight: '44px' }}
                >
                  Start free trial
                </button>
                <button
                  onClick={() => { setMobileOpen(false); signIn('google') }}
                  className="w-full text-center rounded-xl py-3.5 text-[15px] font-semibold text-[#334155] border border-slate-200 hover:bg-slate-50 active:scale-95 transition-all"
                  style={{ minHeight: '44px' }}
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
