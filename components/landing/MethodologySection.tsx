interface Step {
  number: number
  title: string
  description: string
}

const STEPS: Step[] = [
  {
    number: 1,
    title: 'WACC',
    description:
      'Computed from CAPM: risk-free rate (FRED), beta (5Y regression), equity risk premium (Damodaran).',
  },
  {
    number: 2,
    title: 'FCF Projection',
    description:
      '5–10 year free cash flow projections using analyst consensus and historical CAGR.',
  },
  {
    number: 3,
    title: 'Terminal Value',
    description:
      'Gordon Growth model and exit multiple, blended. Terminal growth capped at GDP.',
  },
  {
    number: 4,
    title: 'Triangulation',
    description:
      'Weighted consensus of DCF, Forward P/E, EV/EBITDA, Revenue Multiple, and DDM.',
  },
]

export default function MethodologySection() {
  return (
    <section className="bg-white py-16">
      <div className="max-w-5xl mx-auto px-6">
        <div className="mb-12">
          <h2 className="text-[28px] font-bold text-[#111111]">
            How the model calculates fair value
          </h2>
          <p className="mt-3 text-[16px] text-[#6B6B6B]">
            Four steps, transparent inputs, no black boxes.
          </p>
        </div>

        {/* Desktop: horizontal sequence */}
        <div className="hidden sm:grid sm:grid-cols-4 gap-0 relative">
          {STEPS.map((step, idx) => (
            <div key={step.number} className="relative flex flex-col items-start px-5 first:pl-0 last:pr-0">
              {/* Connector line between steps */}
              {idx < STEPS.length - 1 && (
                <div
                  className="absolute top-5 left-[calc(50%+20px)] right-[-50%] border-t border-[#E5E5E5]"
                  aria-hidden="true"
                />
              )}
              {/* Step circle */}
              <div className="relative z-10 flex items-center justify-center w-10 h-10 rounded-full bg-[#5F790B] text-white text-[13px] font-bold flex-shrink-0 mb-4">
                {step.number}
              </div>
              <p className="text-[14px] font-bold text-[#111111] mb-2">{step.title}</p>
              <p className="text-[13px] text-[#6B6B6B] leading-relaxed">{step.description}</p>
            </div>
          ))}
        </div>

        {/* Mobile: stacked with left border accent */}
        <div className="flex flex-col gap-0 sm:hidden">
          {STEPS.map((step, idx) => (
            <div key={step.number} className="flex gap-4">
              {/* Left column: circle + vertical line */}
              <div className="flex flex-col items-center flex-shrink-0">
                <div className="flex items-center justify-center w-9 h-9 rounded-full bg-[#5F790B] text-white text-[12px] font-bold">
                  {step.number}
                </div>
                {idx < STEPS.length - 1 && (
                  <div className="flex-1 w-px bg-[#E5E5E5] my-1" />
                )}
              </div>
              {/* Right column: content */}
              <div className={`pb-8 ${idx === STEPS.length - 1 ? 'pb-0' : ''}`}>
                <p className="text-[14px] font-bold text-[#111111] mb-1.5 mt-1">{step.title}</p>
                <p className="text-[13px] text-[#6B6B6B] leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
