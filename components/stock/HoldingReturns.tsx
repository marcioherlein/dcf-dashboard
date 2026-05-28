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

function ReturnPair({
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
  return (
    <div className="flex flex-col gap-1.5">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{period}</div>
      <div className="flex items-baseline gap-1.5">
        <span className={[
          'text-[15px] font-bold tabular-nums',
          stock == null ? 'text-slate-500' :
          stock >= 0 ? 'text-emerald-600' : 'text-red-600',
        ].join(' ')}>
          {pctStr(stock)}
        </span>
        <span className="text-[10px] font-medium text-slate-500 font-mono">{ticker}</span>
      </div>
      {spy != null && (
        <div className="flex items-center gap-1">
          <span className={[
            'text-[11px] tabular-nums',
            spy >= 0 ? 'text-slate-400' : 'text-slate-500',
          ].join(' ')}>
            {pctStr(spy)}
          </span>
          <span className="text-[10px] text-slate-600">SPY</span>
          {outperformed != null && (
            <span className={[
              'text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded-full',
              outperformed
                ? 'text-emerald-600 bg-emerald-50'
                : 'text-red-600 bg-red-50',
            ].join(' ')}>
              {outperformed ? 'Beat' : 'Lagged'}
            </span>
          )}
        </div>
      )}
    </div>
  )
}

export default function HoldingReturns({ returns, ticker }: Props) {
  const { stock1y, stock3y, stock5y, spy1y, spy3y, spy5y } = returns
  if (stock1y == null && stock3y == null && stock5y == null) return null

  return (
    <div className="rounded-xl card px-5 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
        If You Had Held…
      </div>
      <div className="grid grid-cols-3 gap-x-6 gap-y-1">
        <ReturnPair period="1 Year" stock={stock1y} spy={spy1y} ticker={ticker} />
        <ReturnPair period="3 Years" stock={stock3y} spy={spy3y} ticker={ticker} />
        <ReturnPair period="5 Years" stock={stock5y} spy={spy5y} ticker={ticker} />
      </div>
      <div className="mt-3 text-[10px] text-slate-600">
        Total price return · dividends not included · past performance is not indicative of future results
      </div>
    </div>
  )
}
