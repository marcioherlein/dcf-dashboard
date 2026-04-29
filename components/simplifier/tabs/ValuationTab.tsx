'use client'

import { PHASES } from '@/lib/simplifier/phases'
import type { AllAnswers, NoteMap, SimplifierAutoMap } from '@/lib/simplifier/types'
import type { FinancialsData } from '@/lib/simplifier/autoMapper'
import { buildValuationSummary } from '@/lib/simplifier/summaryBuilder'
import ScoreCircle from '../ScoreCircle'
import SectionSummary from '../SectionSummary'
import QuestionCircle from '../QuestionCircle'
import { VALUATION_CONFIG } from '@/config/valuation.config'

interface ValuationTabProps {
  companyName: string
  data: FinancialsData
  answers: AllAnswers
  notes: NoteMap
  autoMap: SimplifierAutoMap
  onChange: (id: string, answer: import('@/lib/simplifier/types').Answer) => void
  onNoteChange: (id: string, note: string) => void
}

const VAL_QUESTION_IDS = ['val_price_reasonable', 'val_margin_of_safety']

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pct(v: number | null, decimals = 1) {
  return v == null ? '—' : `${(v * 100).toFixed(decimals)}%`
}
function money(v: number | null, decimals = 2) {
  return v == null ? '—' : `$${v.toFixed(decimals)}`
}
function moneyM(v: number | null) {
  if (v == null) return '—'
  if (Math.abs(v) >= 1000) return `$${(v / 1000).toFixed(1)}B`
  return `$${v.toFixed(0)}M`
}
function num(v: number | null, d = 1) { return v == null ? '—' : v.toFixed(d) }
function sign(v: number) { return v >= 0 ? '+' : '' }

function upsideZone(u: number | null) {
  if (u == null) return { label: '—', color: 'text-[#6B6A72]', bg: '', border: '' }
  const { attractive, fairValue } = VALUATION_CONFIG.upsideZones
  if (u >= attractive)  return { label: 'Attractive',  color: 'text-[#1f6feb]', bg: 'bg-[#EEF4FF]',  border: 'border-[#DCE6F5]' }
  if (u >= fairValue)   return { label: 'Fair Value',  color: 'text-[#9a6700]', bg: 'bg-[#FEF9C3]',  border: 'border-[#FDE68A]' }
  return                       { label: 'Expensive',   color: 'text-[#cf222e]', bg: 'bg-[#FEE2E2]',  border: 'border-[#FECACA]' }
}

// ─── Upside meter bar ─────────────────────────────────────────────────────────
function UpsideMeter({ upsidePct }: { upsidePct: number | null }) {
  if (upsidePct == null) return null
  // Map [-1.0, +1.0] → [0%, 100%] fill
  const clamped = Math.max(-1, Math.min(1, upsidePct))
  const fillPct = Math.round((clamped + 1) / 2 * 100)
  const { attractive, fairValue } = VALUATION_CONFIG.upsideZones
  const attractiveFill = Math.round((attractive + 1) / 2 * 100)
  const fairFill = Math.round((fairValue + 1) / 2 * 100)
  const zone = upsideZone(upsidePct)

  return (
    <div className="mt-3">
      <div className="relative h-3 rounded-full bg-[#F0EEE8] overflow-hidden">
        {/* Zone markers */}
        <div className="absolute inset-0 flex">
          <div style={{ width: `${fairFill}%` }} className="bg-[#FEE2E2]" />
          <div style={{ width: `${attractiveFill - fairFill}%` }} className="bg-[#FEF9C3]" />
          <div className="flex-1 bg-[#EEF4FF]" />
        </div>
        {/* Fill bar */}
        <div
          className={`absolute top-0 left-0 h-full rounded-full transition-all ${
            upsidePct >= attractive ? 'bg-[#1f6feb]' : upsidePct >= fairValue ? 'bg-[#9a6700]' : 'bg-[#cf222e]'
          }`}
          style={{ width: `${fillPct}%` }}
        />
        {/* Center tick (=fair value) */}
        <div className="absolute top-0 h-full w-0.5 bg-[#6B6A72] opacity-40" style={{ left: '50%' }} />
      </div>
      <div className="flex justify-between text-[10px] text-[#6B6A72] mt-1">
        <span>−100%</span>
        <span className={`font-semibold ${zone.color}`}>
          {sign(upsidePct)}{pct(upsidePct)} · {zone.label}
        </span>
        <span>+100%</span>
      </div>
    </div>
  )
}

