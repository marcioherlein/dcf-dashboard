// Single source of truth for brand + verdict display values.
// Used by both the React UI and the edge OG image routes.
// Change here → both the page and every share card update.

export const SITE_URL = 'insic.app'
export const LOGO_URL = '/brand/insic-logo-horizontal-on-dark.png'
export const LOGO_MARK_URL = '/brand/insic-mark.png'

// insic brand palette — olive is the primary accent
export const BRAND = {
  olive700:       '#5F790B',
  olive600:       '#6F8F12',
  olive100:       '#EEF4DD',
  olive50:        '#F6FAEA',
  ink900:         '#111111',
  ink800:         '#1C1C1C',
  bgWarm:         '#FFFFFF',
  border:         '#E5E5E5',
  positive:       '#11875D',
  positiveSoft:   '#E8F7EF',
  negative:       '#D83B3B',
  negativeSoft:   '#FCEAEA',
  warn:           '#B56A00',
  warnSoft:       '#FFF4DA',
  blue600:        '#2563EB',
  blue50:         '#F4F7FF',
} as const

export const VERDICT_DISPLAY = {
  'Undervalued':       { word: 'Attractive',    colorHex: BRAND.olive700,  bgHex: BRAND.olive50,      borderHex: '#BFD2A1' },
  'Fairly Valued':     { word: 'Fairly Priced', colorHex: BRAND.blue600,   bgHex: '#F5F5F5',           borderHex: '#D1D1D1' },
  'Overvalued':        { word: 'Expensive',     colorHex: BRAND.negative,  bgHex: BRAND.negativeSoft, borderHex: '#F0B8B8' },
  'Insufficient Data': { word: 'Inconclusive',  colorHex: '#64748B',       bgHex: '#F5F5F5',          borderHex: '#C8C8C8' },
} as const

export type VerdictKey = keyof typeof VERDICT_DISPLAY
