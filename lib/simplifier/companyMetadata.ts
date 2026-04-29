/**
 * Derives company profile metadata from Yahoo Finance summary data.
 * All logic is rule-based — no API calls, no AI.
 */

// ── Founded year ──────────────────────────────────────────────────────────────
// Yahoo Finance embeds "was founded in YYYY" or "founded in YYYY" in the
// longBusinessSummary text. Parse it from there.
export function extractFoundedYear(description: string): string | null {
  if (!description) return null
  const m = description.match(/(?:was )?founded (?:in )?(\d{4})/i)
  return m ? m[1] : null
}

// ── Customer Profile (B2B / B2C / Both) ──────────────────────────────────────
export type CustomerProfile = 'B2B' | 'B2C' | 'B2B & B2C' | 'Government' | 'Mixed'

const B2C_SECTORS = ['Consumer Cyclical', 'Consumer Defensive', 'Communication Services']
const B2C_INDUSTRIES = [
  'internet retail', 'specialty retail', 'apparel retail', 'restaurants',
  'leisure', 'gaming', 'home improvement', 'personal products', 'beverages',
  'tobacco', 'household', 'consumer electronics', 'food distribution',
  'grocery', 'packaged foods', 'sporting goods', 'footwear', 'broadcasting',
  'entertainment', 'media', 'social media', 'streaming',
]
const B2B_SECTORS = ['Basic Materials', 'Energy', 'Industrials', 'Utilities']
const B2B_INDUSTRIES = [
  'semiconductors', 'enterprise software', 'information technology services',
  'electronic components', 'scientific instruments', 'aerospace', 'defense',
  'oil & gas', 'chemicals', 'construction', 'engineering', 'staffing',
  'logistics', 'shipping', 'farm products', 'commercial services',
  'cloud computing', 'cybersecurity', 'data processing',
]
const FINANCIAL_INDUSTRIES = ['banks', 'insurance', 'asset management', 'credit services', 'capital markets']
const HEALTH_INDUSTRIES = ['biotechnology', 'drug manufacturers', 'medical devices', 'hospitals', 'diagnostics']

export function deriveCustomerProfile(sector: string, industry: string): CustomerProfile {
  const s = sector.toLowerCase()
  const ind = industry.toLowerCase()

  if (FINANCIAL_INDUSTRIES.some(i => ind.includes(i))) return 'B2B & B2C'
  if (HEALTH_INDUSTRIES.some(i => ind.includes(i))) return 'B2B'
  if (ind.includes('government') || s.includes('defense')) return 'Government'

  const isB2C = B2C_SECTORS.includes(sector) || B2C_INDUSTRIES.some(i => ind.includes(i))
  const isB2B = B2B_SECTORS.includes(sector) || B2B_INDUSTRIES.some(i => ind.includes(i))

  if (isB2C && isB2B) return 'B2B & B2C'
  if (isB2C) return 'B2C'
  if (isB2B) return 'B2B'

  // Technology is usually mixed — lean B2B unless consumer electronics
  if (s.includes('technology')) {
    if (ind.includes('consumer electronics') || ind.includes('software—application')) return 'B2B & B2C'
    return 'B2B'
  }

  return 'B2B & B2C'
}

// ── Key Offerings — extracted from description ────────────────────────────────
// Strategy: parse the first sentence(s) for noun phrases after "offers", "provides",
// "manufactures", "operates", etc. Fall back to sector-based defaults.
export function extractKeyOfferings(description: string, sector: string, industry: string): string[] {
  if (!description) return sectorOfferings(sector, industry)

  // Look for a list introduced by "offers", "provides", "manufactures", "includes"
  const introMatch = description.match(
    /(?:offers?|provides?|manufactures?|markets?|operates?|develops?|designs?)[^.]*?(?:including|include|comprising|such as|namely)([^.]+)\./i
  )
  if (introMatch) {
    return parseList(introMatch[1])
  }

  // Sentence 1 often lists products after the company name + verb
  const firstSentence = description.split('.')[0] ?? ''
  const productsMatch = firstSentence.match(
    /(?:offers?|provides?|markets?|manufactures?|designs?|operates?)[^,]+,([^.]+)/i
  )
  if (productsMatch) {
    const items = parseList(productsMatch[1])
    if (items.length >= 2) return items
  }

  return sectorOfferings(sector, industry)
}

function parseList(raw: string): string[] {
  return raw
    .split(/[,;]/)
    .map(s => s.trim().replace(/^(and|or|the|a|an)\s+/i, '').trim())
    .filter(s => s.length > 2 && s.length < 60)
    .slice(0, 6)
}

function sectorOfferings(sector: string, industry: string): string[] {
  const ind = industry.toLowerCase()
  if (ind.includes('semiconductor')) return ['Semiconductors', 'Chipsets', 'IP Licensing']
  if (ind.includes('software')) return ['Software Products', 'SaaS Subscriptions', 'Professional Services']
  if (ind.includes('bank')) return ['Retail Banking', 'Commercial Loans', 'Wealth Management']
  if (ind.includes('insurance')) return ['Life Insurance', 'Property & Casualty', 'Annuities']
  if (ind.includes('retail')) return ['Retail Products', 'E-commerce', 'Private Label']
  if (ind.includes('oil') || ind.includes('gas') || ind.includes('energy')) return ['Upstream E&P', 'Refining', 'Distribution']
  if (ind.includes('pharmaceutical') || ind.includes('drug')) return ['Prescription Drugs', 'OTC Products', 'Biologics']
  if (ind.includes('medical')) return ['Medical Devices', 'Diagnostics', 'Patient Services']
  if (ind.includes('cloud') || ind.includes('internet')) return ['Cloud Services', 'Platform', 'Subscriptions']
  if (sector.toLowerCase().includes('consumer')) return ['Consumer Products', 'Branded Goods', 'Services']
  return ['Products & Services']
}

// ── Revenue segments — Yahoo Finance doesn't reliably provide this. ─────────
// We return a "not available" signal so the UI can show a placeholder gracefully.
export function getSegmentAvailability(): { available: false; reason: string } {
  return {
    available: false,
    reason: 'Segment breakdown not available from Yahoo Finance. Check company\'s investor relations page for detailed segment data.',
  }
}
