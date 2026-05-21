'use client'
import { cn } from '@/lib/utils'
import type { ModelAlert } from '@/lib/market-context/types'

interface Props {
  alerts: ModelAlert[]
}

function alertBorderClass(severity: ModelAlert['severity']): string {
  return severity === 'high' ? 'border-red-500/30 bg-red-500/10' : 'border-amber-500/30 bg-amber-500/10'
}

function alertBadgeClass(alertType: ModelAlert['alertType']): string {
  if (alertType === 'ALERT_GORDON_VIOLATION') return 'bg-red-500/20 text-red-400'
  if (alertType === 'ALERT_WACC_LOW')         return 'bg-red-500/20 text-red-400'
  return 'bg-amber-500/20 text-amber-400'
}

function alertTypeLabel(alertType: ModelAlert['alertType']): string {
  if (alertType === 'ALERT_GORDON_VIOLATION') return 'Gordon Violation'
  if (alertType === 'ALERT_WACC_LOW')         return 'WACC Too Low'
  return 'CAGR Too High'
}

export default function ModelAlerts({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] px-4 py-3 flex items-center gap-2">
        <span className="text-emerald-400 text-sm font-medium">All saved models look healthy given current macro regime.</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] overflow-hidden">
      <div className="px-4 py-3 border-b border-white/10">
        <h2 className="text-sm font-bold text-slate-100">Model Fragility Alerts</h2>
        <p className="text-xs text-slate-400 mt-0.5">{alerts.length} saved {alerts.length === 1 ? 'valuation' : 'valuations'} may be stale given today&apos;s rates</p>
      </div>
      <div className="divide-y divide-white/8">
        {alerts.map((a, i) => (
          <div key={i} className={cn('flex items-start gap-3 px-4 py-3 border-l-4', a.severity === 'high' ? 'border-l-red-400' : 'border-l-amber-400', alertBorderClass(a.severity))}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold font-mono text-slate-100 bg-white/10 border border-white/20 px-1.5 py-0.5 rounded">{a.ticker}</span>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider', alertBadgeClass(a.alertType))}>
                  {alertTypeLabel(a.alertType)}
                </span>
                <span className="text-xs text-slate-400 truncate">{a.company}</span>
              </div>
              <p className="text-xs text-slate-300 mt-1 leading-relaxed">{a.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
