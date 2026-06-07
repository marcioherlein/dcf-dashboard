'use client'

// ─── Shared valuation types ───────────────────────────────────────────────────
// Exported from here so ValuationModelDrawer, deriveAssumptions, and ValuationLab
// can all import from a single source of truth.

export type ValuationMethodId =
  | 'forward_pe'
  | 'revenue_multiple'
  | 'ev_ebitda'
  | 'reverse_dcf'
  | 'scenario_blend'
  | 'core_dcf'

export type AssumptionSource =
  | 'analyst_estimate'
  | 'historical_3y_median'
  | 'historical_5y_median'
  | 'peer_median'
  | 'sector_fallback'
  | 'manual_override'
  | 'model_default'

export type ValuationAssumption = {
  key: string
  label: string
  description?: string
  value: number | null
  unit: '%' | 'x' | '$' | 'shares' | 'number'
  min?: number
  max?: number
  step?: number
  editable: boolean
  source: AssumptionSource
  sourceExplanation?: string
  benchmarks?: Array<{ label: string; value: number }>
}

export type EvidenceItem = {
  label: string
  text: string
  rowKey?: string                                          // key in YahooFinancials row defs
  statement?: 'income' | 'balance' | 'cashflow'           // which statement tab to open
}

export type ValuationResult = {
  label: string
  value: number | null
  formattedValue: string
  tone?: 'positive' | 'negative' | 'neutral' | 'warning'
}

export type ValuationMethodConfig = {
  id: ValuationMethodId
  title: string
  subtitle: string
  methodDescription?: string
  companyName: string
  ticker: string
  currency: string
  evidence: EvidenceItem[]
  assumptions: ValuationAssumption[]
  formulaLines: string[]       // static template lines; updated externally
  results: ValuationResult[]
  warnings: string[]
  // Computed fair value summary (shown on method card)
  fairValueSummary?: number | null
  currentPrice?: number
}

// ─── Source badge label ───────────────────────────────────────────────────────

export function sourceLabel(source: AssumptionSource): string {
  switch (source) {
    case 'analyst_estimate':    return 'Analyst'
    case 'historical_3y_median': return '3Y Median'
    case 'historical_5y_median': return '5Y Median'
    case 'peer_median':          return 'Peer'
    case 'sector_fallback':      return 'Sector'
    case 'manual_override':      return 'Override'
    case 'model_default':        return 'Model'
  }
}

export function sourceBadgeColor(source: AssumptionSource): string {
  switch (source) {
    case 'analyst_estimate':    return 'bg-blue-900/50 text-[#93B4F5]'
    case 'historical_3y_median':
    case 'historical_5y_median': return 'bg-slate-700 text-[#8A95A6]'
    case 'peer_median':          return 'bg-purple-900/50 text-purple-300'
    case 'sector_fallback':      return 'bg-amber-900/50 text-amber-300'
    case 'manual_override':      return 'bg-green-900/50 text-green-300'
    case 'model_default':        return 'bg-slate-700 text-[#8A95A6]'
  }
}

// ─── Assumption input row ─────────────────────────────────────────────────────

interface AssumptionInputRowProps {
  assumption: ValuationAssumption
  displayValue: string        // current displayed value (controlled by parent)
  onChange: (key: string, rawValue: string) => void
  isOverridden: boolean
}

function formatUnitSuffix(unit: ValuationAssumption['unit']): string {
  switch (unit) {
    case '%': return '%'
    case 'x': return '×'
    case '$': return ''
    default: return ''
  }
}

