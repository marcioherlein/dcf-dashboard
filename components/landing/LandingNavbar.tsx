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
          height: '72px',
          background: scrolled ? 'rgba(255,255,255,0.92)' : 'rgba(255,255,255,0.86)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          borderBottom: scrolled ? '1px solid rgba(226,232,240,0.9)' : '1px solid rgba(226,232,240,0.5)',
          boxShadow: scrolled ? '0 1px 12px rgba(15,23,42,0.06)' : 'none',
        }}
      >
        <div className="mx-auto max-w-[1280px] px-6 h-full flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5 shrink-0 group">
            <Image
              src="/logos/logo.png"
              alt="Intrinsico"
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
              Intrinsico
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
                className="hidden sm:inline-flex items-center rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all hover:-translate-y-px"
                style={{
                  background: '#2563EB',
                  boxShadow: '0 4px 12px rgba(37,99,235,0.25)',
                  fontSize: '13px',
                  fontWeight: 650,
                }}
              >
                Go to app
              </Link>
            ) : (
              <>
                <button
                  onClick={() => signIn('google')}
                  className="hidden sm:block text-[13px] font-medium text-[#334155] hover:text-[#0F172A] transition-colors"
                >
                  Sign in
                </button>
                <Link
                  href="/pricing"
                  className="hidden sm:inline-flex items-center rounded-xl border px-4 py-2 text-[13px] font-semibold text-[#1D4ED8] transition-all hover:bg-[#EFF6FF]"
                  style={{
                    borderColor: '#BFDBFE',
                    background: 'white',
                  }}
                >
                  Analyze a stock
                </Link>
                <button
                  onClick={() => signIn('google')}
                  className="inline-flex items-center rounded-xl px-4 py-2 text-[13px] font-semibold text-white transition-all hover:-translate-y-px active:translate-y-0"
                  style={{
                    background: '#2563EB',
                    boxShadow: '0 6px 16px rgba(37,99,235,0.22)',
                    fontSize: '13px',
                  }}
                >
                  Start free trial
                </button>
              </>
            )}

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden p-2 rounded-lg text-[#334155] hover:bg-slate-100 transition-colors"
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
          className="fixed top-[72px] left-0 right-0 z-40 bg-white border-b border-slate-200 shadow-lg lg:hidden"
          style={{ padding: '16px 24px 20px' }}
        >
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="py-3 px-3 rounded-lg text-[15px] font-medium text-[#334155] hover:text-[#2563EB] hover:bg-slate-50 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div className="mt-4 pt-4 border-t border-slate-100 flex flex-col gap-2">
            {session ? (
              <Link
                href="/analyze"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center rounded-xl py-3 text-[14px] font-semibold text-white"
                style={{ background: '#2563EB' }}
              >
                Go to app
              </Link>
            ) : (
              <>
                <button
                  onClick={() => { setMobileOpen(false); signIn('google') }}
                  className="w-full text-center rounded-xl py-3 text-[14px] font-semibold text-white"
                  style={{ background: '#2563EB' }}
                >
                  Start free trial
                </button>
                <button
                  onClick={() => { setMobileOpen(false); signIn('google') }}
                  className="w-full text-center rounded-xl py-3 text-[14px] font-semibold text-[#334155] border border-slate-200 hover:bg-slate-50"
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
