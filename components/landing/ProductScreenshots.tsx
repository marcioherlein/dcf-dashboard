// Polished React mockups of the Insic app UI — used as hero screenshots

export function SummaryMockScreen() {
  return (
    <div
      className="rounded-[20px] overflow-hidden bg-white w-full"
      style={{
        border: '1px solid #E6ECF5',
        boxShadow: '0 24px 70px rgba(15,23,42,0.14), 0 2px 8px rgba(15,23,42,0.05)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-3 border-b border-slate-100" style={{ background: '#F8FAFC' }}>
        <div className="w-3 h-3 rounded-full bg-[#FC605C]" />
        <div className="w-3 h-3 rounded-full bg-[#FDBC40]" />
        <div className="w-3 h-3 rounded-full bg-[#34C749]" />
        <div className="flex-1 mx-3 rounded-md bg-white border border-slate-200 px-3 py-1 text-[11px] text-slate-400 font-mono">
          insic.app/stock/NVDA
        </div>
      </div>

      {/* App header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100" style={{ background: 'white' }}>
        <div className="flex items-center gap-2">
          <span className="text-[13px] font-bold text-slate-800 font-mono">NVDA</span>
          <span className="text-[11px] text-slate-400">NVIDIA Corporation</span>
        </div>
        <div className="flex items-center gap-1.5">
          <span className="text-[13px] font-bold text-slate-900 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>$215.33</span>
          <span className="text-[11px] font-semibold text-red-500">−1.90%</span>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-0 px-4 border-b border-slate-100" style={{ background: 'white' }}>
        {['Overview', 'Valuation', 'Financials', 'Risk', 'News'].map((tab, i) => (
          <span
            key={tab}
            className="py-2 px-3 text-[11px] font-semibold transition-colors"
            style={{
              color: i === 0 ? '#2563EB' : '#94A3B8',
              borderBottom: i === 0 ? '2px solid #2563EB' : '2px solid transparent',
            }}
          >
            {tab}
          </span>
        ))}
      </div>

      {/* Content */}
      <div className="p-4 space-y-3" style={{ background: '#F8FAFC' }}>
        {/* Price + intrinsic value */}
        <div className="grid grid-cols-2 gap-3">
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Current Price</p>
            <p className="text-[22px] font-extrabold text-slate-900 font-mono leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>$215.33</p>
            <p className="text-[10px] text-red-500 font-semibold mt-1">−$4.17 today</p>
          </div>
          <div className="bg-white rounded-xl p-3 border border-slate-100">
            <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide mb-1">Intrinsic Value</p>
            <p className="text-[22px] font-extrabold text-slate-900 font-mono leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>$125.23</p>
            <span className="inline-flex items-center mt-1 rounded-full px-2 py-0.5 text-[10px] font-bold"
              style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
              OVERVALUED −41.8%
            </span>
          </div>
        </div>

        {/* Reverse DCF banner */}
        <div className="bg-white rounded-xl border border-slate-100 p-3">
          <div className="flex items-center justify-between mb-2">
            <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">Reverse DCF Analysis</p>
            <span className="text-[10px] font-bold px-2 py-0.5 rounded-full"
              style={{ background: '#FEF2F2', color: '#B91C1C', border: '1px solid #FECACA' }}>
              Very Important
            </span>
          </div>
          <div className="flex items-end gap-3">
            <div>
              <p className="text-[10px] text-slate-400 mb-0.5">Implied DCF Revenue CAGR</p>
              <p className="text-[24px] font-extrabold font-mono text-slate-900 leading-none" style={{ fontVariantNumeric: 'tabular-nums' }}>45.4%</p>
            </div>
            <div className="flex-1 pb-1">
              <div className="h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: '75%', background: 'linear-gradient(90deg, #EF4444, #DC2626)' }} />
              </div>
              <p className="text-[10px] text-slate-400 mt-1">Market assumes 45.4% growth vs 60.0% last 3 years</p>
            </div>
          </div>
        </div>

        {/* Quality cards row */}
        <div className="grid grid-cols-4 gap-1.5">
          {[
            { label: 'Business', grade: 'A+', color: '#059669', bg: '#ECFDF3', border: '#BBF7D0' },
            { label: 'Growth', grade: 'A', color: '#2563EB', bg: '#EFF6FF', border: '#BFDBFE' },
            { label: 'Profitability', grade: 'A+', color: '#059669', bg: '#ECFDF3', border: '#BBF7D0' },
            { label: 'Cash Flow', grade: 'B+', color: '#D97706', bg: '#FFF7ED', border: '#FED7AA' },
          ].map(card => (
            <div key={card.label} className="bg-white rounded-lg border p-2 text-center" style={{ borderColor: card.border }}>
              <p className="text-[10px] text-slate-400 font-medium mb-1">{card.label}</p>
              <p className="text-[14px] font-extrabold leading-none" style={{ color: card.color, fontFamily: 'var(--font-display, system-ui)' }}>
                {card.grade}
              </p>
            </div>
          ))}
        </div>

        {/* Analyst row */}
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { label: 'Analysts', val: '55', icon: '👁' },
            { label: 'Buy', val: '41.8%', color: '#059669' },
            { label: 'Target', val: '$256.34' },
          ].map(stat => (
            <div key={stat.label} className="bg-white rounded-lg border border-slate-100 p-2">
              <p className="text-[10px] text-slate-400">{stat.label}</p>
              <p className="text-[12px] font-bold font-mono" style={{ color: stat.color ?? '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                {stat.val}
              </p>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export function ValuationMockScreen() {
  return (
    <div
      className="rounded-[20px] overflow-hidden bg-white w-full"
      style={{
        border: '1px solid #E6ECF5',
        boxShadow: '0 16px 48px rgba(15,23,42,0.10), 0 2px 6px rgba(15,23,42,0.04)',
        fontFamily: 'Inter, ui-sans-serif, system-ui, sans-serif',
        minWidth: 0,
        maxWidth: '100%',
      }}
    >
      {/* Browser chrome */}
      <div className="flex items-center gap-1.5 px-4 py-2.5 border-b border-slate-100" style={{ background: '#F8FAFC' }}>
        <div className="w-2.5 h-2.5 rounded-full bg-[#FC605C]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#FDBC40]" />
        <div className="w-2.5 h-2.5 rounded-full bg-[#34C749]" />
        <div className="flex-1 mx-3 rounded-md bg-white border border-slate-200 px-2 py-0.5 text-[10px] text-slate-400 font-mono">
          insic.app/stock/NVDA — Valuation
        </div>
      </div>

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-slate-100">
        <div>
          <span className="text-[11px] font-bold text-slate-800 font-mono">NVDA</span>
          <span className="text-[10px] text-slate-400 ml-2">NVIDIA Corporation</span>
        </div>
        <div className="text-right">
          <p className="text-[10px] text-slate-400">Business Fair Value</p>
          <p className="text-[16px] font-extrabold font-mono text-slate-900" style={{ fontVariantNumeric: 'tabular-nums' }}>$125.23</p>
        </div>
      </div>

      {/* Scenario tabs */}
      <div className="px-4 py-3 border-b border-slate-100">
        <div className="grid grid-cols-3 gap-2">
          {[
            { label: 'BEAR', val: '−82.5%', price: '$37.12', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
            { label: 'BASE', val: '−78.3%', price: '$46.75', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
            { label: 'BULL', val: '−72.5%', price: '$59.23', color: '#B91C1C', bg: '#FEF2F2', border: '#FECACA' },
          ].map((s, i) => (
            <div
              key={s.label}
              className="rounded-lg p-2 text-center border"
              style={{
                borderColor: i === 1 ? '#BFDBFE' : s.border,
                background: i === 1 ? '#EFF6FF' : s.bg,
              }}
            >
              <p className="text-[10px] font-bold uppercase tracking-wider" style={{ color: i === 1 ? '#1D4ED8' : '#94A3B8' }}>
                {s.label}
              </p>
              <p className="text-[12px] font-extrabold font-mono mt-0.5" style={{ color: s.color, fontVariantNumeric: 'tabular-nums' }}>
                {s.val}
              </p>
              <p className="text-[11px] font-bold font-mono" style={{ color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}>
                {s.price}
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Assumptions table */}
      <div className="px-4 py-2 border-b border-slate-100">
        <table className="w-full text-[10px]">
          <thead>
            <tr className="text-[10px] text-slate-400 font-semibold uppercase">
              <td className="py-1">Metric</td>
              <td className="text-center text-red-400">Bear</td>
              <td className="text-center text-blue-500">Base</td>
              <td className="text-center text-emerald-600">Bull</td>
            </tr>
          </thead>
          <tbody className="text-slate-600">
            {[
              { m: 'CAGR', b: '10.0%', base: '14.0%', bull: '13.0%' },
              { m: 'EBITDA', b: '26.0%', base: '22.0%', bull: '24.0%' },
              { m: 'WACC', b: '13.0%', base: '13.0%', bull: '13.0%' },
              { m: 'Margin', b: '3.0%', base: '2.0%', bull: '3.0%' },
            ].map(row => (
              <tr key={row.m} className="border-t border-slate-50">
                <td className="py-1 text-slate-500">{row.m}</td>
                <td className="text-center font-mono font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.b}</td>
                <td className="text-center font-mono font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.base}</td>
                <td className="text-center font-mono font-semibold" style={{ fontVariantNumeric: 'tabular-nums' }}>{row.bull}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Model weights */}
      <div className="px-4 py-3">
        <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider mb-2">Model Confidence</p>
        <div className="space-y-1.5">
          {[
            { label: 'DCF (FCFF)', w: 65, color: '#2563EB' },
            { label: 'DCF (FCFE)', w: 20, color: '#7C3AED' },
            { label: 'Multiples', w: 15, color: '#059669' },
          ].map(m => (
            <div key={m.label} className="flex items-center gap-2">
              <span className="text-[10px] text-slate-500 w-[52px] shrink-0">{m.label}</span>
              <div className="flex-1 h-1.5 rounded-full bg-slate-100 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${m.w}%`, background: m.color }} />
              </div>
              <span className="text-[10px] font-mono font-semibold text-slate-600 w-7 text-right" style={{ fontVariantNumeric: 'tabular-nums' }}>
                {m.w}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
