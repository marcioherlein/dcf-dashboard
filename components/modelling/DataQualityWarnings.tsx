'use client'

interface Warning {
  type: 'error' | 'warning' | 'info'
  message: string
}

interface DataQualityWarningsProps {
  terminalGError?: string | null
  financialCurrencyNote?: string | null
  isFinancialSector?: boolean
  isNegativeFCF?: boolean
  altmanZone?: string | null
  beneishFlag?: string | null
  crp?: number
  financialCurrency?: string
  fcfCapApplied?: boolean
  debtOverhang?: boolean
  netDebtM?: number
}

export default function DataQualityWarnings({
  terminalGError,
  financialCurrencyNote,
  isFinancialSector,
  isNegativeFCF,
  altmanZone,
  beneishFlag,
  crp,
  financialCurrency,
  fcfCapApplied,
  debtOverhang,
  netDebtM,
}: DataQualityWarningsProps) {
  const warnings: Warning[] = []

  if (terminalGError) {
    warnings.push({ type: 'error', message: terminalGError })
  }
  if (financialCurrencyNote) {
    warnings.push({ type: 'warning', message: `FX mismatch: ${financialCurrencyNote}. Fair value per share is suppressed — see main DCF model for FX-adjusted figure.` })
  }
  if (crp && crp > 0 && financialCurrency) {
    warnings.push({ type: 'info', message: `Country Risk Premium of +${(crp * 100).toFixed(1)}% applied to ERP for ${financialCurrency} reporting companies (Damodaran 2025). This increases cost of equity and lowers fair value vs. a USD baseline.` })
  }
  if (isFinancialSector) {
    warnings.push({ type: 'info', message: 'Financial company: UFCF/FCFF is not reliable (loan book changes distort operating cash flows). Use Levered DCF as the primary model.' })
  }
  if (isNegativeFCF) {
    warnings.push({ type: 'info', message: 'Current FCF is negative — valuation depends on projected FCF turning positive. Terminal value will dominate. Treat with caution.' })
  }
  if (altmanZone === 'Distress') {
    warnings.push({ type: 'warning', message: 'Altman Z-Score indicates financial distress. Going-concern risk may not be fully captured by the DCF model.' })
  }
  if (beneishFlag === 'Manipulator') {
    warnings.push({ type: 'warning', message: 'Beneish M-Score flags potential earnings manipulation. Reported FCF may overstate true cash generation.' })
  }
  if (fcfCapApplied) {
    warnings.push({ type: 'info', message: 'FCF was capped at 15% of market cap — raw FCF yield exceeded 30%, which may reflect a cyclical peak. Terminal value may dominate the valuation.' })
  }
  if (debtOverhang) {
    const netDebtB = netDebtM != null ? (netDebtM / 1000).toFixed(1) : null
    const debtLabel = netDebtB != null ? ` Net debt of $${netDebtB}b` : ' Net debt'
    warnings.push({ type: 'warning', message: `${debtLabel} exceeds the estimated enterprise value — intrinsic value is floored at $0. This usually means debt figures include a captive finance subsidiary (e.g. GM Financial, Ford Motor Credit). If so, verify that only long-term issued bonds are being used as the debt input.` })
  }

  if (warnings.length === 0) return null

  const icon = {
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  }
  const colors = {
    error:   { bg: 'bg-[#FCEAEA]',  border: 'border-[#F0B8B8]', text: 'text-[#D83B3B]', icon: 'text-[#D83B3B]' },
    warning: { bg: 'bg-[#FFF4DA]',  border: 'border-[#F3D391]', text: 'text-[#B56A00]', icon: 'text-[#B56A00]' },
    info:    { bg: 'bg-[#EAF1FF]',  border: 'border-[#93B4F5]', text: 'text-[#2563EB]', icon: 'text-[#2563EB]' },
  }

  return (
    <div className="space-y-2">
      {warnings.map((w, i) => {
        const c = colors[w.type]
        return (
          <div key={i} className={`flex gap-2.5 rounded-lg border px-3.5 py-2.5 text-[12px] leading-snug ${c.bg} ${c.border} ${c.text}`}>
            <span className={`mt-0.5 shrink-0 font-bold text-[11px] ${c.icon}`}>{icon[w.type]}</span>
            <span>{w.message}</span>
          </div>
        )
      })}
    </div>
  )
}
