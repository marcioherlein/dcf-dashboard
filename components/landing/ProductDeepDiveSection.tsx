import { SummaryMockScreen, ValuationMockScreen } from './ProductScreenshots'

const _SUMMARY_CALLOUTS = [
  { label: 'Current Price', body: 'Live market data', top: '15%', left: '-28%' },
  { label: 'Intrinsic Value', body: 'Blended fair value estimate', top: '15%', right: '-28%' },
  { label: 'Investment Verdict', body: 'Clear action signal', top: '38%', left: '-28%' },
  { label: 'Reverse DCF', body: 'What growth is priced in', top: '58%', right: '-28%' },
]

const _VALUATION_CALLOUTS = [
  { label: 'Blended Fair Value', body: 'vs. current price', top: '10%', right: '-30%' },
  { label: 'Scenario Range', body: 'Bear / Base / Bull outcomes', top: '40%', right: '-30%' },
  { label: 'Editable Assumptions', body: 'Growth, margins, WACC, terminal rate', top: '70%', left: '-30%' },
]

export default function ProductDeepDiveSection() {
  return (
    <section style={{ background: 'white', borderBottom: '1px solid #E2E8F0' }}>
      <div className="mx-auto max-w-[1200px] px-6 py-24">
        {/* Heading */}
        <div className="text-center mb-16">
          <p
            className="font-bold uppercase mb-3"
            style={{ fontSize: '11px', letterSpacing: '0.08em', color: '#2563EB' }}
          >
            See what matters. Ignore the noise.
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
            Everything you need. Nothing you don&apos;t.
          </h2>
          <p
            style={{
              fontSize: '17px',
              lineHeight: 1.6,
              color: '#64748B',
              maxWidth: '560px',
              margin: '0 auto',
            }}
          >
            Intrinsico turns valuation into a structured workflow: price, intrinsic
            value, reverse DCF, business quality, risks, and assumptions.
          </p>
        </div>

        {/* Two-panel layout */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-16">
          {/* Panel A: Summary */}
          <div>
            <div className="mb-5">
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.015em', marginBottom: '8px' }}>
                Summary at a glance
              </h3>
              <p style={{ fontSize: '15px', color: '#64748B', lineHeight: 1.6 }}>
                One screen. Price, verdict, implied growth, and quality scores.
              </p>
            </div>
            <div className="space-y-2 mb-6">
              {[
                { label: 'Current Price', desc: 'Live market data' },
                { label: 'Intrinsic Value', desc: 'Blended fair value estimate' },
                { label: 'Investment Verdict', desc: 'Overvalued / Undervalued / Fair' },
                { label: 'Reverse DCF', desc: 'Implied annual growth rate' },
                { label: 'Business Quality', desc: 'A/B/C graded signals' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <div
                    className="mt-0.5 rounded-full shrink-0"
                    style={{ width: '6px', height: '6px', background: '#2563EB', marginTop: '7px' }}
                  />
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 650, color: '#0F172A' }}>{item.label}</span>
                    <span style={{ fontSize: '14px', color: '#94A3B8', marginLeft: '6px' }}>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="relative">
              <SummaryMockScreen />
            </div>
          </div>

          {/* Panel B: Valuation deep dive */}
          <div>
            <div className="mb-5">
              <h3 style={{ fontSize: '20px', fontWeight: 700, color: '#0F172A', letterSpacing: '-0.015em', marginBottom: '8px' }}>
                Valuation Deep Dive
              </h3>
              <p style={{ fontSize: '15px', color: '#64748B', lineHeight: 1.6 }}>
                Bull, base, and bear scenarios. Model weights. Editable assumptions.
              </p>
            </div>
            <div className="space-y-2 mb-6">
              {[
                { label: 'Blended Fair Value', desc: 'vs. current price' },
                { label: 'Model Breakdown', desc: 'DCF + Multiples with weights' },
                { label: 'Scenario Range', desc: 'Bear / Base / Bull outcomes' },
                { label: 'Editable Assumptions', desc: 'Growth, margins, WACC, terminal rate' },
              ].map(item => (
                <div key={item.label} className="flex items-start gap-3">
                  <div
                    className="shrink-0"
                    style={{ width: '6px', height: '6px', background: '#7C3AED', borderRadius: '50%', marginTop: '7px' }}
                  />
                  <div>
                    <span style={{ fontSize: '14px', fontWeight: 650, color: '#0F172A' }}>{item.label}</span>
                    <span style={{ fontSize: '14px', color: '#94A3B8', marginLeft: '6px' }}>{item.desc}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="relative">
              <ValuationMockScreen />
            </div>
          </div>
        </div>
      </div>
    </section>
  )
}