export function AssumptionInputRow({ assumption, displayValue, onChange, isOverridden }: AssumptionInputRowProps) {
  const { key, label, description, unit, min, max, step, editable, source, sourceExplanation } = assumption

  const suffix = formatUnitSuffix(unit)
  const badgeClass = isOverridden
    ? 'bg-green-900/50 text-green-300'
    : sourceBadgeColor(source)
  const badgeText = isOverridden ? 'Override' : sourceLabel(source)

  return (
    <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-2 sm:gap-3 py-1.5">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="text-[12px] font-medium text-[#c8c8c8]">{label}</span>
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full uppercase tracking-wider ${badgeClass}`}>
            {badgeText}
          </span>
        </div>
        {description && (
          <div className="text-[10px] text-[#666] mt-0.5">{description}</div>
        )}
        {sourceExplanation && !isOverridden && (
          <div className="text-[10px] text-[#555] mt-0.5 italic leading-relaxed">{sourceExplanation}</div>
        )}
      </div>
      {editable ? (
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            value={displayValue}
            onChange={e => onChange(key, e.target.value)}
            step={String(step ?? 0.1)}
            min={unit === '%' ? String((min ?? -100) * 100) : String(min ?? undefined)}
            max={unit === '%' ? String((max ?? 100) * 100) : String(max ?? undefined)}
            className="w-20 text-right border border-[#333] rounded-md px-2 py-0.5 text-[12px] font-mono focus:outline-none focus:border-[#4a9eff] bg-[#1a1a1a] text-[#e2e2e2]"
            style={{ fontSize: '16px' }}
          />
          {suffix && <span className="text-[#666] text-[11px]">{suffix}</span>}
        </div>
      ) : (
        <span className="text-[12px] font-mono text-[#888] shrink-0">
          {displayValue}{suffix}
        </span>
      )}
    </div>
  )
}

// ─── Evidence derivation block ────────────────────────────────────────────────

export function EvidenceDerivationBlock({ items }: { items: EvidenceItem[] }) {
  if (items.length === 0) return null
  return (
    <div>
      <div className="text-[11px] font-bold text-[#555] uppercase tracking-widest mb-2">
        Past Evidence &amp; Derivation
      </div>
      <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl px-4 py-3 space-y-2">
        {items.map(({ label, text }) => (
          <div key={label} className="flex flex-col sm:flex-row gap-1 sm:gap-2">
            <span className="text-[#555] sm:w-28 sm:shrink-0 text-[11px] font-medium">{label}</span>
            <span className="text-[#888] text-[11px] leading-relaxed">{text}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Formula block ────────────────────────────────────────────────────────────

export function FormulaBlock({ lines }: { lines: string[] }) {
  if (lines.length === 0) return null
  return (
    <div className="bg-[#0d0d0d] border border-[#1e1e1e] rounded-xl px-4 py-3">
      <div className="text-[11px] font-bold text-[#555] uppercase tracking-widest mb-2">Formula</div>
      <div className="text-[11px] font-mono text-[#888] leading-relaxed">
        {lines.map((line, i) => (
          <div key={i}>{line}</div>
        ))}
      </div>
    </div>
  )
}

// ─── Results block ────────────────────────────────────────────────────────────

function toneClass(tone: ValuationResult['tone']): string {
  switch (tone) {
    case 'positive': return 'text-emerald-400'
    case 'negative': return 'text-red-400'
    case 'warning':  return 'text-amber-400'
    default:         return 'text-[#e2e2e2]'
  }
}

export function ValuationResultsBlock({ results, warnings }: { results: ValuationResult[]; warnings: string[] }) {
  if (results.length === 0) return null
  return (
    <div>
      <div className="text-[11px] font-bold text-[#555] uppercase tracking-widest mb-2">Results</div>
      {warnings.length > 0 && (
        <div className="mb-3 space-y-1">
          {warnings.map((w, i) => (
            <div key={i} className="bg-amber-900/20 border border-amber-800/40 rounded-lg px-3 py-2 text-[11px] text-amber-300">
              ⚠ {w}
            </div>
          ))}
        </div>
      )}
      <div className="space-y-1.5">
        {results.map((r, i) => (
          <div key={i} className={`flex items-center justify-between ${i >= results.length - 3 ? 'border-t border-[#1e1e1e] pt-1.5 mt-1.5' : ''}`}>
            <span className="text-[#555] font-medium uppercase text-[11px] tracking-wide">{r.label}</span>
            <span className={`font-bold text-[14px] ${toneClass(r.tone)}`}>{r.formattedValue}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Main ValuationModelDrawer ────────────────────────────────────────────────

interface ValuationModelDrawerProps {
  config: ValuationMethodConfig
  onClose: () => void
  // Callback when user changes an assumption value (key → parsed number)
  onAssumptionChange?: (key: string, value: number) => void
  // Current overrides keyed by assumption.key
  overrides?: Record<string, number>
  onResetOverrides?: () => void
}

function fmtAssumptionDisplay(assumption: ValuationAssumption, overrides: Record<string, number>): string {
  const raw = assumption.key in overrides ? overrides[assumption.key] : assumption.value
  if (raw == null) return '—'
  if (assumption.unit === '%') return (raw * 100).toFixed(1)
  if (assumption.unit === 'x') return raw.toFixed(1)
  if (assumption.unit === '$') {
    const abs = Math.abs(raw)
    const sign = raw < 0 ? '-' : ''
    if (abs >= 1e12) return sign + '$' + (abs / 1e12).toFixed(2) + 'T'
    if (abs >= 1e9)  return sign + '$' + (abs / 1e9).toFixed(1) + 'B'
    if (abs >= 1e6)  return sign + '$' + (abs / 1e6).toFixed(0) + 'M'
    return sign + '$' + abs.toFixed(0)
  }
  if (assumption.unit === 'shares') {
    if (Math.abs(raw) >= 1e9) return (raw / 1e9).toFixed(3) + 'B'
    if (Math.abs(raw) >= 1e6) return (raw / 1e6).toFixed(0) + 'M'
    return raw.toFixed(0)
  }
  return raw.toFixed(2)
}

export default function ValuationModelDrawer({
  config, onClose, onAssumptionChange, overrides = {}, onResetOverrides,
}: ValuationModelDrawerProps) {
  const isModified = Object.keys(overrides).length > 0

  function handleInputChange(key: string, rawStr: string) {
    if (!onAssumptionChange) return
    const assumption = config.assumptions.find(a => a.key === key)
    if (!assumption) return
    const parsed = parseFloat(rawStr)
    if (isNaN(parsed)) return
    // Convert % display (user types "15") back to decimal (0.15)
    const value = assumption.unit === '%' ? parsed / 100 : parsed
    onAssumptionChange(key, value)
  }

  return (
    <div
      className="fixed inset-0 bg-black/60 z-50 flex justify-end items-end sm:items-stretch"
      onClick={onClose}
    >
      <div
        className="bg-[#111111] w-full sm:max-w-lg h-[90vh] sm:h-full overflow-y-auto shadow-2xl border-t sm:border-t-0 sm:border-l border-[#222] rounded-t-2xl sm:rounded-none pb-safe"
        onClick={e => e.stopPropagation()}
      >
        {/* Sticky header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#222] sticky top-0 bg-[#111111] z-10">
          <div>
            <span className="font-bold text-[#e2e2e2] font-mono text-lg">{config.ticker}</span>
            <span className="text-[#666] text-sm ml-2">{config.companyName}</span>
          </div>
          <div className="flex items-center gap-3">
            <div className="text-right">
              <div className="text-[11px] font-bold text-[#555] uppercase tracking-widest">{config.title}</div>
              <div className="text-[10px] text-[#444]">{config.subtitle}</div>
            </div>
            <button
              onClick={onClose}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center text-[#666] hover:text-[#e2e2e2] text-2xl leading-none ml-2"
            >
              ×
            </button>
          </div>
        </div>

        <div className="px-5 py-4 space-y-5 text-[13px] pb-8">

          {/* Currency note */}
          {config.currency !== 'USD' && (
            <div className="bg-amber-900/20 border border-amber-800/40 rounded-xl px-4 py-3 text-[12px]">
              <div className="text-amber-400 font-semibold mb-0.5">⚠ Currency</div>
              <div className="text-amber-300">Financial data in {config.currency}. Values shown in reporting currency.</div>
            </div>
          )}

          {/* Evidence */}
          <EvidenceDerivationBlock items={config.evidence} />

          {/* Assumptions */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div className="text-[11px] font-bold text-[#555] uppercase tracking-widest">
                Assumptions
                {isModified && <span className="text-[#4a9eff] normal-case ml-1">(modified)</span>}
              </div>
              {isModified && onResetOverrides && (
                <button
                  onClick={onResetOverrides}
                  className="text-[11px] text-[#4a9eff] hover:text-[#93B4F5] underline"
                >
                  Reset to model
                </button>
              )}
            </div>
            <div className="divide-y divide-[#1e1e1e]">
              {config.assumptions.map(a => (
                <AssumptionInputRow
                  key={a.key}
                  assumption={a}
                  displayValue={fmtAssumptionDisplay(a, overrides)}
                  onChange={handleInputChange}
                  isOverridden={a.key in overrides}
                />
              ))}
            </div>
          </div>

          {/* Formula */}
          <FormulaBlock lines={config.formulaLines} />

          {/* Results */}
          <ValuationResultsBlock results={config.results} warnings={config.warnings} />

          <p className="text-[10px] text-[#333] pt-1 border-t border-[#1e1e1e]">
            Modify any assumption above and results update live.
            Not investment advice. All projections are estimates.
          </p>
        </div>
      </div>
    </div>
  )
}
