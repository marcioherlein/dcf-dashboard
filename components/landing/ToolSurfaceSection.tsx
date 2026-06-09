import Link from 'next/link'
import { TrendingUp, BarChart3, Bookmark } from 'lucide-react'

interface ToolGroup {
  icon: React.ReactNode
  name: string
  description: string
  links: { label: string; href: string }[]
}

const TOOL_GROUPS: ToolGroup[] = [
  {
    icon: <TrendingUp size={22} strokeWidth={2} className="text-[#5F790B]" />,
    name: 'Research',
    description:
      'Analyze any ticker with a full DCF and 5 valuation methods. Screen the market by fundamentals.',
    links: [
      { label: 'Analyze', href: '/analyze' },
      { label: 'Screener', href: '/screener' },
    ],
  },
  {
    icon: <BarChart3 size={22} strokeWidth={2} className="text-[#5F790B]" />,
    name: 'Assess',
    description:
      'Market-implied expectations, sensitivity tables, and scenario modeling.',
    links: [
      { label: 'Valuation cockpit', href: '/analyze' },
      { label: 'ETF tracker', href: '/etf' },
    ],
  },
  {
    icon: <Bookmark size={22} strokeWidth={2} className="text-[#5F790B]" />,
    name: 'Track',
    description:
      'Save valuations, monitor fair value vs price, and follow markets.',
    links: [
      { label: 'My Valuations', href: '/valuations' },
      { label: 'Markets', href: '/markets' },
    ],
  },
]

export default function ToolSurfaceSection() {
  return (
    <section className="bg-white py-16">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-10">
          <h2 className="text-[28px] sm:text-[36px] font-bold text-[#111111] leading-tight">
            Every tool serious investors need
          </h2>
          <p className="mt-3 text-[16px] text-[#6B6B6B]">
            From a single stock analysis to portfolio-wide factor screening.
          </p>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-8">
          {TOOL_GROUPS.map((group) => (
            <div key={group.name} className="flex flex-col gap-3">
              <div className="w-10 h-10 rounded-lg bg-[#EEF3D8] flex items-center justify-center flex-shrink-0">
                {group.icon}
              </div>
              <p className="text-[15px] font-bold text-[#111111]">{group.name}</p>
              <p className="text-[14px] text-[#6B6B6B] leading-relaxed">
                {group.description}
              </p>
              <div className="flex flex-wrap gap-2 mt-1">
                {group.links.map((link) => (
                  <Link
                    key={link.label}
                    href={link.href}
                    className="rounded-full border border-[#E5E5E5] px-3 py-1 text-[12px] font-semibold text-[#111111] hover:border-[#5F790B] hover:text-[#5F790B] transition-colors"
                  >
                    {link.label}
                  </Link>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
