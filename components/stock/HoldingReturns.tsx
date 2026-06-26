'use client'

interface HoldingReturns {
  stock1y: number | null
  stock3y: number | null
  stock5y: number | null
  spy1y: number | null
  spy3y: number | null
  spy5y: number | null
}

interface Props {
  returns: HoldingReturns
  ticker: string
}

function pctStr(v: number | null): string {
  if (v == null) return '—'
  const sign = v >= 0 ? '+' : ''
  return `${sign}${(v * 100).toFixed(1)}%`
}

function BarPair({
  period,
  stock,
  spy,
  ticker,
}: {
  period: string
  stock: number | null
  spy: number | null
  ticker: string
}) {
  const outperformed = stock != null && spy != null ? stock > spy : null
  const bothPositive = (stock ?? 0) >= 0 && (spy ?? 0) >= 0

  // Compute bar widths relative to max absolute value
  const maxAbs = Math.max(Math.abs(stock ?? 0), Math.abs(spy ?? 0), 0.001)
  const stockPct = stock != null ? Math.max(2, (Math.abs(stock) / maxAbs) * 100) : 0
  const spyPct   = spy   != null ? Math.max(2, (Math.abs(spy)   / maxAbs) * 100) : 0

  return (
    <div className="flex flex-col gap-2 py-3 min-h-[44px]">
      <div className="flex items-center justify-between">
        <span className="text-[11px] font-semibold uppercase tracking-wider text-[#566174]">{period}</span>
        {outperformed != null && (
          <span className={[
            'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full',
            outperformed ? 'text-[#11875D] bg-[#E8F7EF]' : 'text-[#D83B3B] bg-[#FCEAEA]',
          ].join(' ')}>
            {outperformed ? 'Beat' : 'Lagged'}
          </span>
        )}
      </div>

      {/* Stock bar */}
      {stock != null && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#566174] w-8 shrink-0">{ticker}</span>
          <div className="flex-1 h-2 bg-[#F0F1F6] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${stock >= 0 ? 'bg-[#E8F7EF]' : 'bg-[#D83B3B]'}`}
              style={{ width: `${stockPct}%` }}
            />
          </div>
          <span className={[
            'text-[12px] font-bold tabular-nums w-14 text-right shrink-0',
            stock >= 0 ? 'text-[#11875D]' : 'text-[#D83B3B]',
          ].join(' ')}>
            {pctStr(stock)}
          </span>
        </div>
      )}

      {/* SPY bar */}
      {spy != null && (
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-mono text-[#8A95A6] w-8 shrink-0">SPY</span>
          <div className="flex-1 h-2 bg-[#F0F1F6] rounded-full overflow-hidden">
            <div
              className={`h-full rounded-full ${spy >= 0 ? 'bg-[#8A95A6]' : 'bg-[#CDD1C8]'}`}
              style={{ width: `${spyPct}%` }}
            />
          </div>
          <span className={[
            'text-[12px] tabular-nums w-14 text-right shrink-0',
            spy >= 0 ? 'text-[#566174]' : 'text-[#566174]',
          ].join(' ')}>
            {pctStr(spy)}
          </span>
        </div>
      )}

      {/* Spread note */}
      {stock != null && spy != null && !bothPositive && (
        <p className="text-[10px] text-[#8A95A6] leading-tight">
          {stock >= 0 && spy < 0 ? 'Positive while market was negative' :
           stock < 0 && spy >= 0 ? 'Negative while market was positive' : ''}
        </p>
      )}
    </div>
  )
}

export default function HoldingReturns({ returns, ticker }: Props) {
  const { stock1y, stock3y, stock5y, spy1y, spy3y, spy5y } = returns
  if (stock1y == null && stock3y == null && stock5y == null) return null

  return (
    <div className="rounded-xl card px-4 py-4 sm:px-5">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#566174] mb-1">
        If You Had Held…
      </div>
      <p className="text-[11px] text-[#8A95A6] mb-3">Total price return vs. S&amp;P 500 (SPY)</p>
      <div className="divide-y divide-[#E3E1DA]">
        <BarPair period="1 Year"  stock={stock1y} spy={spy1y} ticker={ticker} />
        <BarPair period="3 Years" stock={stock3y} spy={spy3y} ticker={ticker} />
        <BarPair period="5 Years" stock={stock5y} spy={spy5y} ticker={ticker} />
      </div>
      <p className="text-[11px] text-[#8A95A6] mt-3 leading-relaxed">
        Dividends not included · past performance is not indicative of future results
      </p>
    </div>
  )
}
