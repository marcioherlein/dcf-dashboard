'use client'
import { cn } from '@/lib/utils'
import { InfoTooltip } from '@/components/ui/info-tooltip'

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
  applicable: boolean
}

interface ValuationMethods {
  triangulatedFairValue: number | null
  triangulatedUpsidePct: number | null
  rationale?: string
  effectiveWeights?: { fcff: number; fcfe: number; ddm: number; multiples: number }
  models?: {
    fcff?: { fairValue: number | null; upsidePct: number | null }
    fcfe?: { applicable: boolean; fairValuePerShare: number }
    ddm?: { applicable: boolean; fairValuePerShare: number }
    multiples?: { estimates: MultipleEstimate[]; blendedFairValue: number | null }
  }
}

interface Scenario {
  fairValue: number | null
  wacc: number
  cagr: number
  terminalG: number
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
  scenarios?: { bull: Scenario; base: Scenario; bear: Scenario }
  cagr?: number
  terminalG?: number
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-[10px] font-bold uppercase tracking-wider text-slate-400 mb-2">{children}</p>
}

function Card({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-white border border-slate-200 px-4 py-3">
      {children}
    </div>
  )
}

function upsideColor(pct: number): string {
  if (pct >=  0.15) return 'text-emerald-600'
  if (pct >=  0.00) return 'text-emerald-500'
  if (pct >= -0.15) return 'text-amber-600'
  return 'text-red-600'
}

