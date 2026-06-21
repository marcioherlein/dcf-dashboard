import Link from 'next/link'
import { GitCompare, Cpu, Layers, ArrowRight } from 'lucide-react'

const DIFFERENTIATORS = [
  {
    icon: <GitCompare size={22} strokeWidth={2} className="text-[#5F790B]" />,
    name: 'Reverse DCF',
    tagline: 'What growth is the market pricing in?',
    description:
      'Enter any ticker and instantly see the revenue CAGR implied by the current price. Know whether the market is being greedy or fearful — in numbers, not opinions.',
    href: '/analyze',
    cta: 'Try it →',
  },
  {
    icon: <GitCompare size={22} strokeWidth={2} className="text-[#5F790B]" />,
    name: 'Multi-ticker Compare',
    tagline: 'Pairs trading with real signals.',
    description:
      'Compare any two tickers on indexed performance, Pearson correlation, ratio Z-score, and mean-reversion divergence signals. Find pairs that are out of sync.',
    href: '/compare',
    cta: 'Compare stocks →',
  },
  {
    icon: <Cpu size={22} strokeWidth={2} className="text-[#5F790B]" />,
    name: 'AI Stack Screener',
    tagline: '125 AI infrastructure companies, all scored.',
    description:
      'Every major AI chip, data centre, cloud, and software company ranked by a composite DCF score across 16 supply-chain layers. Updated daily.',
    href: '/ai-stack',
    cta: 'Explore AI Stack →',
  },
  {
    icon: <Layers size={22} strokeWidth={2} className="text-[#5F790B]" />,
    name: 'Quant Strategies',
    tagline: 'Systematic, not speculative.',
    description:
      'Five academic factor strategies — Quality, Momentum, Value, Low Volatility, and Deep Value — applied to the live market. See the current top-ranked stocks for each.',
    href: '/strategies',
    cta: 'View strategies →',
  },
]

export default function ToolSurfaceSection() {
  return (
    <section className="bg-[#F8F9FA] border-t border-[#E5E5E5] py-16 sm:py-20">
      <div className="max-w-5xl mx-auto px-4 sm:px-6">

        <div className="mb-10 sm:mb-12">
          <p className="text-[12px] font-bold uppercase tracking-[0.1em] text-[#5F790B] mb-3">
            What insic does differently
          </p>
          <h2 className="text-[26px] sm:text-[34px] font-bold text-[#111111] leading-tight" style={{ letterSpacing: '-0.025em' }}>
            Tools competitors don&apos;t have<br className="hidden sm:block" /> at this price point.
          </h2>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
          {DIFFERENTIATORS.map((item) => (
            <div
              key={item.name}
              className="bg-white border border-[#E5E5E5] rounded-2xl p-6 flex flex-col gap-3 hover:border-[#BFD2A1] transition-colors"
              style={{ boxShadow: '0 1px 4px rgba(0,0,0,0.04)' }}
            >
              <div className="w-10 h-10 rounded-lg bg-[#EEF3D8] flex items-center justify-center shrink-0">
                {item.icon}
              </div>
              <div>
                <p className="text-[15px] font-bold text-[#111111] leading-snug">{item.name}</p>
                <p className="text-[12px] font-semibold text-[#5F790B] mt-0.5">{item.tagline}</p>
              </div>
              <p className="text-[13px] text-[#6B6B6B] leading-relaxed flex-1">
                {item.description}
              </p>
              <Link
                href={item.href}
                className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-[#5F790B] hover:text-[#526A08] transition-colors mt-1"
              >
                {item.cta}
                <ArrowRight size={13} strokeWidth={2.5} />
              </Link>
            </div>
          ))}
        </div>

      </div>
    </section>
  )
}
