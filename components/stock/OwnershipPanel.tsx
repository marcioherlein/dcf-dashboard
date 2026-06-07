'use client'

interface Ownership {
  insiderPct: number | null
  institutionalPct: number | null
  shortPct: number | null
  shortRatio: number | null
  sharesShort: number | null
}

interface Props {
  ownership: Ownership
}

function pct(v: number | null, decimals = 1): string {
  if (v == null) return '—'
  return `${(v * 100).toFixed(decimals)}%`
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: 'red' | 'green' }) {
  return (
    <div className="flex flex-col gap-1 py-3 min-h-[44px]">
      <span className="text-[11px] font-semibold uppercase tracking-wider text-[#566174] leading-tight">{label}</span>
      <span className={[
        'text-[13px] font-semibold tabular-nums',
        highlight === 'red'   ? 'text-[#D83B3B]'   :
        highlight === 'green' ? 'text-[#11875D]' :
        'text-[#06101F]',
      ].join(' ')}>
        {value}
      </span>
    </div>
  )
}

export default function OwnershipPanel({ ownership }: Props) {
  const { insiderPct, institutionalPct, shortPct, shortRatio } = ownership

  const shortHighlight = shortPct != null
    ? shortPct > 0.15 ? 'red' : shortPct > 0.05 ? undefined : 'green'
    : undefined

  return (
    <div className="rounded-xl card px-4 py-3 sm:px-5 sm:py-4">
      <div className="text-[11px] font-semibold uppercase tracking-wider text-[#566174] mb-2">Ownership &amp; Short Interest</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-4 gap-y-0 divide-y sm:divide-y-0 divide-[#E3E1DA]">
        <Stat label="Insider Ownership"       value={pct(insiderPct)} />
        <Stat label="Institutional Ownership" value={pct(institutionalPct)} />
        <Stat
          label="Short Interest (Float)"
          value={pct(shortPct)}
          highlight={shortHighlight}
        />
        <Stat
          label="Short Ratio (Days to Cover)"
          value={shortRatio != null ? `${shortRatio.toFixed(1)}d` : '—'}
          highlight={shortRatio != null && shortRatio > 10 ? 'red' : undefined}
        />
      </div>
    </div>
  )
}
