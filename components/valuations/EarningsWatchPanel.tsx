'use client'
import { cn } from '@/lib/utils'
import type { WatchlistEntry } from '@/lib/simplifier/types'

interface Props {
  entry: WatchlistEntry
}

function daysUntil(iso: string | null | undefined): number | null {
  if (!iso) return null
  const ms = new Date(iso).getTime() - Date.now()
  return Math.ceil(ms / 86400000)
}

function fmtPct(v: number | null | undefined): string {
  if (v == null) return '—'
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'
}

function fmtMultiple(v: number | null | undefined): string {
  if (v == null) return '—'
  return v.toFixed(1) + '×'
}

function urgencyColor(days: number): string {
  if (days <= 3)  return 'bg-[#FCEAEA] text-[#D83B3B] border-[#F0B8B8]'
  if (days <= 14) return 'bg-[#FFF4DA] text-[#B56A00] border-[#F3D391]'
  return 'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]'
}

interface WatchItem {
  label: string
  confirm: string   // what would confirm the thesis
  challenge: string // what would challenge it
  importance: 'high' | 'medium'
}

function buildWatchItems(entry: WatchlistEntry): WatchItem[] {
  const snap = entry.snapshot
  const wacc  = snap.savedWacc
  const cagr  = snap.savedCagr
  const margin = snap.savedNetMargin
  const items: WatchItem[] = []

  // Revenue growth — always the most important for a DCF
  if (cagr != null) {
    const cagrPct = (cagr * 100).toFixed(0)
    items.push({
      label: `Revenue growth (your model: ${cagrPct}% CAGR)`,
      confirm:   `Revenue grows ≥${cagrPct}% YoY, or guidance raises the full-year outlook`,
      challenge: `Revenue misses consensus or management guides below ${cagrPct}% growth`,
      importance: 'high',
    })
  } else {
    items.push({
      label: 'Revenue growth',
      confirm:   'Revenue beats consensus and full-year guidance is raised',
      challenge: 'Revenue misses or guidance is lowered',
      importance: 'high',
    })
  }

  // Margin — second most important for P/E and DCF
  if (margin != null) {
    const mPct = (margin * 100).toFixed(0)
    items.push({
      label: `Profitability (your model: ${mPct}% exit net margin)`,
      confirm:   `Operating margin expands or holds; management affirms margin trajectory toward ${mPct}%`,
      challenge: `Gross or operating margin compresses; cost inflation or investment spend cited`,
      importance: 'high',
    })
  } else {
    items.push({
      label: 'Profitability trend',
      confirm:   'Gross margin holds or expands; operating leverage is evident',
      challenge: 'Margin compression from competition, costs, or investment cycle',
      importance: 'high',
    })
  }

  // WACC / discount rate signals
  if (wacc != null) {
    const waccPct = (wacc * 100).toFixed(1)
    items.push({
      label: `Risk & balance sheet (your WACC: ${waccPct}%)`,
      confirm:   'No new debt issuance, buybacks signal confidence, credit rating stable',
      challenge: `Unexpected capital raise, balance sheet deterioration, or guidance language implying higher risk than ${waccPct}% WACC assumes`,
      importance: 'medium',
    })
  }

  // Forward guidance — always relevant
  items.push({
    label: 'Forward guidance quality',
    confirm:   'Management raises or holds full-year guidance; tone is specific and confident',
    challenge: 'Guidance is vague, lowered, or withdrawn; management cites macro uncertainty',
    importance: 'medium',
  })

  // Free cash flow conversion
  if (snap.fcfMargin != null && snap.fcfMargin > 0) {
    items.push({
      label: `FCF conversion (saved FCF margin: ${(snap.fcfMargin * 100).toFixed(0)}%)`,
      confirm:   'FCF per share grows in line with earnings; working capital is well managed',
      challenge: 'FCF lags net income; capex is rising faster than revenue',
      importance: 'medium',
    })
  }

  return items
}

