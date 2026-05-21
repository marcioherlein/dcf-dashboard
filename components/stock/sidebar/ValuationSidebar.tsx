'use client'
import { cn } from '@/lib/utils'

interface WACCData {
  wacc: number
  costOfEquity: number
  afterTaxCostOfDebt: number
  inputs: { beta: number; rfRate: number; erp: number }
}

interface MultipleEstimate {
  multiple: string
  impliedFairValue: number
  upsidePct: number
  sectorMedian: number
  actualValue: number
}

interface ValuationMethods {
  triangulatedFairValue: number | null
  triangulatedUpsidePct: number | null
  models?: {
    multiples?: {
      estimates: MultipleEstimate[]
    }
  }
}

interface FairValue {
  fairValuePerShare: number
  upsidePct: number
}

interface Props {
  wacc: WACCData
  valuationMethods?: ValuationMethods
  fairValue: FairValue
  currentPrice: number
  currency: string
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{children}</p>
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl glass-card border-[rgba(59,130,246,0.15)] px-4 py-3">
      {children}
    </div>
  )
}

function upsideColor(pct: number): string {
  if (pct >=  0.15) return 'text-emerald-400'
  if (pct >=  0.00) return 'text-emerald-300'
  if (pct >= -0.15) return 'text-amber-400'
  return 'text-red-400'
}

export default function ValuationSidebar({ wacc, valuationMethods, fairValue, currentPrice, currency }: Props) {
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency

  const estimates = valuationMethods?.models?.multiples?.estimates ?? []

  // Build method rows — multiples from estimates + Core DCF from fairValue
  const methods: { label: string; fv: number | null; upside: number | null; isBlended?: boolean }[] = [
    ...['Forward P/E', 'EV/EBITDA', 'Revenue Multiple'].map(name => {
      const e = estimates.find(x => x.multiple === name || x.multiple.startsWith(name.split(' ')[0]))
      return { label: name, fv: e?.impliedFairValue ?? null, upside: e?.upsidePct ?? null }
    }),
    {
      label: 'Core DCF',
      fv: fairValue?.fairValuePerShare ?? null,
      upside: fairValue?.upsidePct ?? null,
    },
  ]

  const blended = valuationMethods?.triangulatedFairValue
  const blendedUpside = valuationMethods?.triangulatedUpsidePct

  // Peer multiples comparison rows
  const multipleRows = ['EV/EBITDA', 'P/E', 'P/S'].map(name => {
    const e = estimates.find(x => x.multiple === name || x.multiple.startsWith(name.split('/')[0]))
    return { label: name, company: e?.actualValue ?? null, sector: e?.sectorMedian ?? null }
  })

  return (
    <div className="space-y-3">

      {/* Blended Fair Value hero */}
      {blended != null && (
        <Card>
          <SectionLabel>Blended Fair Value</SectionLabel>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-100 tabular-nums">
              {sym}{blended.toFixed(2)}
            </span>
            {blendedUpside != null && (
              <span className={cn('text-sm font-bold tabular-nums mb-0.5', upsideColor(blendedUpside))}>
                {blendedUpside >= 0 ? '+' : ''}{(blendedUpside * 100).toFixed(1)}%
              </span>
            )}
          </div>
          <p className="text-[10px] text-slate-400 mt-0.5">
            vs current {sym}{currentPrice.toFixed(2)}
          </p>
        </Card>
      )}

      {/* Method Fair Values */}
      <Card>
        <SectionLabel>By Method</SectionLabel>
        <div className="space-y-1.5">
          {methods.map(({ label, fv, upside }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400 truncate pr-2">{label}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-semibold text-slate-200 tabular-nums">
                  {fv != null ? `${sym}${fv.toFixed(2)}` : '—'}
                </span>
                {upside != null && (
                  <span className={cn('text-[10px] font-semibold tabular-nums w-14 text-right', upsideColor(upside))}>
                    {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(1)}%
                  </span>
                )}
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* WACC Snapshot */}
      <Card>
        <SectionLabel>WACC Snapshot</SectionLabel>
        <div className="space-y-1.5">
          {[
            { label: 'WACC',              value: (wacc.wacc * 100).toFixed(1) + '%' },
            { label: 'Cost of Equity',    value: (wacc.costOfEquity * 100).toFixed(1) + '%' },
            { label: 'Beta',              value: wacc.inputs.beta.toFixed(2) },
          ].map(({ label, value }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px] text-slate-400">{label}</span>
              <span className="text-[11px] font-semibold text-slate-200 tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Peer Multiples */}
      {multipleRows.some(r => r.company != null) && (
        <Card>
          <SectionLabel>vs Sector Median</SectionLabel>
          <div className="space-y-1.5">
            <div className="flex justify-between text-[9px] text-slate-500 mb-1">
              <span>Multiple</span>
              <div className="flex gap-4">
                <span>Company</span>
                <span>Sector</span>
              </div>
            </div>
            {multipleRows.map(({ label, company, sector }) => {
              if (company == null && sector == null) return null
              const isExpensive = company != null && sector != null && company > sector * 1.1
              const isCheap     = company != null && sector != null && company < sector * 0.9
              return (
                <div key={label} className="flex items-center justify-between">
                  <span className="text-[11px] text-slate-400">{label}</span>
                  <div className="flex gap-4">
                    <span className={cn(
                      'text-[11px] font-semibold tabular-nums w-12 text-right',
                      isExpensive ? 'text-amber-400' : isCheap ? 'text-emerald-400' : 'text-slate-200'
                    )}>
                      {company != null ? company.toFixed(1) + '×' : '—'}
                    </span>
                    <span className="text-[11px] text-slate-400 tabular-nums w-12 text-right">
                      {sector != null ? sector.toFixed(1) + '×' : '—'}
                    </span>
                  </div>
                </div>
              )
            })}
          </div>
        </Card>
      )}

    </div>
  )
}
