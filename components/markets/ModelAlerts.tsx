'use client'
import { cn } from '@/lib/utils'
import type { ModelAlert } from '@/lib/market-context/types'

interface Props {
  alerts: ModelAlert[]
}

function alertBorderClass(severity: ModelAlert['severity']): string {
  return severity === 'high' ? 'border-red-200 bg-red-50' : 'border-amber-200 bg-amber-50'
}

function alertBadgeClass(alertType: ModelAlert['alertType']): string {
  if (alertType === 'ALERT_GORDON_VIOLATION') return 'bg-red-100 text-red-700'
  if (alertType === 'ALERT_WACC_LOW')         return 'bg-red-100 text-red-700'
  return 'bg-amber-100 text-amber-700'
}

function alertTypeLabel(alertType: ModelAlert['alertType']): string {
  if (alertType === 'ALERT_GORDON_VIOLATION') return 'Gordon Violation'
  if (alertType === 'ALERT_WACC_LOW')         return 'WACC Too Low'
  return 'CAGR Too High'
}

export default function ModelAlerts({ alerts }: Props) {
  if (alerts.length === 0) {
    return (
      <div className="rounded-xl glass-card-light px-4 py-3 flex items-center gap-2">
        <span className="text-emerald-700 text-sm font-medium">All saved models look healthy given current macro regime.</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl glass-card-light overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-200">
        <h2 className="text-sm font-bold text-slate-900">Model Fragility Alerts</h2>
        <p className="text-xs text-slate-500 mt-0.5">{alerts.length} saved {alerts.length === 1 ? 'valuation' : 'valuations'} may be stale given today&apos;s rates</p>
      </div>
      <div className="divide-y divide-slate-100">
        {alerts.map((a, i) => (
          <div key={i} className={cn('flex items-start gap-3 px-4 py-3 border-l-4', a.severity === 'high' ? 'border-l-red-400' : 'border-l-amber-400', alertBorderClass(a.severity))}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold font-mono text-slate-700 bg-slate-100 border border-slate-200 px-1.5 py-0.5 rounded">{a.ticker}</span>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider', alertBadgeClass(a.alertType))}>
                  {alertTypeLabel(a.alertType)}
                </span>
                <span className="text-xs text-slate-500 truncate">{a.company}</span>
              </div>
              <p className="text-xs text-slate-700 mt-1 leading-relaxed">{a.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
