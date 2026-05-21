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

function fmt(v: number | null): string {
  if (v == null) return '—'
  if (v >= 1e9) return `${(v / 1e9).toFixed(1)}B`
  if (v >= 1e6) return `${(v / 1e6).toFixed(1)}M`
  return v.toLocaleString()
}

function Stat({ label, value, highlight }: { label: string; value: string; highlight?: 'red' | 'green' }) {
  return (
    <div className="flex flex-col gap-0.5">
      <span className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{label}</span>
      <span className={[
        'text-[13px] font-semibold tabular-nums',
        highlight === 'red'   ? 'text-red-400'   :
        highlight === 'green' ? 'text-emerald-400' :
        'text-slate-200',
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
    <div className="rounded-xl glass-card border border-[rgba(59,130,246,0.2)] px-5 py-4">
      <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">Ownership &amp; Short Interest</div>
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-x-6 gap-y-3">
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
