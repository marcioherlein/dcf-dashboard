import { ArrowRight } from 'lucide-react'

const STEPS = [
  {
    n: '1',
    title: 'Search any stock.',
    body: 'Find any public company in seconds. No onboarding or credit card required.',
    color: '#2563EB',
  },
  {
    n: '2',
    title: 'Model runs instantly.',
    body: 'We analyze fundamentals, run multiple valuation methods, and reverse DCF the price.',
    color: '#7C3AED',
  },
  {
    n: '3',
    title: 'Get a clear verdict.',
    body: 'See fair value, upside/downside, and what the market is already pricing in.',
    color: '#059669',
  },
]

export default function HowItWorksSection() {
  return (
    <section
      id="how-it-works"
      className="overflow-x-hidden"
      style={{ background: '#F8FAFC', borderBottom: '1px solid #E2E8F0' }}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-24">
        {/* Heading */}
        <div className="text-center mb-10 sm:mb-14">
          <p
            className="font-bold uppercase mb-3"
            style={{ fontSize: '11px', letterSpacing: '0.08em', color: '#2563EB' }}
          >
            How it works
          </p>
          <h2
            className="text-[28px] sm:text-[38px] lg:text-[clamp(32px,3.2vw,44px)]"
            style={{
              fontWeight: 700,
              lineHeight: 1.1,
              letterSpacing: '-0.025em',
              color: '#0F172A',
              marginBottom: '12px',
            }}
          >
            A verdict in under 30 seconds.
          </h2>
          <p className="text-base sm:text-[17px]" style={{ color: '#64748B', lineHeight: 1.55 }}>
            No spreadsheet. No financial degree required.
          </p>
        </div>

        {/* Steps */}
        <div className="relative grid grid-cols-1 sm:grid-cols-3 gap-6">
          {/* Connector lines */}
          <div
            className="hidden sm:block absolute"
            style={{
              top: '32px',
              left: 'calc(16.7% + 20px)',
              right: 'calc(16.7% + 20px)',
              height: '1px',
              background: 'linear-gradient(90deg, #BFDBFE 0%, #E2E8F0 50%, #BFDBFE 100%)',
            }}
            aria-hidden="true"
          />

          {STEPS.map((step, i) => (
            <div
              key={i}
              className="flex flex-col items-center text-center rounded-[18px] border bg-white p-7"
              style={{
                borderColor: '#E6ECF5',
                boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 6px 20px rgba(15,23,42,0.05)',
              }}
            >
              <div
                className="flex items-center justify-center rounded-full text-white font-bold z-10 mb-5"
                style={{
                  width: '44px',
                  height: '44px',
                  background: step.color,
                  fontSize: '16px',
                  boxShadow: `0 4px 14px ${step.color}44`,
                }}
                aria-label={`Step ${step.n}`}
              >
                {step.n}
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
                {step.title}
              </h3>
              <p style={{ fontSize: '15px', lineHeight: 1.6, color: '#64748B' }}>
                {step.body}
              </p>
            </div>
          ))}
        </div>

        {/* Arrow hint between cards — visible only on desktop via CSS */}
        <div className="hidden sm:flex justify-center mt-6">
          <div className="flex items-center gap-2 text-[13px] text-slate-400">
            <ArrowRight size={14} />
            <span>Seconds from search to verdict</span>
          </div>
        </div>
      </div>
    </section>
  )
}
