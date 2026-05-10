'use client'
import { useState, useMemo } from 'react'
import { fmt, fmtPct } from '@/lib/utils'

// ── Types ──────────────────────────────────────────────────────────────────────

type IncomeRow = {
  year: string; revenue: number | null; grossProfit: number | null
  operatingIncome: number | null; ebitda: number | null
  netIncome: number | null; eps: number | null; isProjected: boolean
}
type BSRow = {
  year: string; cash: number | null; totalCurrentAssets: number | null
  totalAssets: number | null; longTermDebt: number | null
  totalCurrentLiabilities: number | null; totalEquity: number | null; isProjected: boolean
}
type CFRow = {
  year: string; operatingCF: number | null; capex: number | null
  freeCashFlow: number | null; investingCF: number | null
  financingCF: number | null; dividendsPaid: number | null; isProjected: boolean
}

interface Props {
  incomeStatement: IncomeRow[]
  balanceSheet: BSRow[]
  cashFlow: CFRow[]
  wacc: number
  taxRate: number
  cash: number
  debt: number
  sharesOutstanding: number
  currentPrice: number
  cagrAnalysis?: {
    numAnalysts: number
    confidenceLabel: 'High' | 'Medium' | 'Low'
    confidence: number
  }
  currency: string
  financialCurrencyNote?: string   // e.g. "TWD→USD @ 0.0319" — if set, FS values are in local currency
}

type Mode      = 'unlevered' | 'levered'
type Scale     = 'M' | 'B'

// ── Helpers ────────────────────────────────────────────────────────────────────

function ratio(a: number | null, b: number | null): number | null {
  if (a == null || b == null || b === 0) return null
  return a / b
}
function fmtDollars(v: number | null, scale: Scale): string {
  if (v == null || !isFinite(v)) return '—'
  if (scale === 'B') return fmt(v / 1000, 2) + 'B'
  return fmt(v, 0) + 'M'
}
function fmtPctSign(v: number | null): string {
  if (v == null || !isFinite(v)) return '—'
  return (v >= 0 ? '+' : '') + (v * 100).toFixed(1) + '%'
}
function fmtPctPlain(v: number | null): string {
  if (v == null || !isFinite(v)) return '—'
  return (v * 100).toFixed(1) + '%'
}

// ── Computed row type ──────────────────────────────────────────────────────────

type ComputedRow = {
  year: string
  isProjected: boolean
  revenue: number | null
  revenueGrowth: number | null
  ebit: number | null
  ebitMargin: number | null
  taxRateVal: number
  nopat: number | null
  nopatMargin: number | null
  da: number | null
  daRev: number | null
  capex: number | null             // negative (outflow)
  capexRev: number | null
  dnwc: number | null              // positive = NWC increased = cash use
  dnwcRev: number | null
  netDebtRepayment: number | null  // positive = net debt paid down
  netIncome: number | null
  netMargin: number | null
  ufcf: number | null
  ufcfGrowth: number | null
  pvUFCF: number | null
  lfcf: number | null
  lfcfGrowth: number | null
  pvLFCF: number | null
}

// ── Main component ─────────────────────────────────────────────────────────────

