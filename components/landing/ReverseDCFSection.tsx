import Link from 'next/link'

const STOCKS = [
  {
    ticker: 'NVDA',
    company: 'NVIDIA Corporation',
    price: '$215.33',
    change: '−1.90%',
    positive: false,
    impliedCAGR: 45.4,
    badge: 'Very Aggressive',
    badgeColor: { bg: '#FEF2F2', text: '#B91C1C', border: '#FECACA' },
    barColor: '#EF4444',
    note: 'Market assumes 45.4% growth vs 60.0% last 3 years.',
    sparkPath: 'M 0 30 C 20 32, 30 20, 50 22 C 70 24, 80 10, 100 8',
    sparkColor: '#EF4444',
  },
  {
    ticker: 'AAPL',
    company: 'Apple Inc.',
    price: '$189.87',
    change: '+0.42%',
    positive: true,
    impliedCAGR: 7.7,
    badge: 'Reasonable',
    badgeColor: { bg: '#EFF6FF', text: '#1D4ED8', border: '#BFDBFE' },
    barColor: '#2563EB',
    note: 'Market assumes 7.7% growth vs 7.1% last 3 years.',
    sparkPath: 'M 0 20 C 20 22, 35 24, 50 20 C 65 16, 80 18, 100 14',
    sparkColor: '#2563EB',
  },
  {
    ticker: 'MELI',
    company: 'MercadoLibre, Inc.',
    price: '$1,512.45',
    change: '−0.75%',
    positive: false,
    impliedCAGR: 28.1,
    badge: 'Aggressive',
    badgeColor: { bg: '#FFF7ED', text: '#B45309', border: '#FED7AA' },
    barColor: '#F59E0B',
    note: 'Market assumes 28.1% growth vs 35.4% last 3 years.',
    sparkPath: 'M 0 28 C 15 26, 30 18, 50 16 C 70 14, 82 20, 100 18',
    sparkColor: '#F59E0B',
  },
]

export default function ReverseDCFSection() {
  return (
    <section
      id="reverse-dcf"
      className="overflow-x-hidden"
      style={{ background: 'white', borderTop: '1px solid #E2E8F0', borderBottom: '1px solid #E2E8F0' }}
    >
      <div className="mx-auto max-w-[1200px] px-4 sm:px-6 py-16 sm:py-24">
        <div
          className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.6fr)] items-center"
          style={{ gap: '40px' }}
        >
          {/* Left: explanation */}
          <div>
            <p
              className="font-bold uppercase mb-3"
              style={{ fontSize: '11px', letterSpacing: '0.08em', color: '#2563EB' }}
            >
              What is today&apos;s price already betting on?
            </p>
            <h2
              className="text-[28px] sm:text-[38px] lg:text-[clamp(32px,3.2vw,44px)]"
              style={{
                fontWeight: 700,
                lineHeight: 1.1,
                letterSpacing: '-0.025em',
                color: '#0F172A',
                marginBottom: '20px',
              }}
            >
              Reverse DCF in plain English.
            </h2>
            <p
              className="text-base"
              style={{
                lineHeight: 1.6,
                color: '#475569',
                marginBottom: '24px',
                maxWidth: '420px',
              }}
            >
              Reverse DCF works backward from today&apos;s price to show the growth
              and profitability the market must be right about for you to break even.
            </p>
            <p
              className="text-base"
              style={{
                lineHeight: 1.6,
                color: '#64748B',
                padding: '16px 20px',
                borderRadius: '12px',
                background: '#F8FAFC',
                border: '1px solid #E6ECF5',
                maxWidth: '420px',
              }}
            >
              Before asking &ldquo;is this stock cheap?&rdquo; — ask what growth rate this
              price requires to make sense.
            </p>
          </div>

          {/* Right: stock cards */}
          <div className="flex flex-col gap-4">
            {STOCKS.map(stock => (
              <Link
                key={stock.ticker}
                href={`/stock/${stock.ticker}`}
                className="group block rounded-[20px] bg-white border p-5 transition-all hover:-translate-y-0.5 active:scale-95"
                style={{
                  borderColor: '#E6ECF5',
                  boxShadow: '0 1px 2px rgba(15,23,42,0.04), 0 4px 16px rgba(15,23,42,0.05)',
                }}
                aria-label={`Analyze ${stock.ticker} — ${stock.company}`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-0.5">
                      <span className="text-[14px] font-bold text-slate-800 font-mono">{stock.ticker}</span>
                      <span className="text-[11px] text-slate-400">{stock.company}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[16px] font-bold text-slate-900 font-mono" style={{ fontVariantNumeric: 'tabular-nums' }}>
                        {stock.price}
                      </span>
                      <span
                        className="text-[12px] font-semibold"
                        style={{ color: stock.positive ? '#16A34A' : '#DC2626' }}
                      >
                        {stock.change}
                      </span>
                    </div>
                  </div>
                  <span
                    className="shrink-0 text-[11px] font-bold px-2.5 py-1 rounded-full border"
                    style={stock.badgeColor}
                  >
                    {stock.badge}
                  </span>
                </div>

                {/* CAGR + sparkline */}
                <div className="flex items-center gap-4">
                  <div className="shrink-0">
                    <p className="text-[10px] text-slate-400 mb-0.5">Implied 5Y Revenue CAGR</p>
                    <p
                      className="text-[28px] font-extrabold font-mono leading-none"
                      style={{ color: '#0F172A', fontVariantNumeric: 'tabular-nums' }}
                    >
                      {stock.impliedCAGR}%
                    </p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <svg width="100%" height="36" viewBox="0 0 100 40" preserveAspectRatio="none" aria-hidden="true">
                      <defs>
                        <linearGradient id={`grad-${stock.ticker}`} x1="0" y1="0" x2="0" y2="1">
                          <stop offset="0%" stopColor={stock.sparkColor} stopOpacity="0.15" />
                          <stop offset="100%" stopColor={stock.sparkColor} stopOpacity="0" />
                        </linearGradient>
                      </defs>
                      <path
                        d={stock.sparkPath + ' L 100 40 L 0 40 Z'}
                        fill={`url(#grad-${stock.ticker})`}
                      />
                      <path
                        d={stock.sparkPath}
                        stroke={stock.sparkColor}
                        strokeWidth="1.8"
                        fill="none"
                        strokeLinecap="round"
                      />
                    </svg>
                  </div>
                </div>

                <p className="mt-2 text-[12px] text-slate-500">{stock.note}</p>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </section>
  )
}