export default function EarningsWatchPanel({ entry }: Props) {
  const snap = entry.snapshot
  const days = daysUntil(snap.nextEarningsDate)
  const hasAssumptions = snap.savedWacc != null || snap.savedCagr != null
  const items = buildWatchItems(entry)

  if (!hasAssumptions && days == null) return null

  return (
    <div className="mt-3 border-t border-[#E5E5E5] pt-3">

      {/* Header */}
      <div className="flex items-center gap-2 mb-3 flex-wrap">
        <p className="text-[11px] font-[700] text-[#111111] uppercase tracking-[0.04em]">
          Earnings Watch
        </p>
        {days != null && (
          <span className={cn(
            'text-[10px] font-[700] px-2 py-0.5 rounded-full border whitespace-nowrap',
            days < 0 ? 'bg-[#F5F5F5] text-[#9B9B9B] border-[#E5E5E5]' : urgencyColor(days),
          )}>
            {days < 0
              ? `Earnings passed ${Math.abs(days)}d ago`
              : days === 0
              ? '🔴 Earnings today'
              : `${days}d to earnings · ${new Date(snap.nextEarningsDate!).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`
            }
          </span>
        )}
        {hasAssumptions && (
          <span className="text-[10px] text-[#9B9B9B]">
            Based on your saved assumptions
            {snap.savedWacc != null && ` · WACC ${(snap.savedWacc * 100).toFixed(1)}%`}
            {snap.savedCagr != null && ` · CAGR ${(snap.savedCagr * 100).toFixed(0)}%`}
          </span>
        )}
      </div>

      {/* What to watch */}
      <div className="space-y-2">
        {items.map((item, i) => (
          <div
            key={i}
            className={cn(
              'rounded-xl border px-3.5 py-3',
              item.importance === 'high'
                ? 'bg-white border-[#E5E5E5]'
                : 'bg-[#FAFAFA] border-[#F0F0F0]',
            )}
          >
            <div className="flex items-start gap-2">
              <span className={cn(
                'text-[9px] font-[800] px-1.5 py-0.5 rounded-full border shrink-0 mt-0.5 uppercase tracking-wide',
                item.importance === 'high'
                  ? 'bg-[#EAF1FF] text-[#2563EB] border-[#93B4F5]'
                  : 'bg-[#F5F5F5] text-[#9B9B9B] border-[#E5E5E5]',
              )}>
                {item.importance === 'high' ? 'Key' : 'Watch'}
              </span>
              <p className="text-[11px] font-[650] text-[#111111] leading-snug">{item.label}</p>
            </div>
            <div className="mt-2 grid grid-cols-1 sm:grid-cols-2 gap-2 ml-7">
              <div className="flex items-start gap-1.5">
                <span className="text-[11px] shrink-0 mt-px">✓</span>
                <p className="text-[11px] text-[#11875D] leading-snug">{item.confirm}</p>
              </div>
              <div className="flex items-start gap-1.5">
                <span className="text-[11px] shrink-0 mt-px">✗</span>
                <p className="text-[11px] text-[#D83B3B] leading-snug">{item.challenge}</p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Saved assumptions strip */}
      {hasAssumptions && (
        <div className="mt-3 flex items-center gap-3 flex-wrap px-1">
          {[
            { label: 'WACC',       value: fmtPct(snap.savedWacc) },
            { label: 'CAGR',       value: fmtPct(snap.savedCagr) },
            { label: 'Net Margin', value: fmtPct(snap.savedNetMargin) },
            { label: 'Exit P/E',   value: fmtMultiple(snap.savedExitPE) },
            { label: 'EV/EBITDA',  value: fmtMultiple(snap.savedExitMultiple) },
          ].filter(x => x.value !== '—').map(({ label, value }) => (
            <div key={label} className="flex items-center gap-1">
              <span className="text-[10px] text-[#9B9B9B]">{label}</span>
              <span className="text-[11px] font-[650] text-[#111111] tabular-nums">{value}</span>
            </div>
          ))}
          <span className="text-[10px] text-[#C0C0C0] ml-auto">Assumptions at save time</span>
        </div>
      )}
    </div>
  )
}
