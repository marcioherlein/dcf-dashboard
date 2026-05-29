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

  // Dark (transparent) when over hero; white glass when scrolled into content
  const dark = !scrolled

  return (
    <>
      <header
        className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
        style={{
          height: '60px',
          background: dark
            ? 'transparent'
            : scrolled
            ? 'rgba(255,255,255,0.96)'
            : 'rgba(255,255,255,0.92)',
          backdropFilter: dark ? 'none' : 'blur(20px)',
          WebkitBackdropFilter: dark ? 'none' : 'blur(20px)',
          borderBottom: dark
            ? '1px solid rgba(255,255,255,0.07)'
            : scrolled
            ? '1px solid rgba(226,232,240,0.9)'
            : '1px solid rgba(226,232,240,0.5)',
          boxShadow: dark ? 'none' : scrolled ? '0 1px 12px rgba(15,23,42,0.08)' : 'none',
        }}
      >
        <div className="mx-auto max-w-[1280px] px-4 sm:px-6 h-full flex items-center gap-8">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-3 shrink-0 group">
            <Image
              src="/logos/logo.png"
              alt="intrinsico"
              width={40}
              height={40}
              className="transition-transform duration-200 group-hover:scale-105"
            />
            <div className="flex flex-col leading-none">
              <span
                className="font-black text-[17px] sm:text-[20px] transition-colors duration-300"
                style={{
                  letterSpacing: '-0.04em',
                  lineHeight: 1.15,
                  color: dark ? '#F8FAFC' : '#0F172A',
                }}
              >
                intrinsico
              </span>
              <span
                className="hidden sm:block text-[8px] font-bold tracking-[0.18em] uppercase mt-0.5 transition-colors duration-300"
                style={{ color: dark ? '#475569' : '#94A3B8' }}
              >
                Valuation Intelligence
              </span>
            </div>
          </Link>

          {/* Center nav */}
          <nav className="hidden lg:flex items-center gap-9 flex-1 justify-center">
            {NAV_LINKS.map(link => (
              <Link
                key={link.label}
                href={link.href}
                className="text-[14px] font-medium transition-colors duration-150"
                style={{
                  fontWeight: 500,
                  color: dark ? '#94A3B8' : '#334155',
                }}
                onMouseEnter={e => {
                  ;(e.currentTarget as HTMLAnchorElement).style.color = dark ? '#F1F5F9' : '#2563EB'
                }}
                onMouseLeave={e => {
                  ;(e.currentTarget as HTMLAnchorElement).style.color = dark ? '#94A3B8' : '#334155'
                }}
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
                  className="hidden sm:block text-[13px] font-medium transition-colors min-h-[44px] px-2"
                  style={{ color: dark ? '#94A3B8' : '#334155' }}
                  onMouseEnter={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.color = dark ? '#F1F5F9' : '#0F172A'
                  }}
                  onMouseLeave={e => {
                    ;(e.currentTarget as HTMLButtonElement).style.color = dark ? '#94A3B8' : '#334155'
                  }}
                >
                  Sign in
                </button>
                <Link
                  href="/pricing"
                  className="hidden lg:inline-flex items-center rounded-xl border px-4 py-2.5 text-[13px] font-semibold transition-all active:scale-95"
                  style={{
                    borderColor: dark ? 'rgba(255,255,255,0.16)' : '#BFDBFE',
                    background: dark ? 'rgba(255,255,255,0.06)' : 'white',
                    color: dark ? '#CBD5E1' : '#1D4ED8',
                    minHeight: '44px',
                  }}
                  onMouseEnter={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.background = dark ? 'rgba(255,255,255,0.10)' : '#EFF6FF'
                    el.style.borderColor = dark ? 'rgba(255,255,255,0.28)' : '#93C5FD'
                    el.style.color = dark ? '#F1F5F9' : '#1D4ED8'
                  }}
                  onMouseLeave={e => {
                    const el = e.currentTarget as HTMLAnchorElement
                    el.style.background = dark ? 'rgba(255,255,255,0.06)' : 'white'
                    el.style.borderColor = dark ? 'rgba(255,255,255,0.16)' : '#BFDBFE'
                    el.style.color = dark ? '#CBD5E1' : '#1D4ED8'
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

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(v => !v)}
              className="lg:hidden flex items-center justify-center rounded-lg transition-colors active:scale-95"
              aria-label="Toggle menu"
              style={{
                width: '44px',
                height: '44px',
                color: dark ? '#94A3B8' : '#334155',
              }}
              onMouseEnter={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = dark
                  ? 'rgba(255,255,255,0.08)'
                  : '#F1F5F9'
              }}
              onMouseLeave={e => {
                ;(e.currentTarget as HTMLButtonElement).style.background = 'transparent'
              }}
            >
              {mobileOpen ? <X size={20} /> : <Menu size={20} />}
            </button>
          </div>
        </div>
      </header>

      {/* Mobile menu */}
      {mobileOpen && (
        <div
          className="fixed top-[60px] left-0 right-0 z-40 backdrop-blur-xl border-b shadow-lg lg:hidden"
          style={{
            padding: '16px 16px 20px',
            background: dark ? 'rgba(5,13,31,0.97)' : 'rgba(255,255,255,0.97)',
            borderColor: dark ? 'rgba(255,255,255,0.09)' : '#E2E8F0',
          }}
        >
          <nav className="flex flex-col gap-1">
            {NAV_LINKS.map(link => (
              <Link
                key={link.label}
                href={link.href}
                onClick={() => setMobileOpen(false)}
                className="py-3 px-4 rounded-xl text-[16px] font-medium transition-colors active:scale-95"
                style={{
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  color: dark ? '#94A3B8' : '#334155',
                }}
                onMouseEnter={e => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.color = dark ? '#F1F5F9' : '#2563EB'
                  el.style.background = dark ? 'rgba(255,255,255,0.06)' : '#F8FAFC'
                }}
                onMouseLeave={e => {
                  const el = e.currentTarget as HTMLAnchorElement
                  el.style.color = dark ? '#94A3B8' : '#334155'
                  el.style.background = 'transparent'
                }}
              >
                {link.label}
              </Link>
            ))}
          </nav>
          <div
            className="mt-4 pt-4 border-t flex flex-col gap-3"
            style={{ borderColor: dark ? 'rgba(255,255,255,0.08)' : '#F1F5F9' }}
          >
            {session ? (
              <Link
                href="/analyze"
                onClick={() => setMobileOpen(false)}
                className="w-full text-center rounded-xl py-3.5 text-[15px] font-semibold text-white active:scale-95 transition-all"
                style={{
                  background: '#2563EB',
                  minHeight: '44px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
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
                  className="w-full text-center rounded-xl py-3.5 text-[15px] font-semibold active:scale-95 transition-all"
                  style={{
                    minHeight: '44px',
                    color: dark ? '#94A3B8' : '#334155',
                    border: `1px solid ${dark ? 'rgba(255,255,255,0.12)' : '#E2E8F0'}`,
                    background: dark ? 'rgba(255,255,255,0.05)' : 'transparent',
                  }}
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