export default function ValuationSidebar({ wacc, valuationMethods, fairValue, currentPrice, currency, scenarios, cagr, terminalG }: Props) {
  const sym = currency === 'USD' ? '$' : currency === 'BRL' ? 'R$' : currency

  const estimates = valuationMethods?.models?.multiples?.estimates ?? []

  // By Method rows — multiples (applicable only) + Core DCF
  const methodDefs: { key: string; label: string }[] = [
    { key: 'P/E',        label: 'P/E Multiple'  },
    { key: 'EV/EBITDA',  label: 'EV/EBITDA'     },
    { key: 'EV/Revenue', label: 'EV/Revenue'     },
  ]
  const methods: { label: string; fv: number | null; upside: number | null }[] = [
    ...methodDefs.map(({ key, label }) => {
      const e = estimates.find(x => x.multiple === key)
      return { label, fv: (e?.applicable && e.impliedFairValue > 0) ? e.impliedFairValue : null, upside: e?.applicable ? e.upsidePct : null }
    }),
    {
      label: 'Core DCF',
      fv: fairValue?.fairValuePerShare ?? null,
      upside: fairValue?.upsidePct ?? null,
    },
  ]

  const blended = valuationMethods?.triangulatedFairValue
  const blendedUpside = valuationMethods?.triangulatedUpsidePct
  const weights = valuationMethods?.effectiveWeights

  // Peer multiples comparison rows
  const multipleRows = [
    { key: 'EV/EBITDA', label: 'EV/EBITDA' },
    { key: 'P/E',       label: 'P/E'        },
    { key: 'P/Sales',   label: 'P/Sales'    },
  ].map(({ key, label }) => {
    const e = estimates.find(x => x.multiple === key)
    return { label, company: e?.actualValue ?? null, sector: e?.sectorMedian ?? null }
  })

  // Model weights for display (filter out zero-weight models)
  const weightBars = weights ? [
    { label: 'DCF (FCFF)',   pct: weights.fcff,     color: 'bg-blue-400' },
    { label: 'FCFE',         pct: weights.fcfe,     color: 'bg-indigo-400' },
    { label: 'DDM',          pct: weights.ddm,      color: 'bg-purple-400' },
    { label: 'Multiples',    pct: weights.multiples, color: 'bg-sky-400' },
  ].filter(w => w.pct > 0) : []

  return (
    <div className="space-y-3">

      {/* Blended Fair Value hero */}
      {blended != null && (
        <Card>
          <SectionLabel>Blended Fair Value</SectionLabel>
          <div className="flex items-end justify-between">
            <span className="text-2xl font-bold text-slate-900 tabular-nums">
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
          {valuationMethods?.rationale && (
            <p className="text-[10px] text-slate-500 mt-1.5 leading-tight">{valuationMethods.rationale}</p>
          )}
        </Card>
      )}

      {/* By Method */}
      <Card>
        <SectionLabel>By Method</SectionLabel>
        <div className="space-y-1.5">
          {methods.map(({ label, fv, upside }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 truncate pr-2">{label}</span>
              <div className="flex items-center gap-1.5 shrink-0">
                <span className="text-[11px] font-semibold text-slate-900 tabular-nums">
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

      {/* Model Weights */}
      {weightBars.length > 0 && (
        <Card>
          <SectionLabel>Model Weights</SectionLabel>
          {/* Stacked bar */}
          <div className="flex h-2 rounded-full overflow-hidden mb-2.5">
            {weightBars.map(w => (
              <div key={w.label} className={cn(w.color, 'opacity-70')} style={{ width: `${w.pct}%` }} />
            ))}
          </div>
          <div className="space-y-1">
            {weightBars.map(w => (
              <div key={w.label} className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <div className={cn('w-2 h-2 rounded-full', w.color)} />
                  <span className="text-[11px] text-slate-500">{w.label}</span>
                </div>
                <span className="text-[11px] font-semibold text-slate-900 tabular-nums">{w.pct}%</span>
              </div>
            ))}
          </div>
        </Card>
      )}

      {/* WACC / Discount Rate */}
      <Card>
        <SectionLabel>Discount Rate</SectionLabel>
        <div className="space-y-1.5">
          {[
            { label: 'WACC',           value: (wacc.wacc * 100).toFixed(1) + '%',           tip: 'Weighted Average Cost of Capital — the minimum annual return this investment needs to justify its risk. Higher WACC = tougher bar to clear, lower fair value.' },
            { label: 'Cost of Equity', value: (wacc.costOfEquity * 100).toFixed(1) + '%',   tip: 'The return equity investors require for holding this stock, based on its risk (beta) and the broader market return.' },
            { label: 'Beta',           value: wacc.inputs.beta.toFixed(2),                   tip: 'Measures how much this stock moves relative to the market. Beta > 1 = more volatile than the market; < 1 = less volatile.' },
            { label: 'Risk-Free Rate', value: (wacc.inputs.rfRate * 100).toFixed(2) + '%',  tip: 'The yield on long-term government bonds — the baseline "safe" return everything else is measured against.' },
          ].map(({ label, value, tip }) => (
            <div key={label} className="flex items-center justify-between">
              <span className="text-[11px] text-slate-500 flex items-center gap-1">
                {label}
                <InfoTooltip text={tip} side="left" />
              </span>
              <span className="text-[11px] font-semibold text-slate-900 tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      </Card>

      {/* Growth Assumptions */}
      {(cagr != null || terminalG != null) && (
        <Card>
          <SectionLabel>Growth Assumptions</SectionLabel>
          <div className="space-y-1.5">
            {cagr != null && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Revenue CAGR (5Y)</span>
                <span className="text-[11px] font-semibold text-slate-900 tabular-nums">
                  {(cagr * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {terminalG != null && (
              <div className="flex items-center justify-between">
                <span className="text-[11px] text-slate-500">Terminal Growth</span>
                <span className="text-[11px] font-semibold text-slate-900 tabular-nums">
                  {(terminalG * 100).toFixed(1)}%
                </span>
              </div>
            )}
            {cagr != null && terminalG != null && (
              <p className="text-[10px] text-slate-500 mt-0.5 leading-tight">
                {cagr > 0.15 ? 'High-growth: 3-stage DCF model' : 'Standard: 2-stage DCF model'}
              </p>
            )}
          </div>
        </Card>
      )}

      {/* Scenario Analysis */}
      {scenarios && (
        <Card>
          <SectionLabel>Scenario Analysis</SectionLabel>
          <div className="space-y-1.5">
            {[
              { label: 'Bull', scenario: scenarios.bull, color: 'text-emerald-600' },
              { label: 'Base', scenario: scenarios.base, color: 'text-blue-600'    },
              { label: 'Bear', scenario: scenarios.bear, color: 'text-red-600'     },
            ].map(({ label, scenario, color }) => {
              const fv = scenario.fairValue
              const upside = fv != null && currentPrice > 0 ? (fv - currentPrice) / currentPrice : null
              return (
                <div key={label} className="flex items-center justify-between">
                  <div className="flex items-center gap-1.5">
                    <span className={cn('text-[10px] font-bold w-8', color)}>{label}</span>
                    <span className="text-[9px] text-slate-500 tabular-nums">
                      {(scenario.cagr * 100).toFixed(0)}% / {(scenario.wacc * 100).toFixed(1)}%
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <span className="text-[11px] font-semibold text-slate-900 tabular-nums">
                      {fv != null ? `${sym}${fv.toFixed(2)}` : '—'}
                    </span>
                    {upside != null && (
                      <span className={cn('text-[10px] tabular-nums w-12 text-right', upsideColor(upside))}>
                        {upside >= 0 ? '+' : ''}{(upside * 100).toFixed(0)}%
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
          </div>
          <p className="text-[9px] text-slate-600 mt-2">CAGR / WACC per scenario</p>
        </Card>
      )}

      {/* How We Value This Stock */}
      <Card>
        <SectionLabel>How We Value This Stock</SectionLabel>
        <div className="space-y-3">
          {[
            {
              dot: 'bg-blue-500',
              label: 'DCF (Discounted Cash Flow)',
              desc: 'Projects how much free cash this business will generate over the next 5–10 years, then asks: "What is that future money worth in today\'s dollars?" The discount rate (WACC) reflects the risk — the higher the risk, the less today\'s dollars are worth.',
            },
            {
              dot: 'bg-sky-500',
              label: 'Multiples (P/E, EV/EBITDA)',
              desc: 'Compares this company to similar ones in its sector. If peers trade at 20× earnings and this company earns $5/share, the implied fair value is $100. It\'s anchored to what the market is currently paying — not what the company is fundamentally worth.',
            },
            {
              dot: 'bg-purple-500',
              label: 'DDM (Dividend Discount Model)',
              desc: 'Only applies to dividend-paying stocks. Values the company as the sum of all future dividend payments, discounted back to today. Irrelevant for companies that don\'t pay dividends.',
            },
            {
              dot: 'bg-indigo-500',
              label: 'FCFE (Free Cash Flow to Equity)',
              desc: 'Similar to DCF but focuses only on cash left over for shareholders after the company services its debt. More relevant for highly leveraged companies where debt repayment significantly affects equity value.',
            },
          ].map(({ dot, label, desc }) => (
            <div key={label} className="flex gap-2.5">
              <span className={cn('w-2 h-2 rounded-full shrink-0 mt-1.5', dot)} />
              <div>
                <p className="text-[11px] font-semibold text-slate-700 leading-tight">{label}</p>
                <p className="text-[10px] text-slate-500 leading-snug mt-0.5">{desc}</p>
              </div>
            </div>
          ))}
        </div>
      </Card>

      {/* Why Methods Disagree */}
      <Card>
        <SectionLabel>Why Methods Can Disagree</SectionLabel>
        <div className="space-y-2 text-[11px] text-slate-500 leading-snug">
          <p>
            <span className="font-semibold text-slate-700">DCF is forward-looking.</span>{' '}
            It values future growth. If a company is expected to grow fast, DCF tends to produce higher fair values — but it&apos;s sensitive to the assumptions you make.
          </p>
          <p>
            <span className="font-semibold text-slate-700">Multiples are market-based.</span>{' '}
            They reflect what investors are paying today for similar companies. In bull markets, multiples expand; in downturns, they compress — regardless of fundamentals.
          </p>
          <p>
            <span className="font-semibold text-slate-700">Large divergence = more uncertainty.</span>{' '}
            When methods produce very different numbers, it often means the market is pricing in a growth story the fundamentals don&apos;t yet confirm — or vice versa. The blended value averages them, weighted by applicability.
          </p>
        </div>
      </Card>

    </div>
  )
}

