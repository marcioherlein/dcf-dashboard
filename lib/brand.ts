// Single source of truth for brand + verdict display values.
// Used by both the React UI and the edge OG image routes.
// Change here → both the page and every share card update.

export const SITE_URL = 'insic.app'
export const LOGO_URL = '/logos/insic-header.png'
export const LOGO_MARK_URL = '/logos/insic-app-icon.png'

// insic brand palette — olive is the primary accent
export const BRAND = {
  olive700:       '#5F790B',
  olive600:       '#6F8F12',
  olive100:       '#EEF4DD',
  olive50:        '#F6FAEA',
  ink900:         '#0A1424',
  ink800:         '#111C2E',
  bgWarm:         '#F8F7F2',
  border:         '#E3E6E0',
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
  'Fairly Valued':     { word: 'Fairly Priced', colorHex: BRAND.blue600,   bgHex: '#F6F8FC',           borderHex: '#C9D5E8' },
  'Overvalued':        { word: 'Expensive',     colorHex: BRAND.negative,  bgHex: BRAND.negativeSoft, borderHex: '#F0B8B8' },
  'Insufficient Data': { word: 'Inconclusive',  colorHex: '#64748B',       bgHex: '#F1F5F9',          borderHex: '#CBD1C4' },
} as const

export type VerdictKey = keyof typeof VERDICT_DISPLAY
