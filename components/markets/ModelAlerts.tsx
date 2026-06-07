'use client'
import { cn } from '@/lib/utils'
import type { ModelAlert } from '@/lib/market-context/types'

interface Props {
  alerts: ModelAlert[]
}

function alertBorderClass(severity: ModelAlert['severity']): string {
  return severity === 'high' ? 'border-[#E3E1DA] bg-[#FCEAEA]' : 'border-[#E3E1DA] bg-[#FFF4DA]'
}

function alertBadgeClass(alertType: ModelAlert['alertType']): string {
  if (alertType === 'ALERT_GORDON_VIOLATION') return 'bg-[#FCEAEA] text-[#D83B3B]'
  if (alertType === 'ALERT_WACC_LOW')         return 'bg-[#FCEAEA] text-[#D83B3B]'
  return 'bg-[#FFF4DA] text-[#B56A00]'
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
        <span className="text-[#11875D] text-sm font-medium">All saved models look healthy given current macro regime.</span>
      </div>
    )
  }

  return (
    <div className="rounded-xl glass-card-light overflow-hidden">
      <div className="px-4 py-2.5 border-b border-[#E3E1DA]">
        <span className="text-[11px] font-bold text-[#566174] uppercase tracking-wider">Model Fragility Alerts</span>
        <p className="text-[10px] text-[#8A95A6] mt-0.5">{alerts.length} saved {alerts.length === 1 ? 'valuation' : 'valuations'} may be stale given today&apos;s rates</p>
      </div>
      <div className="divide-y divide-[#E3E1DA]">
        {alerts.map((a, i) => (
          <div key={i} className={cn('flex items-start gap-3 px-4 py-3 rounded-lg mx-2 my-1', a.severity === 'high' ? 'bg-[#FCEAEA]/60' : 'bg-[#FFF4DA]/60', alertBorderClass(a.severity))}>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <span className="text-xs font-bold font-mono text-[#06101F] bg-[#E3E1DA] border border-[#E3E1DA] px-1.5 py-0.5 rounded">{a.ticker}</span>
                <span className={cn('text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider', alertBadgeClass(a.alertType))}>
                  {alertTypeLabel(a.alertType)}
                </span>
                <span className="text-xs text-[#566174] truncate">{a.company}</span>
              </div>
              <p className="text-xs text-[#06101F] mt-1 leading-relaxed">{a.message}</p>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}
