import Link from 'next/link'
import { InsicLogo } from '@/components/ui/InsicLogo'

const NAV_COLS = [
  {
    items: [
      { label: 'Product', href: '/analyze' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'About', href: '/about' },
      { label: 'Blog', href: '/blog' },
      { label: 'Help', href: '/help' },
    ],
  },
  {
    items: [
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
]

export default function LandingFooter() {
  return (
    <footer style={{ background: '#0A1424', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-10 sm:py-14">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">

          {/* Brand column */}
          <div className="max-w-[240px]">
            <Link href="/" className="flex items-center gap-2 mb-3 group" aria-label="insic home">
              <InsicLogo variant="horizontal" className="h-7 w-auto brightness-0 invert" />
            </Link>
            <p className="text-[13px] text-[#536174] leading-relaxed mb-5">
              Invest with a process, not a story.
            </p>

            {/* Social icons */}
            <div className="flex items-center gap-3">
              {[
                {
                  label: 'Twitter / X',
                  href: 'https://twitter.com',
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                      <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.744l7.737-8.835L1.254 2.25H8.08l4.258 5.63L18.244 2.25zm-1.161 17.52h1.833L7.084 4.126H5.117L17.083 19.77z"/>
                    </svg>
                  ),
                },
                {
                  label: 'LinkedIn',
                  href: 'https://linkedin.com',
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                      <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 01-2.063-2.065 2.064 2.064 0 112.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                    </svg>
                  ),
                },
                {
                  label: 'YouTube',
                  href: 'https://youtube.com',
                  icon: (
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="currentColor">
                      <path d="M23.498 6.186a3.016 3.016 0 00-2.122-2.136C19.505 3.545 12 3.545 12 3.545s-7.505 0-9.377.505A3.017 3.017 0 00.502 6.186C0 8.07 0 12 0 12s0 3.93.502 5.814a3.016 3.016 0 002.122 2.136c1.871.505 9.376.505 9.376.505s7.505 0 9.377-.505a3.015 3.015 0 002.122-2.136C24 15.93 24 12 24 12s0-3.93-.502-5.814zM9.545 15.568V8.432L15.818 12l-6.273 3.568z"/>
                    </svg>
                  ),
                },
              ].map(s => (
                <a
                  key={s.label}
                  href={s.href}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={s.label}
                  className="w-8 h-8 rounded-full border border-[rgba(255,255,255,0.12)] flex items-center justify-center text-[#536174] hover:text-white hover:border-[rgba(255,255,255,0.28)] transition-colors"
                >
                  {s.icon}
                </a>
              ))}
            </div>
          </div>

          {/* Nav columns */}
          <div className="flex gap-12 sm:gap-16">
            {/* Main nav */}
            <nav className="flex flex-col gap-2.5">
              {NAV_COLS[0].items.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-[13px] text-[#536174] hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
            {/* Legal nav */}
            <nav className="flex flex-col gap-2.5">
              {NAV_COLS[1].items.map(item => (
                <Link
                  key={item.label}
                  href={item.href}
                  className="text-[13px] text-[#536174] hover:text-white transition-colors"
                >
                  {item.label}
                </Link>
              ))}
            </nav>
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-[rgba(255,255,255,0.07)]">
          <p className="text-[11px] text-[#536174] leading-relaxed">
            Not financial advice. See Terms.
          </p>
          <p className="text-[11px] text-[#536174] mt-1">
            © 2025 insic. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
