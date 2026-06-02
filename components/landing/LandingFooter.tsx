import Link from 'next/link'
import Image from 'next/image'

export default function LandingFooter() {
  return (
    <footer style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-8 sm:py-12">
        {/* Top row — single column on mobile */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 mb-8 sm:mb-10">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5 mb-3 group active:scale-95 transition-transform">
              <Image
                src="/logos/logo-transparent.png"
                alt="insic"
                width={30}
                height={30}
                className="transition-transform duration-200 group-hover:scale-105"
              />
              <span
                className="font-black text-[17px]"
                style={{
                  letterSpacing: '-0.04em',
                  background: 'linear-gradient(135deg, #0F172A 20%, #1E40AF 65%, #2563EB 100%)',
                  WebkitBackgroundClip: 'text',
                  WebkitTextFillColor: 'transparent',
                  backgroundClip: 'text',
                }}
              >
                insic
              </span>
            </Link>
            <p className="text-sm text-slate-500 leading-relaxed">
              The disciplined valuation process for serious self-directed investors.
            </p>
          </div>

          {/* Links — wrapping row on mobile */}
          <div className="flex flex-wrap gap-x-8 gap-y-6">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Product</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Markets', href: '/markets' },
                  { label: 'Analyze', href: '/analyze' },
                  { label: 'Pricing', href: '/pricing' },
                ].map(l => (
                  <Link key={l.label} href={l.href} className="text-sm text-slate-500 hover:text-slate-800 transition-colors py-1" style={{ minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Account</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Portfolio', href: '/monitor' },
                  { label: 'Saved', href: '/valuations' },
                  { label: 'AI', href: '/ai-stack' },
                ].map(l => (
                  <Link key={l.label} href={l.href} className="text-sm text-slate-500 hover:text-slate-800 transition-colors py-1" style={{ minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Legal</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Terms', href: '/terms' },
                  { label: 'Privacy', href: '/privacy' },
                  { label: 'Contact', href: 'mailto:hello@insic.app' },
                ].map(l => (
                  <a key={l.label} href={l.href} className="text-sm text-slate-500 hover:text-slate-800 transition-colors py-1" style={{ minHeight: '36px', display: 'flex', alignItems: 'center' }}>
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 pt-6">
          {/* Disclaimer */}
          <p className="text-[12px] text-slate-400 leading-relaxed max-w-3xl mb-3">
            <strong className="text-slate-500">Not financial advice.</strong>{' '}
            All content — DCF models, fair value estimates, health scores, and scenario analyses — is provided
            for informational and educational purposes only. Model outputs are based on publicly available data
            and mathematical assumptions; they are not recommendations to buy, sell, or hold any security.
            Always consult a qualified financial advisor before making investment decisions.
          </p>
          <p className="text-[12px] text-slate-400">
            Data sourced from Yahoo Finance, FRED, and Damodaran&apos;s research. &nbsp;
            © {new Date().getFullYear()} insic. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
