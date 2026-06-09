import Link from 'next/link'
import { InsicLogoLockup } from '@/components/ui/InsicLogo'

const NAV_COLS = [
  {
    label: 'Site links',
    items: [
      { label: 'Product', href: '/analyze' },
      { label: 'Pricing', href: '/pricing' },
      { label: 'Privacy', href: '/privacy' },
      { label: 'Terms', href: '/terms' },
    ],
  },
]

export default function LandingFooter() {
  return (
    <footer style={{ background: '#111111', borderTop: '1px solid rgba(255,255,255,0.07)' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 pt-10 sm:pt-14 pb-[calc(2.5rem+env(safe-area-inset-bottom,0px))] sm:pb-[calc(3.5rem+env(safe-area-inset-bottom,0px))]">
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8">

          {/* Brand column */}
          <div className="max-w-[240px]">
            <Link href="/" className="flex items-center gap-2 mb-3 group" aria-label="insic home">
              <InsicLogoLockup size="md" on="dark" />
            </Link>
            <p className="text-[13px] text-[#6B6B6B] leading-relaxed">
              Invest with a process, not a story.
            </p>
          </div>

          {/* Nav columns */}
          <div className="flex gap-12 sm:gap-16">
            {NAV_COLS.map(col => (
              <nav key={col.label} aria-label={col.label} className="flex flex-col gap-2.5">
                {col.items.map(item => (
                  <Link
                    key={item.label}
                    href={item.href}
                    className="text-[13px] text-[#6B6B6B] hover:text-white transition-colors min-h-[44px] flex items-center"
                  >
                    {item.label}
                  </Link>
                ))}
              </nav>
            ))}
          </div>
        </div>

        {/* Bottom bar */}
        <div className="mt-10 pt-6 border-t border-[rgba(255,255,255,0.07)]">
          <p className="text-[11px] text-[#6B6B6B] leading-relaxed">
            Not financial advice. See Terms.
          </p>
          <p className="text-[11px] text-[#6B6B6B] mt-1">
            © {new Date().getFullYear()} insic. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
