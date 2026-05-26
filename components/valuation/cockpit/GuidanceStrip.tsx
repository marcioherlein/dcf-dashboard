'use client'

const STEPS = [
  {
    num: '1',
    title: 'Set assumptions',
    body: 'Adjust WACC, CAGR, and exit multiples below to reflect your view of the company.',
    color: 'bg-blue-600',
  },
  {
    num: '2',
    title: 'Check the methods',
    body: 'Each model values the company differently. The blended result reduces single-model risk.',
    color: 'bg-indigo-600',
  },
  {
    num: '3',
    title: 'Read the scenarios',
    body: 'Bear/Base/Bull show how small assumption changes move the fair value range.',
    color: 'bg-violet-600',
  },
  {
    num: '4',
    title: 'Compare to price',
    body: 'A stock trading below the bear-case is statistically cheap. Above the bull-case is expensive.',
    color: 'bg-purple-600',
  },
]

export default function GuidanceStrip() {
  return (
    <div className="bg-white rounded-xl border border-slate-100 shadow-sm px-5 py-4">
      <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-3">How to read this valuation</p>
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {STEPS.map(s => (
          <div key={s.num} className="flex gap-3">
            <div className={`${s.color} text-white text-[11px] font-bold w-5 h-5 rounded-full flex items-center justify-center shrink-0 mt-0.5`}>
              {s.num}
            </div>
            <div>
              <p className="text-xs font-semibold text-slate-700">{s.title}</p>
              <p className="text-[10px] text-slate-400 mt-0.5 leading-relaxed">{s.body}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