export default function FCFBuildUp({
  incomeStatement, balanceSheet, cashFlow,
  wacc: waccProp, taxRate, cash, debt, sharesOutstanding, currentPrice,
  cagrAnalysis, currency, financialCurrencyNote,
}: Props) {
  const [mode, setMode]           = useState<Mode>('unlevered')
  const [scale, setScale]         = useState<Scale>('M')
  const [tgrPerpetual, setTgr]    = useState(2.5)
  const [exitMultiple, setMult]   = useState(20)
  const [waccEdit, setWaccEdit]   = useState(+(waccProp * 100).toFixed(1))

  const wacc = waccEdit / 100

  // ── Merge and sort all years ────────────────────────────────────────────────
  const years = useMemo(() => {
    const seen: Record<string, true> = {}
    for (const r of [...incomeStatement, ...balanceSheet, ...cashFlow]) seen[r.year] = true
    return Object.keys(seen).sort((a, b) => parseInt(a) - parseInt(b))
  }, [incomeStatement, balanceSheet, cashFlow])

  const isMap = useMemo(() => Object.fromEntries(incomeStatement.map(r => [r.year, r])), [incomeStatement])
  const bsMap = useMemo(() => Object.fromEntries(balanceSheet.map(r => [r.year, r])), [balanceSheet])
  const cfMap = useMemo(() => Object.fromEntries(cashFlow.map(r => [r.year, r])), [cashFlow])

  // ── Compute all rows ────────────────────────────────────────────────────────
  const rows = useMemo<ComputedRow[]>(() => {
    // 1. NWC per year (operating NWC = current assets ex-cash minus current liabilities)
    const nwcByYear: Record<string, number | null> = {}
    for (const yr of years) {
      const bs = bsMap[yr]
      if (!bs) { nwcByYear[yr] = null; continue }
      const { totalCurrentAssets: ca, totalCurrentLiabilities: cl, cash: c } = bs
      nwcByYear[yr] = (ca != null && cl != null && c != null) ? (ca - c) - cl : null
    }

    // 2. Historical avg ΔNWC/ΔRevenue for projecting future NWC changes
    const histYrs = years.filter(yr => !(isMap[yr]?.isProjected ?? cfMap[yr]?.isProjected ?? false))
    const dnwcRevRatios: number[] = []
    for (let i = 1; i < histYrs.length; i++) {
      const yr = histYrs[i]; const prev = histYrs[i - 1]
      const nwcCurr = nwcByYear[yr]; const nwcPrev = nwcByYear[prev]
      const revCurr = isMap[yr]?.revenue; const revPrev = isMap[prev]?.revenue
      if (nwcCurr != null && nwcPrev != null && revCurr != null && revPrev != null) {
        const deltaRev = revCurr - revPrev
        if (Math.abs(deltaRev) > 0.1) dnwcRevRatios.push((nwcCurr - nwcPrev) / deltaRev)
      }
    }
    const avgDnwcRatio = dnwcRevRatios.length > 0
      ? dnwcRevRatios.reduce((a, b) => a + b, 0) / dnwcRevRatios.length
      : 0

    // 3. Build rows
    const result: ComputedRow[] = []
    const projYrs = years.filter(yr => isMap[yr]?.isProjected ?? cfMap[yr]?.isProjected ?? false)

    for (let i = 0; i < years.length; i++) {
      const yr = years[i]; const prevYr = years[i - 1]
      const is = isMap[yr]; const bs = bsMap[yr]; const cf = cfMap[yr]
      const isProjected = is?.isProjected ?? cf?.isProjected ?? false

      const revenue     = is?.revenue ?? null
      const prevRevenue = prevYr ? (isMap[prevYr]?.revenue ?? null) : null
      const revenueGrowth = revenue != null && prevRevenue != null && prevRevenue !== 0
        ? (revenue - prevRevenue) / Math.abs(prevRevenue) : null

      const ebit      = is?.operatingIncome ?? null
      const ebitMargin = ratio(ebit, revenue)

      // D&A derived from EBITDA − EBIT (both already in response)
      const daRaw = is?.ebitda != null && is?.operatingIncome != null
        ? is.ebitda - is.operatingIncome : null
      const da     = daRaw != null && daRaw >= 0 ? daRaw : null
      const daRev  = ratio(da, revenue)

      // CapEx: stored negative in Yahoo/FMP (outflow)
      const capex    = cf?.capex ?? null
      const capexRev = revenue != null && capex != null && revenue !== 0 ? capex / revenue : null

      // ΔNWC
      let dnwc: number | null = null
      if (!isProjected) {
        const nwcCurr = nwcByYear[yr]; const nwcPrev = prevYr ? nwcByYear[prevYr] : null
        if (nwcCurr != null && nwcPrev != null) dnwc = nwcCurr - nwcPrev
      } else if (revenue != null && prevRevenue != null) {
        dnwc = avgDnwcRatio * (revenue - prevRevenue)
      }
      const dnwcRev = ratio(dnwc, revenue)

      // Net Debt Repayment (historical only: LTD decrease = repayment)
      let netDebtRepayment: number | null = null
      if (!isProjected && bs && prevYr) {
        const bsPrev = bsMap[prevYr]
        if (bs.longTermDebt != null && bsPrev?.longTermDebt != null) {
          netDebtRepayment = bsPrev.longTermDebt - bs.longTermDebt
        }
      }

      const netIncome = is?.netIncome ?? null
      const netMargin = ratio(netIncome, revenue)

      // NOPAT = EBIT × (1 − taxRate)
      const nopat      = ebit != null ? ebit * (1 - taxRate) : null
      const nopatMargin = ratio(nopat, revenue)

      // UFCF = NOPAT + D&A + capex(neg) − ΔNWC
      let ufcf: number | null = null
      if (nopat != null && da != null && capex != null) {
        ufcf = nopat + da + capex - (dnwc ?? 0)
      } else if (cf?.freeCashFlow != null) {
        ufcf = cf.freeCashFlow   // graceful fallback
      }

      // LFCF = Net Income + D&A + capex(neg) − ΔNWC − NetDebtRepayment
      let lfcf: number | null = null
      if (netIncome != null && da != null && capex != null) {
        lfcf = netIncome + da + capex - (dnwc ?? 0) - (netDebtRepayment ?? 0)
      } else if (cf?.freeCashFlow != null) {
        lfcf = cf.freeCashFlow
      }

      // YoY growth
      const prev = result[i - 1] ?? null
      const ufcfGrowth = ufcf != null && prev?.ufcf != null && prev.ufcf !== 0
        ? (ufcf - prev.ufcf) / Math.abs(prev.ufcf) : null
      const lfcfGrowth = lfcf != null && prev?.lfcf != null && prev.lfcf !== 0
        ? (lfcf - prev.lfcf) / Math.abs(prev.lfcf) : null

      // PV (discounted back from projection year t)
      const t = projYrs.indexOf(yr) + 1
      const pvUFCF = isProjected && t > 0 && ufcf != null ? ufcf / Math.pow(1 + wacc, t) : null
      const pvLFCF = isProjected && t > 0 && lfcf != null ? lfcf / Math.pow(1 + wacc, t) : null

      result.push({
        year: yr, isProjected, revenue, revenueGrowth, ebit, ebitMargin,
        taxRateVal: taxRate, nopat, nopatMargin, da, daRev, capex, capexRev,
        dnwc, dnwcRev, netDebtRepayment, netIncome, netMargin,
        ufcf, ufcfGrowth, pvUFCF, lfcf, lfcfGrowth, pvLFCF,
      })
    }
    return result
  }, [years, isMap, bsMap, cfMap, taxRate, wacc])

  const histRows = rows.filter(r => !r.isProjected)
  const projRows = rows.filter(r => r.isProjected)

  // Cumulative PV (running sum over projection years)
  const cumPVMap = useMemo(() => {
    let sum = 0
    const m: Record<string, number> = {}
    for (const r of projRows) {
      sum += (mode === 'unlevered' ? r.pvUFCF : r.pvLFCF) ?? 0
      m[r.year] = sum
    }
    return m
  }, [projRows, mode])

  // ── Terminal Value ──────────────────────────────────────────────────────────
  const { tvPerpetuity, tvMultiple, pvTVP, pvTVM, eqValP, eqValM,
          priceP, priceM, upsideP, upsideM, sumPV } = useMemo(() => {
    if (projRows.length === 0) return {
      tvPerpetuity: 0, tvMultiple: 0, pvTVP: 0, pvTVM: 0,
      eqValP: 0, eqValM: 0, priceP: 0, priceM: 0, upsideP: 0, upsideM: 0, sumPV: 0,
    }
    const last      = projRows[projRows.length - 1]
    const fcfLast   = (mode === 'unlevered' ? last.ufcf : last.lfcf) ?? 0
    const n         = projRows.length
    const spv       = projRows.reduce((a, r) => a + ((mode === 'unlevered' ? r.pvUFCF : r.pvLFCF) ?? 0), 0)
    const g         = tgrPerpetual / 100

    const tvP  = wacc > g ? fcfLast * (1 + g) / (wacc - g) : fcfLast * 12
    const pvP  = tvP / Math.pow(1 + wacc, n)
    const evP  = spv + pvP
    const eqP  = evP + cash - debt
    const pP   = sharesOutstanding > 0 ? eqP / sharesOutstanding : 0
    const upP  = currentPrice > 0 ? (pP - currentPrice) / currentPrice : 0

    const tvM  = fcfLast * exitMultiple
    const pvM  = tvM / Math.pow(1 + wacc, n)
    const evM  = spv + pvM
    const eqM  = evM + cash - debt
    const pM   = sharesOutstanding > 0 ? eqM / sharesOutstanding : 0
    const upM  = currentPrice > 0 ? (pM - currentPrice) / currentPrice : 0

    return {
      tvPerpetuity: tvP, tvMultiple: tvM,
      pvTVP: pvP, pvTVM: pvM,
      eqValP: eqP, eqValM: eqM,
      priceP: pP, priceM: pM,
      upsideP: upP, upsideM: upM,
      sumPV: spv,
    }
  }, [projRows, mode, tgrPerpetual, exitMultiple, wacc, cash, debt, sharesOutstanding, currentPrice])

  // Detect if company likely needs levered mode (EBIT consistently null → fintech/bank)
  const isFinancialLike = histRows.every(r => r.ebit == null || r.ebit === 0)

  // ── Cell helpers ────────────────────────────────────────────────────────────
  const cellBase = 'px-3 py-2.5 text-center text-xs tabular-nums'
  const divider = <td className="px-1 py-2.5 text-center text-xs text-gray-200 dark:text-white/10">│</td>
  const inputCls = 'w-16 bg-transparent border-b border-gray-300 dark:border-white/20 text-sm font-semibold text-gray-900 dark:text-white outline-none tabular-nums focus:border-indigo-400'

  function numCell(v: string, isProj: boolean, bold = false, red = false, green = false) {
    const cls = [
      cellBase,
      isProj ? 'text-gray-600 dark:text-white/50' : 'text-gray-800 dark:text-white/75',
      bold ? 'font-semibold' : '',
      red ? '!text-red-500 dark:!text-red-400' : '',
      green ? '!text-emerald-600 dark:!text-emerald-400' : '',
      v === '—' ? '!text-gray-300 dark:!text-white/15' : '',
    ].join(' ')
    return <td className={cls}>{v}</td>
  }
  function subCell(v: string) {
    return <td className="px-3 py-1 text-center text-[10px] text-gray-400 dark:text-white/20 tabular-nums">{v}</td>
  }
  function labelCell(label: string, muted = false) {
    return <td className={`px-4 py-2.5 text-xs whitespace-nowrap min-w-[164px] ${muted ? 'text-gray-400 dark:text-white/20' : 'text-gray-500 dark:text-white/30'}`}>{label}</td>
  }
  function subLabelCell(label: string) {
    return <td className="px-4 py-1 text-[10px] text-gray-400 dark:text-white/20 pl-7">{label}</td>
  }

  // ── Toggle button ───────────────────────────────────────────────────────────
  function ToggleBtn({ label, active, onClick }: { label: string; active: boolean; onClick: () => void }) {
    return (
      <button onClick={onClick}
        className={`px-3 py-1.5 text-xs font-medium transition ${active
          ? 'bg-slate-800 text-white dark:bg-white/15 dark:text-white'
          : 'text-gray-500 dark:text-white/30 hover:bg-gray-50 dark:hover:bg-white/5'}`}>
        {label}
      </button>
    )
  }

  const fcfLabel = mode === 'unlevered' ? 'UFCF' : 'LFCF'

  return (
    <div className="rounded-xl bg-surface-container-lowest dark:bg-[#111] shadow-card border border-outline-variant/10 dark:border-white/8">

      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="px-6 pt-5 pb-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <h2 className="text-sm font-headline font-semibold text-on-surface dark:text-white/70">FCF Build-Up</h2>
          <div className="flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
            <ToggleBtn label="Unlevered" active={mode === 'unlevered'} onClick={() => setMode('unlevered')} />
            <ToggleBtn label="Levered"   active={mode === 'levered'}   onClick={() => setMode('levered')} />
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex rounded-lg border border-gray-200 dark:border-white/10 overflow-hidden">
            <ToggleBtn label="M" active={scale === 'M'} onClick={() => setScale('M')} />
            <ToggleBtn label="B" active={scale === 'B'} onClick={() => setScale('B')} />
          </div>
          {cagrAnalysis && (
            <span className={`text-[10px] font-medium px-2 py-1 rounded-full ${
              cagrAnalysis.confidenceLabel === 'High'   ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-500/10 dark:text-emerald-400' :
              cagrAnalysis.confidenceLabel === 'Medium' ? 'bg-amber-50  text-amber-700  dark:bg-amber-500/10  dark:text-amber-400'  :
                                                          'bg-red-50    text-red-700    dark:bg-red-500/10    dark:text-red-400'
            }`}>
              {cagrAnalysis.confidenceLabel} confidence · {cagrAnalysis.numAnalysts} analyst{cagrAnalysis.numAnalysts !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      </div>

      {isFinancialLike && mode === 'unlevered' && (
        <div className="mx-6 mb-3 text-xs text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-500/10 rounded-lg px-3 py-2">
          EBIT data is limited for this company (financial sector). Switch to <button className="underline font-medium" onClick={() => setMode('levered')}>Levered mode</button> for a better view.
        </div>
      )}

      {/* ── Table ──────────────────────────────────────────────────────────── */}
      <div className="overflow-x-auto">
        <table className="w-full min-w-[780px]">
          {/* Column headers */}
          <thead className="bg-surface-container-low dark:bg-white/5">
            <tr>
              <td className="px-4 py-2 text-[10px] font-semibold text-gray-400 dark:text-white/25 uppercase tracking-wide min-w-[164px]">
                {mode === 'unlevered' ? 'UNLEVERED FCF BUILD-UP' : 'LEVERED FCF BUILD-UP'}
              </td>
              {histRows.map(r => (
                <td key={r.year} className="px-3 py-2 text-center text-xs font-medium text-gray-400 dark:text-white/20">{r.year}</td>
              ))}
              {divider}
              {projRows.map(r => (
                <td key={r.year} className="px-3 py-2 text-center text-xs font-medium text-gray-500 dark:text-white/30">{r.year}</td>
              ))}
            </tr>
            <tr>
              <td className="px-4 py-0.5" />
              {histRows.map(r => <td key={r.year} className="px-3 py-0.5 text-center text-[10px] text-gray-400 dark:text-white/20 italic">actual</td>)}
              <td className="px-1 py-0.5" />
              {projRows.map(r => <td key={r.year} className="px-3 py-0.5 text-center text-[10px] text-gray-400 dark:text-white/20 italic">est.</td>)}
            </tr>
          </thead>
          <tbody>

            {/* ── Revenue ── */}
            <tr className="border-t border-gray-100 dark:border-white/5">
              {labelCell(`Revenue (${scale})`)}
              {histRows.map(r => numCell(fmtDollars(r.revenue, scale), false))}
              {divider}
              {projRows.map(r => numCell(fmtDollars(r.revenue, scale), true))}
            </tr>
            <tr>
              {subLabelCell('Revenue %Chg')}
              {histRows.map(r => subCell(fmtPctSign(r.revenueGrowth)))}
              <td className="px-1 py-1" />
              {projRows.map(r => subCell(fmtPctSign(r.revenueGrowth)))}
            </tr>

            {/* ── EBIT (unlevered) OR Net Income (levered) ── */}
            {mode === 'unlevered' ? (
              <>
                <tr className="border-t border-gray-100 dark:border-white/5">
                  {labelCell(`EBIT (${scale})`)}
                  {histRows.map(r => numCell(fmtDollars(r.ebit, scale), false))}
                  {divider}
                  {projRows.map(r => numCell(fmtDollars(r.ebit, scale), true))}
                </tr>
                <tr>
                  {subLabelCell('EBIT Margin')}
                  {histRows.map(r => subCell(fmtPctPlain(r.ebitMargin)))}
                  <td className="px-1 py-1" />
                  {projRows.map(r => subCell(fmtPctPlain(r.ebitMargin)))}
                </tr>
                <tr className="border-t border-gray-100 dark:border-white/5">
                  {labelCell('Tax Rate', true)}
                  {histRows.map(r => <td key={r.year} className="px-3 py-2.5 text-center text-xs text-gray-400 dark:text-white/25 tabular-nums">{fmtPctPlain(r.taxRateVal)}</td>)}
                  {divider}
                  {projRows.map(r => <td key={r.year} className="px-3 py-2.5 text-center text-xs text-gray-400 dark:text-white/25 tabular-nums">{fmtPctPlain(r.taxRateVal)}</td>)}
                </tr>
                <tr className="bg-gray-50 dark:bg-white/[0.02]">
                  {labelCell(`NOPAT (${scale})`)}
                  {histRows.map(r => numCell(fmtDollars(r.nopat, scale), false, true))}
                  {divider}
                  {projRows.map(r => numCell(fmtDollars(r.nopat, scale), true, true))}
                </tr>
                <tr className="bg-gray-50 dark:bg-white/[0.02]">
                  {subLabelCell('NOPAT Margin')}
                  {histRows.map(r => subCell(fmtPctPlain(r.nopatMargin)))}
                  <td className="px-1 py-1" />
                  {projRows.map(r => subCell(fmtPctPlain(r.nopatMargin)))}
                </tr>
              </>
            ) : (
              <>
                <tr className="border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.02]">
                  {labelCell(`Net Income (${scale})`)}
                  {histRows.map(r => numCell(fmtDollars(r.netIncome, scale), false, true))}
                  {divider}
                  {projRows.map(r => numCell(fmtDollars(r.netIncome, scale), true, true))}
                </tr>
                <tr className="bg-gray-50 dark:bg-white/[0.02]">
                  {subLabelCell('Net Margin')}
                  {histRows.map(r => subCell(fmtPctPlain(r.netMargin)))}
                  <td className="px-1 py-1" />
                  {projRows.map(r => subCell(fmtPctPlain(r.netMargin)))}
                </tr>
              </>
            )}

            {/* ── D&A ── */}
            <tr className="border-t border-gray-100 dark:border-white/5">
              {labelCell(`+ D&A (${scale})`)}
              {histRows.map(r => numCell(fmtDollars(r.da, scale), false, false, false, true))}
              {divider}
              {projRows.map(r => numCell(fmtDollars(r.da, scale), true, false, false, true))}
            </tr>
            <tr>
              {subLabelCell('D&A / Revenue')}
              {histRows.map(r => subCell(fmtPctPlain(r.daRev)))}
              <td className="px-1 py-1" />
              {projRows.map(r => subCell(fmtPctPlain(r.daRev)))}
            </tr>

            {/* ── CapEx ── */}
            <tr className="border-t border-gray-100 dark:border-white/5">
              {labelCell(`− CapEx (${scale})`)}
              {histRows.map(r => numCell(fmtDollars(r.capex, scale), false, false, true))}
              {divider}
              {projRows.map(r => numCell(fmtDollars(r.capex, scale), true, false, true))}
            </tr>
            <tr>
              {subLabelCell('CapEx / Revenue')}
              {histRows.map(r => subCell(fmtPctPlain(r.capexRev)))}
              <td className="px-1 py-1" />
              {projRows.map(r => subCell(fmtPctPlain(r.capexRev)))}
            </tr>

            {/* ── ΔNWC ── */}
            <tr className="border-t border-gray-100 dark:border-white/5">
              {labelCell(`Δ NWC (${scale})`)}
              {histRows.map(r => numCell(fmtDollars(r.dnwc, scale), false))}
              {divider}
              {projRows.map(r => {
                const v = fmtDollars(r.dnwc, scale)
                const isNeg = (r.dnwc ?? 0) < 0
                return numCell(v, true, false, !isNeg, isNeg)
              })}
            </tr>
            <tr>
              {subLabelCell('ΔNWC / Revenue')}
              {histRows.map(r => subCell(fmtPctPlain(r.dnwcRev)))}
              <td className="px-1 py-1" />
              {projRows.map(r => subCell(fmtPctPlain(r.dnwcRev)))}
            </tr>

            {/* ── Net Debt Repayment (levered only) ── */}
            {mode === 'levered' && (
              <>
                <tr className="border-t border-gray-100 dark:border-white/5">
                  {labelCell(`Net Debt Repmt (${scale})`)}
                  {histRows.map(r => numCell(fmtDollars(r.netDebtRepayment, scale), false))}
                  {divider}
                  {projRows.map(r => <td key={r.year} className="px-3 py-2.5 text-center text-[10px] text-gray-300 dark:text-white/15">—</td>)}
                </tr>
              </>
            )}

            {/* ── FCF (highlighted row) ── */}
            <tr className="border-t-2 border-gray-200 dark:border-white/10 bg-indigo-50/40 dark:bg-indigo-500/5">
              {labelCell(`${fcfLabel} (${scale})`)}
              {histRows.map(r => {
                const v = mode === 'unlevered' ? r.ufcf : r.lfcf
                const s = fmtDollars(v, scale)
                return <td key={r.year} className={`px-3 py-3 text-center text-sm font-bold tabular-nums ${v == null ? 'text-gray-300 dark:text-white/15' : (v ?? 0) >= 0 ? 'text-gray-900 dark:text-white/90' : 'text-red-600 dark:text-red-400'}`}>{s}</td>
              })}
              {divider}
              {projRows.map(r => {
                const v = mode === 'unlevered' ? r.ufcf : r.lfcf
                const s = fmtDollars(v, scale)
                return <td key={r.year} className={`px-3 py-3 text-center text-sm font-bold tabular-nums ${v == null ? 'text-gray-300 dark:text-white/15' : (v ?? 0) >= 0 ? 'text-indigo-600 dark:text-indigo-400' : 'text-red-500 dark:text-red-400'}`}>{s}</td>
              })}
            </tr>
            <tr className="bg-indigo-50/40 dark:bg-indigo-500/5">
              {subLabelCell(`${fcfLabel} %Chg`)}
              {histRows.map(r => {
                const g = mode === 'unlevered' ? r.ufcfGrowth : r.lfcfGrowth
                const v = fmtPctSign(g)
                return <td key={r.year} className={`px-3 py-1 text-center text-[10px] tabular-nums ${g == null ? 'text-gray-300 dark:text-white/15' : g >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>{v}</td>
              })}
              <td className="px-1 py-1" />
              {projRows.map(r => {
                const g = mode === 'unlevered' ? r.ufcfGrowth : r.lfcfGrowth
                const v = fmtPctSign(g)
                return <td key={r.year} className={`px-3 py-1 text-center text-[10px] tabular-nums ${g == null ? 'text-gray-300 dark:text-white/15' : g >= 0 ? 'text-emerald-500/70 dark:text-emerald-400/60' : 'text-red-400/70 dark:text-red-400/60'}`}>{v}</td>
              })}
            </tr>

            {/* ── PV of FCF ── */}
            <tr className="border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.03]">
              {labelCell(`PV of ${fcfLabel} (${scale})`, true)}
              {histRows.map(r => <td key={r.year} className="px-3 py-2.5 text-center text-xs text-gray-300 dark:text-white/15">—</td>)}
              {divider}
              {projRows.map(r => {
                const v = mode === 'unlevered' ? r.pvUFCF : r.pvLFCF
                return <td key={r.year} className={`px-3 py-2.5 text-center text-xs tabular-nums ${v == null ? 'text-gray-300 dark:text-white/15' : 'text-gray-600 dark:text-white/50'}`}>{fmtDollars(v, scale)}</td>
              })}
            </tr>

            {/* ── Cumulative PV ── */}
            <tr className="border-t border-gray-100 dark:border-white/5 bg-gray-50 dark:bg-white/[0.03]">
              {labelCell(`Σ PV (${scale})`, true)}
              {histRows.map(r => <td key={r.year} className="px-3 py-2.5 text-center text-xs text-gray-300 dark:text-white/15">—</td>)}
              {divider}
              {projRows.map(r => (
                <td key={r.year} className="px-3 py-2.5 text-center text-xs font-semibold text-indigo-600 dark:text-indigo-400 tabular-nums">
                  {fmtDollars(cumPVMap[r.year] ?? null, scale)}
                </td>
              ))}
            </tr>

          </tbody>
        </table>
      </div>

      {/* ── Terminal Value Panel ────────────────────────────────────────────── */}
      <div className="border-t border-gray-100 dark:border-white/5 px-6 py-5">
        <div className="flex items-center gap-3 mb-4">
          <span className="text-xs font-semibold uppercase tracking-wide text-gray-500 dark:text-white/30">Terminal Value</span>
          <span className="text-xs text-gray-400 dark:text-white/20">Both methods shown simultaneously</span>
        </div>

        {/* WACC input */}
        <div className="flex flex-wrap gap-4 mb-5">
          <div className="rounded-lg bg-gray-50 dark:bg-white/5 px-4 py-3 flex items-center gap-2">
            <span className="text-[10px] text-gray-400 dark:text-white/25 uppercase tracking-wide">WACC</span>
            <input type="number" step="0.1" min="1" max="30"
              value={waccEdit}
              onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setWaccEdit(v) }}
              className={inputCls}
            />
            <span className="text-xs text-gray-400">%</span>
          </div>
          <div className="text-xs text-gray-400 dark:text-white/25 self-center">
            Σ PV = <span className="font-semibold text-gray-700 dark:text-white/70">{fmtDollars(sumPV, scale)}</span>
            <span className="mx-1">·</span>
            Cash = <span className="font-semibold text-emerald-600 dark:text-emerald-400">{fmtDollars(cash, 'M')}</span>
            <span className="mx-1">·</span>
            Debt = <span className="font-semibold text-red-500 dark:text-red-400">{fmtDollars(debt, 'M')}</span>
            <span className="mx-1">·</span>
            Shares = <span className="font-semibold text-gray-700 dark:text-white/70">{fmt(sharesOutstanding, 0)}M</span>
          </div>
        </div>

        {/* Two-column: Perpetuity | Exit Multiple */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">

          {/* Perpetuity */}
          <div className="rounded-xl border border-gray-200 dark:border-white/8 p-4">
            <div className="text-xs font-semibold text-gray-500 dark:text-white/30 uppercase tracking-wide mb-3">Perpetuity Growth Rate</div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] text-gray-400">TGR</span>
              <input type="number" step="0.1" min="0" max="8"
                value={tgrPerpetual}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v)) setTgr(v) }}
                className={inputCls}
              />
              <span className="text-xs text-gray-400">%</span>
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'Terminal Value',  val: fmtDollars(tvPerpetuity, scale) },
                { label: 'PV of TV',        val: fmtDollars(pvTVP, scale) },
                { label: 'Equity Value',    val: fmtDollars(eqValP, scale) },
              ].map(row => (
                <div key={row.label} className="flex justify-between border-b border-gray-100 dark:border-white/5 pb-1.5 text-gray-500 dark:text-white/30">
                  <span>{row.label}</span>
                  <span className="font-medium text-gray-700 dark:text-white/70">{row.val}</span>
                </div>
              ))}
              <div className="pt-1 flex justify-between">
                <span className="text-gray-500 dark:text-white/30">Implied Price</span>
                {financialCurrencyNote
                  ? <span className="text-[10px] text-amber-600 dark:text-amber-400">FX adjusted — see DCF model</span>
                  : <span className="font-bold text-gray-900 dark:text-white">{currency}{fmt(priceP)}</span>}
              </div>
              {!financialCurrencyNote && (
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-white/25">vs {currency}{fmt(currentPrice)}</span>
                  <span className={`font-semibold ${upsideP >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {upsideP >= 0 ? '+' : ''}{fmtPct(upsideP)}
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Exit Multiple */}
          <div className="rounded-xl border border-gray-200 dark:border-white/8 p-4">
            <div className="text-xs font-semibold text-gray-500 dark:text-white/30 uppercase tracking-wide mb-3">
              Exit {mode === 'unlevered' ? 'EV/FCF' : 'P/E'} Multiple
            </div>
            <div className="flex items-center gap-2 mb-3">
              <span className="text-[11px] text-gray-400">{mode === 'unlevered' ? 'EV/FCF' : 'P/E'}</span>
              <input type="number" step="0.5" min="5" max="100"
                value={exitMultiple}
                onChange={e => { const v = parseFloat(e.target.value); if (!isNaN(v) && v > 0) setMult(v) }}
                className={inputCls}
              />
              <span className="text-xs text-gray-400">×</span>
            </div>
            <div className="space-y-1.5 text-xs">
              {[
                { label: 'Terminal Value',  val: fmtDollars(tvMultiple, scale) },
                { label: 'PV of TV',        val: fmtDollars(pvTVM, scale) },
                { label: 'Equity Value',    val: fmtDollars(eqValM, scale) },
              ].map(row => (
                <div key={row.label} className="flex justify-between border-b border-gray-100 dark:border-white/5 pb-1.5 text-gray-500 dark:text-white/30">
                  <span>{row.label}</span>
                  <span className="font-medium text-gray-700 dark:text-white/70">{row.val}</span>
                </div>
              ))}
              <div className="pt-1 flex justify-between">
                <span className="text-gray-500 dark:text-white/30">Implied Price</span>
                {financialCurrencyNote
                  ? <span className="text-[10px] text-amber-600 dark:text-amber-400">FX adjusted — see DCF model</span>
                  : <span className="font-bold text-gray-900 dark:text-white">{currency}{fmt(priceM)}</span>}
              </div>
              {!financialCurrencyNote && (
                <div className="flex justify-between">
                  <span className="text-gray-400 dark:text-white/25">vs {currency}{fmt(currentPrice)}</span>
                  <span className={`font-semibold ${upsideM >= 0 ? 'text-emerald-600 dark:text-emerald-400' : 'text-red-500 dark:text-red-400'}`}>
                    {upsideM >= 0 ? '+' : ''}{fmtPct(upsideM)}
                  </span>
                </div>
              )}
            </div>
          </div>

        </div>

        <p className="mt-3 text-[10px] text-gray-400 dark:text-white/20">
          D&A derived from EBITDA − EBIT. ΔNWC from operating working capital changes; projected years use historical avg ratio.
          {mode === 'unlevered' ? ' UFCF = NOPAT + D&A − CapEx − ΔNWC.' : ' LFCF = Net Income + D&A − CapEx − ΔNWC − Net Debt Repayment.'}
          {financialCurrencyNote && ` Financial statements in local currency (${financialCurrencyNote}); implied price not shown.`}
        </p>
      </div>
    </div>
  )
}
