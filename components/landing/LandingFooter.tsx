import Link from 'next/link'
import Image from 'next/image'

export default function LandingFooter() {
  return (
    <footer style={{ background: '#F8FAFC', borderTop: '1px solid #E2E8F0' }}>
      <div className="mx-auto max-w-[1200px] px-6 py-12">
        {/* Top row */}
        <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-8 mb-10">
          {/* Brand */}
          <div className="max-w-xs">
            <Link href="/" className="flex items-center gap-2.5 mb-3">
              <div className="w-7 h-7 rounded-full overflow-hidden">
                <Image src="/logos/logo.png" alt="Intrinsico" width={28} height={28} className="w-full h-full object-cover" />
              </div>
              <span className="font-bold text-[#0F172A] text-[16px]" style={{ letterSpacing: '-0.02em' }}>
                Intrinsico
              </span>
            </Link>
            <p className="text-[13px] text-slate-500 leading-relaxed">
              The disciplined valuation process for serious self-directed investors.
            </p>
          </div>

          {/* Links */}
          <div className="flex flex-wrap gap-x-10 gap-y-4">
            <div>
              <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider mb-3">Product</p>
              <div className="flex flex-col gap-2">
                {[
                  { label: 'Markets', href: '/markets' },
                  { label: 'Analyze', href: '/analyze' },
                  { label: 'Pricing', href: '/pricing' },
                ].map(l => (
                  <Link key={l.label} href={l.href} className="text-[13px] text-slate-500 hover:text-slate-800 transition-colors">
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
                  <Link key={l.label} href={l.href} className="text-[13px] text-slate-500 hover:text-slate-800 transition-colors">
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
                  { label: 'Contact', href: 'mailto:hello@intrinsico.capital' },
                ].map(l => (
                  <a key={l.label} href={l.href} className="text-[13px] text-slate-500 hover:text-slate-800 transition-colors">
                    {l.label}
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Divider */}
        <div className="border-t border-slate-200 pt-8">
          {/* Disclaimer */}
          <p className="text-[12px] text-slate-400 leading-relaxed max-w-3xl mb-4">
            <strong className="text-slate-500">Not financial advice.</strong>{' '}
            All content — DCF models, fair value estimates, health scores, and scenario analyses — is provided
            for informational and educational purposes only. Model outputs are based on publicly available data
            and mathematical assumptions; they are not recommendations to buy, sell, or hold any security.
            Always consult a qualified financial advisor before making investment decisions.
          </p>
          <p className="text-[12px] text-slate-400">
            Data sourced from Yahoo Finance, FRED, and Damodaran&apos;s research. &nbsp;
            © {new Date().getFullYear()} Intrinsico. All rights reserved.
          </p>
        </div>
      </div>
    </footer>
  )
}