// ─── Model pill ───────────────────────────────────────────────────────────────
function ModelPill({ label, value, upsidePct, weight, applicable }: {
  label: string; value: number | null; upsidePct: number | null; weight: number; applicable: boolean
}) {
  if (!applicable) {
    return (
      <div className="rounded-lg border border-[#E8E6E0] bg-[#F7F6F1] px-3 py-2.5">
        <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider mb-1">{label}</p>
        <p className="text-sm text-[#6B6A72] italic">N/A</p>
      </div>
    )
  }
  const z = upsideZone(upsidePct)
  return (
    <div className={`rounded-lg border ${z.border || 'border-[#E8E6E0]'} ${z.bg || 'bg-white'} px-3 py-2.5`}>
      <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider mb-0.5">{label}</p>
      <p className={`text-base font-bold font-mono ${z.color}`}>{money(value)}</p>
      {upsidePct != null && (
        <p className={`text-[10px] font-semibold mt-0.5 ${z.color}`}>
          {sign(upsidePct)}{pct(upsidePct)} · {weight}% weight
        </p>
      )}
    </div>
  )
}

// ─── Sensitivity table ────────────────────────────────────────────────────────
function SensitivityTable({ baseWACC, baseCagr, scenarios }: {
  baseWACC: number | null;
  baseCagr: number | null;
  scenarios: { bull?: { fairValue?: number | null; wacc?: number; cagr?: number }; base?: { fairValue?: number | null }; bear?: { fairValue?: number | null; wacc?: number; cagr?: number } } | null;
}) {
  if (!scenarios?.base && !scenarios?.bull && !scenarios?.bear) return null
  const rows = [
    { label: 'Bear', data: scenarios?.bear, color: 'text-[#cf222e]', bg: 'bg-[#FEE2E2]' },
    { label: 'Base', data: scenarios?.base, color: 'text-[#9a6700]', bg: 'bg-[#FEF9C3]' },
    { label: 'Bull', data: scenarios?.bull, color: 'text-[#1f6feb]', bg: 'bg-[#EEF4FF]' },
  ] as const
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm border-collapse">
        <thead>
          <tr className="text-[10px] text-[#6B6A72] uppercase tracking-wider">
            <th className="text-left py-2 pr-4 font-medium">Scenario</th>
            <th className="text-right py-2 pr-4 font-medium">WACC</th>
            <th className="text-right py-2 pr-4 font-medium">CAGR</th>
            <th className="text-right py-2 font-medium">Fair Value</th>
          </tr>
        </thead>
        <tbody>
          {rows.map(r => {
            const fv = (r.data as any)?.fairValue ?? null
            const w = (r.data as any)?.wacc ?? baseWACC
            const c = (r.data as any)?.cagr ?? baseCagr
            return (
              <tr key={r.label} className="border-t border-[#E8E6E0]">
                <td className="py-2 pr-4">
                  <span className={`inline-block px-2 py-0.5 rounded text-[10px] font-semibold ${r.bg} ${r.color}`}>{r.label}</span>
                </td>
                <td className={`text-right py-2 pr-4 font-mono text-sm ${r.color}`}>{pct(w)}</td>
                <td className={`text-right py-2 pr-4 font-mono text-sm ${r.color}`}>{pct(c)}</td>
                <td className={`text-right py-2 font-mono font-bold text-sm ${r.color}`}>{money(fv)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

// ─── Assumption row ───────────────────────────────────────────────────────────
function AssumptionRow({ label, value, source, warning }: { label: string; value: string; source?: string; warning?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2 border-b border-[#F0EEE8] last:border-0">
      <div className="flex-1">
        <p className={`text-sm ${warning ? 'text-[#9a6700] font-medium' : 'text-[#2D2C31]'}`}>{label}</p>
        {source && <p className="text-[10px] text-[#6B6A72] mt-0.5">{source}</p>}
      </div>
      <p className={`text-sm font-mono font-semibold ${warning ? 'text-[#9a6700]' : 'text-[#2D2C31]'}`}>{value}</p>
    </div>
  )
}

// ─── Warning banner ───────────────────────────────────────────────────────────
function WarningBanner({ message }: { message: string }) {
  return (
    <div className="rounded-lg border border-[#FDE68A] bg-[#FEF9C3] px-4 py-3 flex gap-2 items-start">
      <span className="text-[#9a6700] text-sm mt-0.5">⚠</span>
      <p className="text-sm text-[#9a6700]">{message}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────
export default function ValuationTab({
  companyName, data, answers, notes, autoMap, onChange, onNoteChange,
}: ValuationTabProps) {
  const phase = PHASES[4]
  const valQs = phase.questions.filter(q => VAL_QUESTION_IDS.includes(q.id))
  const valRaw = valQs.length ? valQs.reduce((sum, q) => {
    const a = answers[q.id]
    return sum + (a === 'yes' ? 1 : a === 'partial' ? 0.5 : 0)
  }, 0) / valQs.length : 0
  const score = 1 + valRaw * 4

  // ── Extract data fields ────────────────────────────────────────────────────
  const d = data as any

  // Core valuation
  const currentPrice: number | null  = d.quote?.price ?? null
  const upsidePctFCFF: number | null = d.fairValue?.upsidePct ?? null
  const fairValueFCFF: number | null = d.fairValue?.fairValuePerShare ?? null
  const evM: number | null           = d.fairValue?.ev ?? null
  const cashM: number | null         = d.fairValue?.cash ?? null
  const debtM: number | null         = d.fairValue?.debt ?? null
  const equityValueM: number | null  = d.fairValue?.equityValue ?? null
  const marketCapM: number | null    = d.quote?.marketCap != null ? d.quote.marketCap / 1e6 : null

  // WACC inputs
  const wacc: number | null          = d.wacc?.wacc ?? null
  const ke: number | null            = d.wacc?.costOfEquity ?? null
  const kd: number | null            = d.wacc?.afterTaxCostOfDebt ?? null
  const rfRate: number | null        = d.wacc?.inputs?.rfRate ?? null
  const beta: number | null          = d.wacc?.inputs?.beta ?? null
  const erp: number | null           = d.wacc?.inputs?.erp ?? VALUATION_CONFIG.erp
  const taxRate: number | null       = d.wacc?.inputs?.taxRate ?? null
  const debtToEquity: number | null  = d.wacc?.inputs?.debtToEquity ?? null

  // Scenarios
  const bull = d.scenarios?.bull ?? null
  const base = d.scenarios?.base ?? null
  const bear = d.scenarios?.bear ?? null
  const scenarios = (bull || base || bear) ? { bull, base, bear } : null
  const cagr: number | null = d.cagrAnalysis?.blended ?? null

  // Multi-model triangulation
  const vm = d.valuationMethods ?? null
  const triangulatedFV: number | null  = vm?.triangulatedFairValue ?? null
  const triangulatedUpside: number | null = vm?.triangulatedUpsidePct ?? null
  const weights = vm?.effectiveWeights ?? null
  const companyType: string            = vm?.companyType ?? 'standard'
  const primaryModelLabel: string      = vm?.primaryModelLabel ?? 'DCF (FCFF)'
  const modelRationale: string         = vm?.rationale ?? ''

  // Individual model values
  const fcffFV: number | null    = vm?.models?.fcff?.fairValue ?? fairValueFCFF
  const fcfeModel              = vm?.models?.fcfe
  const ddmModel               = vm?.models?.ddm
  const multModel              = vm?.models?.multiples
  const fcfeApplicable: boolean  = fcfeModel?.applicable ?? false
  const ddmApplicable: boolean   = ddmModel?.applicable ?? false
  const multApplicable: boolean  = multModel?.blendedFairValue != null

  // Relative multiples
  const peRatio: number | null        = d.quote?.peRatio ?? d.quote?.trailingPE ?? null
  const evEbitda: number | null       = d.businessProfile?.evToEbitda ?? null
  const valRating: number | null      = data.ratings?.valuation?.score ?? null

  // Terminal growth
  const terminalG: number | null = (() => {
    if (!cagr || !wacc) return null
    const cfg = VALUATION_CONFIG.terminalGrowth
    const g = cagr > 0.15 ? cfg.highGrowth : cagr > 0.05 ? cfg.standard : cfg.mature
    return Math.min(g, wacc - cfg.waccBuffer)
  })()

  // Validation warnings
  const warnings: string[] = []
  if (wacc != null && terminalG != null && terminalG >= wacc) {
    warnings.push(`Terminal growth rate (${pct(terminalG)}) >= WACC (${pct(wacc)}). This would produce an infinite value. Source: ssrn-1025424 Error I.6.1.`)
  }
  if (debtToEquity != null && debtToEquity > 3) {
    warnings.push(`High D/E ratio (${debtToEquity.toFixed(1)}x). Verify that deposit liabilities are not included as financial debt.`)
  }
  if (companyType === 'financial') {
    warnings.push(`${companyName} is a financial company. FCFF DCF is not reliable for banks/fintechs. FCFE is the primary model. Source: ssrn-743229 §3.4.`)
  }

  // Primary upside (triangulated preferred)
  const primaryFV = triangulatedFV ?? fcffFV
  const primaryUpside = triangulatedUpside ?? upsidePctFCFF
  const zone = upsideZone(primaryUpside)

  const summary = buildValuationSummary(companyName, data)

  return (
    <div className="flex flex-col gap-6">

      {/* ── Card 1: Section header ───────────────────────────────────────────── */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5 flex items-center gap-5">
        <ScoreCircle score={score} size="lg" />
        <div className="flex-1">
          <p className="text-xs font-semibold text-[#6B6A72] uppercase tracking-wider mb-0.5">Phase 5 · Part B</p>
          <h2 className="text-lg font-bold text-[#2D2C31]">Valuation</h2>
          <p className="text-sm text-[#6B6A72] mt-0.5">
            {primaryModelLabel} · {companyType.charAt(0).toUpperCase() + companyType.slice(1)} company
          </p>
        </div>
        <div className="hidden sm:flex flex-col items-end gap-1">
          <p className="text-[10px] text-[#6B6A72] uppercase tracking-wider">
            {triangulatedFV != null ? 'Triangulated' : 'DCF'} Fair Value
          </p>
          <p className={`text-2xl font-bold font-mono ${zone.color}`}>
            {primaryFV != null ? money(primaryFV) : '—'}
          </p>
          {primaryUpside != null && (
            <p className={`text-[11px] font-semibold ${zone.color}`}>
              {sign(primaryUpside)}{pct(primaryUpside)} · {zone.label}
            </p>
          )}
        </div>
      </div>

      {/* ── Validation warnings ──────────────────────────────────────────────── */}
      {warnings.length > 0 && (
        <div className="flex flex-col gap-2">
          {warnings.map((w, i) => <WarningBanner key={i} message={w} />)}
        </div>
      )}

      {/* ── Card 2: Upside meter + model rationale ───────────────────────────── */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
        <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">Upside / Downside Meter</p>
        <UpsideMeter upsidePct={primaryUpside} />
        {modelRationale && (
          <p className="text-xs text-[#6B6A72] mt-3 leading-relaxed border-t border-[#F0EEE8] pt-3">
            <span className="font-semibold text-[#2D2C31]">Model selection: </span>
            {modelRationale}
          </p>
        )}
      </div>

      {/* ── Card 3: Multi-model comparison ──────────────────────────────────── */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
        <div className="flex items-center justify-between mb-3">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider">Model Comparison</p>
          {triangulatedFV != null && (
            <div className={`rounded-full px-3 py-0.5 text-[11px] font-bold ${zone.bg} ${zone.color} ${zone.border} border`}>
              Triangulated: {money(triangulatedFV)}
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          <ModelPill
            label="FCFF / WACC"
            value={fcffFV}
            upsidePct={fcffFV != null && currentPrice != null ? (fcffFV - currentPrice) / currentPrice : null}
            weight={weights?.fcff ?? 65}
            applicable={companyType !== 'financial'}
          />
          <ModelPill
            label="FCFE (Equity)"
            value={fcfeApplicable ? fcfeModel?.fairValue ?? null : null}
            upsidePct={fcfeApplicable && fcfeModel?.upsidePct != null ? fcfeModel.upsidePct : null}
            weight={weights?.fcfe ?? 0}
            applicable={fcfeApplicable}
          />
          <ModelPill
            label="DDM"
            value={ddmApplicable ? ddmModel?.fairValue ?? null : null}
            upsidePct={ddmApplicable && ddmModel?.upsidePct != null ? ddmModel.upsidePct : null}
            weight={weights?.ddm ?? 0}
            applicable={ddmApplicable}
          />
          <ModelPill
            label="Multiples"
            value={multApplicable ? multModel?.blendedFairValue ?? null : null}
            upsidePct={multApplicable && multModel?.blendedFairValue != null && currentPrice != null
              ? (multModel.blendedFairValue - currentPrice) / currentPrice : null}
            weight={weights?.multiples ?? 35}
            applicable={multApplicable}
          />
        </div>
      </div>

      {/* ── Card 4: Scenario table ───────────────────────────────────────────── */}
      {scenarios && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">DCF Scenario Analysis</p>
          <SensitivityTable baseWACC={wacc} baseCagr={cagr} scenarios={scenarios} />
          <p className="text-[10px] text-[#6B6A72] mt-3">
            Bull/Bear cases apply ±1% WACC, ±2% CAGR, ±0.5% terminal growth. Source: calculateFairValue.ts buildScenarios().
          </p>
        </div>
      )}

      {/* ── Card 5: WACC + DCF assumptions ──────────────────────────────────── */}
      <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
        <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-2">DCF Assumptions</p>
        <p className="text-[10px] text-[#6B6A72] mb-3">
          Source: FRED 10Y Treasury (RF), regression beta, Damodaran ERP (Jan 2025). Source: research/assumption_hierarchy.json
        </p>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8">
          <div>
            <AssumptionRow label="Risk-Free Rate (RF)" value={pct(rfRate)} source="FRED 10Y Treasury" />
            <AssumptionRow label="Beta (levered, regression)" value={num(beta, 2)} source="5Y weekly return regression" />
            <AssumptionRow label="Equity Risk Premium" value={pct(erp)} source="Damodaran Jan 2025" />
            <AssumptionRow label="Cost of Equity (Ke = RF + β×ERP)" value={pct(ke)} />
            <AssumptionRow label="After-Tax Cost of Debt (Kd×(1−T))" value={pct(kd)} />
          </div>
          <div>
            <AssumptionRow label="WACC" value={pct(wacc)} source="ssrn-1620871 eq[4],[5]" warning={wacc != null && wacc < 0.05} />
            <AssumptionRow label="Tax Rate" value={pct(taxRate)} source="Effective rate from income stmt" />
            <AssumptionRow label="Growth CAGR (blended)" value={pct(cagr)} source="3Y historical + analyst estimate" />
            <AssumptionRow label="Terminal Growth" value={pct(terminalG)} source="GDP-based ceiling: WACC − 0.5%" warning={terminalG != null && wacc != null && terminalG > wacc - 0.005} />
            <AssumptionRow label="D/E Ratio" value={debtToEquity != null ? `${debtToEquity.toFixed(2)}x` : '—'} />
          </div>
        </div>
      </div>

      {/* ── Card 6: EV bridge ────────────────────────────────────────────────── */}
      {(evM != null || cashM != null || debtM != null || equityValueM != null) && (
        <div className="rounded-xl border border-[#E8E6E0] bg-white p-5">
          <p className="text-[11px] font-semibold text-[#6B6A72] uppercase tracking-wider mb-3">EV → Equity Bridge</p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Enterprise Value',   value: moneyM(evM),          note: 'PV of FCF + terminal' },
              { label: '+ Cash & Equiv',     value: moneyM(cashM),        note: 'Balance sheet cash' },
              { label: '− Total Debt',       value: cashM != null && debtM != null ? `(${moneyM(debtM)})` : '—', note: 'Financial debt' },
              { label: '= Equity Value',     value: moneyM(equityValueM), note: 'EV + Cash − Debt' },
            ].map(m => (
              <div key={m.label} className="rounded-lg border border-[#E8E6E0] bg-[#F7F6F1] px-3 py-2.5">
                <p className="text-[10px] text-[#6B6A72] mb-0.5">{m.label}</p>
                <p className="text-sm font-bold font-mono text-[#2D2C31]">{m.value}</p>
                <p className="text-[10px] text-[#6B6A72] mt-0.5">{m.note}</p>
              </div>
            ))}
          </div>
          <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-3">
            {[
              { label: 'Current Price',    value: money(currentPrice) },
              { label: 'Fair Value (DCF)', value: money(fcffFV) },
              { label: 'P/E Ratio',        value: peRatio != null ? `${num(peRatio)}x` : '—' },
              { label: 'Valuation Rating', value: valRating != null ? `${num(valRating)}/5` : '—' },
              { label: 'Market Cap',       value: moneyM(marketCapM) },
              { label: 'EV/EBITDA',        value: evEbitda != null ? `${num(evEbitda)}x` : '—' },
            ].map(m => (
              <div key={m.label} className="rounded-xl border border-[#E8E6E0] bg-white px-4 py-3">
                <p className="text-[11px] text-[#6B6A72] uppercase tracking-wider mb-1">{m.label}</p>
                <p className="text-base font-semibold font-mono text-[#2D2C31]">{m.value}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Card 7: AI summary + questions ──────────────────────────────────── */}
      <SectionSummary text={summary} label="Valuation Analysis" />

      <div className="flex flex-col gap-3">
        {valQs.map(q => (
          <QuestionCircle
            key={q.id}
            questionId={q.id}
            text={q.text}
            answer={answers[q.id] ?? null}
            hint={autoMap[q.id] ?? null}
            note={notes[q.id] ?? ''}
            onChange={onChange}
            onNoteChange={onNoteChange}
          />
        ))}
      </div>
    </div>
  )
}
