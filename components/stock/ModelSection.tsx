'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import AssumptionSlider from '@/components/stock/AssumptionSlider'
import { buildModelSensitivity } from '@/lib/simplifier/summaryBuilder'

interface CAGRAnalysis {
  blended: number
  historicalCagr3y: number
  analystEstimate1y: number
}

interface Props {
  baseCagr: number
  baseWacc: number
  baseTerminalG: number
  baseFairValue: number
  currentPrice: number
  currency: string
  cagrAnalysis: CAGRAnalysis
  // Raw DCF inputs needed for server-side recalc
  baseFCF: number
  cashM: number
  debtM: number
  sharesM: number
  growthModel: 'two-stage' | 'three-stage'
  onModelChange?: (overrides: { cagr: number | null; wacc: number | null; terminalG: number | null }) => void
}

interface RecalcResult {
  fairValue: number
  upsidePct: number
}

export default function ModelSection({
  baseCagr, baseWacc, baseTerminalG, baseFairValue, currentPrice, currency,
  cagrAnalysis, baseFCF, cashM, debtM, sharesM, growthModel, onModelChange,
}: Props) {
  // Slider values in percentage points (12.4 = 12.4%)
  const [cagrPct,     setCagrPct]     = useState(+(baseCagr * 100).toFixed(1))
  const [waccPct,     setWaccPct]     = useState(+(baseWacc * 100).toFixed(1))
  const [terminalGPct, setTerminalGPct] = useState(+(baseTerminalG * 100).toFixed(1))

  const [liveResult,   setLiveResult]   = useState<RecalcResult | null>(null)
  const [recalcLoading, setRecalcLoading] = useState(false)

  const debounceRef = useRef<ReturnType<typeof setTimeout>>()

  const isAnyOverridden = (
    Math.abs(cagrPct - baseCagr * 100) > 0.05 ||
    Math.abs(waccPct - baseWacc * 100) > 0.05 ||
    Math.abs(terminalGPct - baseTerminalG * 100) > 0.05
  )

  const fetchRecalc = useCallback(async (cagr: number, wacc: number, tg: number) => {
    setRecalcLoading(true)
    try {
      const params = new URLSearchParams({
        baseFCF:      String(baseFCF),
        cagr:         String(baseCagr),
        wacc:         String(baseWacc),
        terminalG:    String(baseTerminalG),
        growthModel,
        cashM:        String(cashM),
        debtM:        String(debtM),
        sharesM:      String(sharesM),
        currentPrice: String(currentPrice),
        cagrOverride: String(cagr),
        waccOverride: String(wacc),
        terminalGOverride: String(tg),
      })
      const res = await fetch(`/api/recalculate?${params}`)
      if (res.ok) {
        const json = await res.json()
        setLiveResult({ fairValue: json.fairValue, upsidePct: json.upsidePct })
        onModelChange?.({
          cagr:     Math.abs(cagr - baseCagr * 100) > 0.05 ? cagr / 100 : null,
          wacc:     Math.abs(wacc - baseWacc * 100) > 0.05 ? wacc / 100 : null,
          terminalG: Math.abs(tg - baseTerminalG * 100) > 0.05 ? tg / 100 : null,
        })
      }
    } catch { /* ignore */ } finally {
      setRecalcLoading(false)
    }
  }, [baseFCF, baseCagr, baseWacc, baseTerminalG, growthModel, cashM, debtM, sharesM, currentPrice, onModelChange])

  useEffect(() => {
    clearTimeout(debounceRef.current)
    if (!isAnyOverridden) { setLiveResult(null); return }
    debounceRef.current = setTimeout(() => {
      fetchRecalc(cagrPct, waccPct, terminalGPct)
    }, 400)
    return () => clearTimeout(debounceRef.current)
  }, [cagrPct, waccPct, terminalGPct, isAnyOverridden, fetchRecalc])

  const displayFV = liveResult?.fairValue ?? baseFairValue
  const displayUpside = liveResult?.upsidePct ?? ((baseFairValue - currentPrice) / currentPrice)

  const upColor  = displayUpside >= 0.05 ? 'text-green-600' : 'text-red-600'
  const upSign   = displayUpside >= 0 ? '+' : ''
  const upBg     = displayUpside >= 0.05 ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'

  const sensitivityNote = buildModelSensitivity({
    baseFairValue,
    cagrBlended: baseCagr,
    wacc: baseWacc,
    terminalG: baseTerminalG,
  })

  const resetAll = () => {
    setCagrPct(+(baseCagr * 100).toFixed(1))
    setWaccPct(+(baseWacc * 100).toFixed(1))
    setTerminalGPct(+(baseTerminalG * 100).toFixed(1))
    setLiveResult(null)
    onModelChange?.({ cagr: null, wacc: null, terminalG: null })
  }

  return (
    <div className="rounded-2xl bg-white border border-slate-200 shadow-card p-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h2 className="text-base font-semibold text-slate-900">Model the Assumptions</h2>
          <p className="text-xs text-slate-400 mt-0.5">Adjust key inputs to see how fair value responds.</p>
        </div>
        {isAnyOverridden && (
          <button
            onClick={resetAll}
            className="text-xs text-slate-500 hover:text-slate-800 border border-slate-200 hover:border-slate-300 rounded-lg px-3 py-1.5 transition-colors"
          >
            Reset all
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

        {/* Sliders */}
        <div className="space-y-7">
          <AssumptionSlider
            label="Revenue Growth (CAGR)"
            description="Expected annual revenue growth rate over 10 years"
            value={cagrPct}
            min={0}
            max={50}
            step={0.5}
            unit="%"
            defaultValue={+(baseCagr * 100).toFixed(1)}
            markers={[
              { value: +(cagrAnalysis.historicalCagr3y * 100).toFixed(1), label: `Historical ${(cagrAnalysis.historicalCagr3y * 100).toFixed(0)}%` },
              { value: +(cagrAnalysis.analystEstimate1y * 100).toFixed(1), label: `Analyst ${(cagrAnalysis.analystEstimate1y * 100).toFixed(0)}%` },
            ]}
            onChange={setCagrPct}
          />
          <AssumptionSlider
            label="Discount Rate (WACC)"
            description="Weighted average cost of capital — higher = lower fair value"
            value={waccPct}
            min={4}
            max={20}
            step={0.1}
            unit="%"
            defaultValue={+(baseWacc * 100).toFixed(1)}
            markers={[
              { value: +(baseWacc * 100).toFixed(1), label: `Model ${(baseWacc * 100).toFixed(1)}%` },
            ]}
            onChange={setWaccPct}
          />
          <AssumptionSlider
            label="Terminal Growth Rate"
            description="Growth assumed in perpetuity — typically near GDP growth"
            value={terminalGPct}
            min={0}
            max={4}
            step={0.1}
            unit="%"
            defaultValue={+(baseTerminalG * 100).toFixed(1)}
            markers={[
              { value: 2.0, label: 'GDP ~2%' },
            ]}
            onChange={setTerminalGPct}
          />
        </div>

        {/* Live result */}
        <div className="flex flex-col gap-4">
          <div className={`rounded-xl border p-5 text-center transition-all ${isAnyOverridden ? upBg : 'bg-slate-50 border-slate-200'}`}>
            <p className="text-xs text-slate-400 uppercase tracking-wider mb-2">
              {isAnyOverridden ? 'Adjusted Fair Value' : 'Base Fair Value'}
            </p>
            <div className="flex items-center justify-center gap-2 mb-1">
              {recalcLoading ? (
                <div className="flex items-center gap-2">
                  <div className="h-5 w-5 animate-spin rounded-full border-2 border-slate-200 border-t-blue-500" />
                  <span className="text-2xl font-bold text-slate-400">{currency}{displayFV.toFixed(2)}</span>
                </div>
              ) : (
                <span className="text-3xl font-bold text-slate-900">{currency}{displayFV.toFixed(2)}</span>
              )}
            </div>
            <span className={`text-lg font-bold ${upColor}`}>
              {upSign}{(displayUpside * 100).toFixed(1)}% vs current price
            </span>
            {isAnyOverridden && (
              <p className="text-[11px] text-slate-400 mt-2">
                Base was {currency}{baseFairValue.toFixed(2)} — delta {displayFV >= baseFairValue ? '+' : ''}{(displayFV - baseFairValue).toFixed(2)}
              </p>
            )}
          </div>

          {/* Sensitivity note */}
          <div className="rounded-xl bg-amber-50 border border-amber-100 px-4 py-3">
            <p className="text-xs text-amber-700 leading-relaxed">{sensitivityNote}</p>
          </div>

          {/* Context note */}
          <p className="text-[11px] text-slate-400 leading-relaxed">
            These assumptions drive the 10-year DCF projection. The model uses a {growthModel === 'three-stage' ? 'three-stage fade' : 'two-stage'} growth structure.
            Changes here don&apos;t affect the saved valuation or quality scores above.
          </p>
        </div>
      </div>
    </div>
  )
}
