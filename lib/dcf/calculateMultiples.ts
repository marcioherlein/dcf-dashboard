import type { CompanyType } from './detectCompanyType'

export interface MultipleEstimate {
  multiple: string       // "P/E", "EV/EBITDA", "P/B", "P/S"
  actualValue: number    // company's current multiple
  sectorMedian: number   // Damodaran-based sector median
  impliedFairValue: number
  upsidePct: number
  applicable: boolean
  note: string
}

export interface MultiplesResult {
  estimates: MultipleEstimate[]
  blendedFairValue: number | null  // equal-weighted average of applicable estimates
}

// Damodaran January 2024 US market sector medians
// Source: pages.stern.nyu.edu/~adamodar/New_Home_Page/datafile/pedata.html
const SECTOR_MEDIANS: Record<string, { pe: number; evEbitda: number; pb: number; ps: number; evRevenue: number }> = {
  'Technology':              { pe: 28,  evEbitda: 20,  pb: 7.5, ps: 5.0, evRevenue: 6.0 },
  'Financial Services':      { pe: 14,  evEbitda: 12,  pb: 1.4, ps: 2.8, evRevenue: 3.5 },
  'Healthcare':              { pe: 24,  evEbitda: 16,  pb: 4.2, ps: 4.5, evRevenue: 4.5 },
  'Consumer Cyclical':       { pe: 20,  evEbitda: 13,  pb: 3.5, ps: 1.4, evRevenue: 1.5 },
  'Consumer Defensive':      { pe: 22,  evEbitda: 15,  pb: 4.0, ps: 1.8, evRevenue: 2.0 },
  'Energy':                  { pe: 12,  evEbitda: 8,   pb: 1.6, ps: 1.2, evRevenue: 1.3 },
  'Utilities':               { pe: 18,  evEbitda: 12,  pb: 1.8, ps: 2.0, evRevenue: 2.5 },
  'Industrials':             { pe: 21,  evEbitda: 14,  pb: 3.8, ps: 1.8, evRevenue: 2.0 },
  'Basic Materials':         { pe: 16,  evEbitda: 10,  pb: 2.0, ps: 1.5, evRevenue: 1.8 },
  'Real Estate':             { pe: 35,  evEbitda: 20,  pb: 2.2, ps: 6.0, evRevenue: 7.0 },
  'Communication Services':  { pe: 22,  evEbitda: 14,  pb: 4.5, ps: 3.0, evRevenue: 3.5 },
  'default':                 { pe: 20,  evEbitda: 14,  pb: 3.0, ps: 2.5, evRevenue: 3.0 },
}

function getSectorMedians(sector: string) {
  return SECTOR_MEDIANS[sector] ?? SECTOR_MEDIANS['default']
}

function impliedPrice(current: number, actual: number, sectorMedian: number): number {
  if (!actual || actual <= 0 || !isFinite(actual)) return 0
  return (current * sectorMedian) / actual
}

export function calculateMultiples(input: {
  sector: string
  companyType: CompanyType
  currentPrice: number
  trailingPE: number | null
  priceToBook: number | null
  priceToSales: number | null
  evToEbitda: number | null
  evToRevenue: number | null
}): MultiplesResult {
  const { sector, companyType, currentPrice } = input
  const med = getSectorMedians(sector)
  const estimates: MultipleEstimate[] = []

  function makeEstimate(
    multiple: string,
    actual: number | null,
    sectorMedian: number,
    applyFor: CompanyType[],
    note: string,
  ): MultipleEstimate {
    const applicable = applyFor.includes(companyType) && actual !== null && actual > 0 && isFinite(actual)
    const fv = applicable ? impliedPrice(currentPrice, actual!, sectorMedian) : 0
    const upside = applicable && currentPrice > 0 ? (fv - currentPrice) / currentPrice : 0
    return {
      multiple,
      actualValue: actual ?? 0,
      sectorMedian,
      impliedFairValue: Math.round(fv * 100) / 100,
      upsidePct: Math.round(upside * 1000) / 1000,
      applicable,
      note: applicable ? note : (actual === null ? 'N/A — data unavailable' : 'Not applicable for this company type'),
    }
  }

  // P/E — relevant for profitable companies
  estimates.push(makeEstimate(
    'P/E',
    input.trailingPE,
    med.pe,
    ['standard', 'dividend', 'financial', 'growth'],
    `Sector median P/E: ${med.pe}x`,
  ))

  // EV/EBITDA — best for capital-intensive, standard, growth
  estimates.push(makeEstimate(
    'EV/EBITDA',
    input.evToEbitda,
    med.evEbitda,
    ['standard', 'dividend', 'growth'],
    `Sector median EV/EBITDA: ${med.evEbitda}x`,
  ))

  // P/B — primary for financial companies
  estimates.push(makeEstimate(
    'P/Book',
    input.priceToBook,
    med.pb,
    ['financial', 'standard'],
    `Sector median P/B: ${med.pb}x`,
  ))

  // P/S — useful for growth, startup, and financial services
  estimates.push(makeEstimate(
    'P/Sales',
    input.priceToSales,
    med.ps,
    ['growth', 'startup', 'financial'],
    `Sector median P/S: ${med.ps}x`,
  ))

  // EV/Revenue — primary for startup
  estimates.push(makeEstimate(
    'EV/Revenue',
    input.evToRevenue,
    med.evRevenue,
    ['startup', 'growth'],
    `Sector median EV/Revenue: ${med.evRevenue}x`,
  ))

  // Blended: equal-weight of applicable estimates
  const applicable = estimates.filter((e) => e.applicable && e.impliedFairValue > 0)
  const blendedFairValue = applicable.length > 0
    ? Math.round(applicable.reduce((s, e) => s + e.impliedFairValue, 0) / applicable.length * 100) / 100
    : null

  return { estimates, blendedFairValue }
}
