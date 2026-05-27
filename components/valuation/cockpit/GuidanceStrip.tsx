'use client'

const STEPS = [
  { num: '1', title: 'Start with the blended fair value', body: 'This combines the available valuation methods using model weights — it is the central estimate.', color: 'bg-blue-600' },
  { num: '2', title: 'Check the scenarios', body: 'Bear, base, and bull cases show how sensitive value is to key assumptions.', color: 'bg-indigo-600' },
  { num: '3', title: 'Compare valuation methods', body: 'Different methods can disagree. Wide dispersion means lower confidence in the blended estimate.', color: 'bg-violet-600' },
  { num: '4', title: 'Review assumptions', body: 'Adjust growth, margins, multiples, and WACC to test your own view of the business.', color: 'bg-purple-600' },
]

export default function GuidanceStrip() {
  return (
    <details className="group">
      <summary className="flex items-center gap-2 cursor-pointer list-none bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-3 hover:bg-slate-50 transition-colors select-none">
        <span className="text-slate-400 text-xs group-open:rotate-90 transition-transform inline-block">▶</span>
        <span className="text-xs font-bold uppercase tracking-wider text-slate-500">How to read this valuation</span>
        <span className="ml-auto text-xs text-slate-400 group-open:hidden">4-step guide ↓</span>
      </summary>
      <div className="mt-2 bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {STEPS.map(s => (
            <div key={s.num} className="flex gap-3">
              <div className={`${s.color} text-white text-xs font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
                {s.num}
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-700">{s.title}</p>
                <p className="text-xs text-slate-400 mt-0.5 leading-relaxed">{s.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </details>
  )
}
