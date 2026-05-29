'use client'

const STEPS = [
  {
    num: '1',
    title: 'Read the verdict first',
    body: 'The summary strip at top shows the blended fair value, upside, and model confidence — your starting point.',
  },
  {
    num: '2',
    title: 'Tune the assumptions',
    body: 'Adjust growth, margins, multiples, and WACC on the left. The fair value updates live as you move each input.',
  },
  {
    num: '3',
    title: 'Check the scenario range',
    body: 'Bear, base, and bull cases show how sensitive the estimate is to your assumptions. Wide spread means lower conviction.',
  },
  {
    num: '4',
    title: 'Examine the method evidence',
    body: 'The charts below show each model\'s estimate. Large disagreement across models reduces confidence in the blend.',
  },
]

export default function GuidanceStrip() {
  return (
    <details className="group">
      <summary className="flex items-center gap-2 cursor-pointer list-none bg-white rounded-[14px] border border-[#E6ECF5] shadow-sm px-4 py-3 hover:bg-[#F8FAFC] transition-colors select-none flex-wrap">
        <span className="text-[#94A3B8] text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
        <span className="text-[12px] font-[650] text-[#475569]">How to read this valuation</span>
        <span className="ml-auto text-[11px] text-[#94A3B8] group-open:hidden">4-step guide ↓</span>
      </summary>
      <div className="mt-2 bg-white rounded-[14px] border border-[#E6ECF5] shadow-sm px-5 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map(s => (
            <div key={s.num} className="flex gap-3">
              <div className="bg-[#2563EB] text-white text-[11px] font-[700] w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5">
                {s.num}
              </div>
              <div>
                <p className="text-[13px] font-[650] text-[#0F172A]">{s.title}</p>
                <p className="text-[12px] text-[#64748B] mt-0.5 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}
