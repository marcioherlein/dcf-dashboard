import { Database, BarChart3, SlidersHorizontal } from 'lucide-react'

const CARDS = [
  {
    Icon: Database,
    iconColor: '#2563EB',
    iconBg: '#EFF6FF',
    title: 'Public data sources.',
    body: 'Financials and estimates from trusted providers like FRED, Yahoo Finance, and company filings.',
    chips: ['FRED', 'Yahoo Finance', 'SEC'],
    chipStyle: { bg: '#F8FAFC', text: '#475569', border: '#E2E8F0' },
  },
  {
    Icon: BarChart3,
    iconColor: '#7C3AED',
    iconBg: '#F5F3FF',
    title: 'Multiple valuation methods.',
    body: 'DCF, Reverse DCF, and Multiples working together to triangulate fair value.',
    chips: ['DCF', 'Reverse DCF', 'Multiples'],
    chipStyle: { bg: '#F5F3FF', text: '#6D28D9', border: '#DDD6FE' },
  },
  {
    Icon: SlidersHorizontal,
    iconColor: '#059669',
    iconBg: '#ECFDF3',
    title: 'Adjust every assumption.',
    body: 'Change growth, margins, WACC, and terminal value. See how fair value responds in real time.',
    chips: ['Growth', 'Margins', 'WACC', 'Terminal Rate'],
    chipStyle: { bg: '#ECFDF3', text: '#047857', border: '#BBF7D0' },
  },
]

export default function TransparencySection() {
  return (
    <section style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}>
      <div className="mx-auto max-w-[1200px] px-6 py-24">
        {/* Heading */}
        <div className="text-center mb-14">
          <p
            className="font-bold uppercase mb-3"
            style={{ fontSize: '11px', letterSpacing: '0.08em', color: '#2563EB' }}
          >
            Built on transparency
          </p>
          <h2
            style={{
              fontSize: 'clamp(30px, 3vw, 42px)',
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              color: '#0F172A',
              marginBottom: '16px',
            }}
          >
            No black boxes. Every assumption is yours.
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.6,
              color: '#64748B',
              maxWidth: '540px',
              margin: '0 auto',
            }}
          >
            We believe investors deserve the same tools and transparency institutions
            use. Every model, source, and assumption is visible and adjustable.
          </p>
        </div>

        {/* Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-6">
          {CARDS.map(({ Icon, iconColor, iconBg, title, body, chips, chipStyle }) => (
            <div
              key={title}
              className="flex flex-col rounded-[20px] bg-white border p-7 transition-all hover:-translate-y-0.5"
              style={{
                borderColor: '#E6ECF5',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.05)',
              }}
            >
              {/* Icon */}
              <div
                className="flex items-center justify-center rounded-xl mb-5 shrink-0"
                style={{ width: '44px', height: '44px', background: iconBg }}
                aria-hidden="true"
              >
                <Icon size={20} color={iconColor} />
              </div>

              <h3
                style={{
                  fontSize: '18px',
                  fontWeight: 700,
                  color: '#0F172A',
                  marginBottom: '10px',
                  letterSpacing: '-0.015em',
                }}
              >
                {title}
              </h3>
              <p
                style={{
                  fontSize: '15px',
                  lineHeight: 1.6,
                  color: '#64748B',
                  marginBottom: '20px',
                  flexGrow: 1,
                }}
              >
                {body}
              </p>

              {/* Chips */}
              <div className="flex flex-wrap gap-2">
                {chips.map(chip => (
                  <span
                    key={chip}
                    className="rounded-full border px-3 py-1 text-[12px] font-semibold"
                    style={{ background: chipStyle.bg, color: chipStyle.text, borderColor: chipStyle.border }}
                  >
                    {chip}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
