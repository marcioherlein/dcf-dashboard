// Single source of truth for brand + verdict display values
// used by both the React UI (VerdictHero) and the edge OG image routes.
// Change here → both the page and every exported share card update.

export const SITE_URL = 'intrinsico.app'
export const LOGO_URL = '/brand/logo-horizontal-reversed.png'
export const LOGO_MARK_URL = '/brand/mark-reversed.png'

export const VERDICT_DISPLAY = {
  'Undervalued':       { word: 'Attractive',    colorHex: '#059669' },
  'Fairly Valued':     { word: 'Fairly Priced', colorHex: '#2563EB' },
  'Overvalued':        { word: 'Expensive',     colorHex: '#DC2626' },
  'Insufficient Data': { word: 'Inconclusive',  colorHex: '#64748B' },
} as const

export type VerdictKey = keyof typeof VERDICT_DISPLAY
