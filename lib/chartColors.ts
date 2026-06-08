/**
 * Categorical 12-slot color palette for chart company identification.
 *
 * Slot 0 (#2563EB blue) is reserved for anchor/primary companies in peer charts.
 * Features 1 and 2 reference this same array so colors are consistent across
 * the fullscreen peer chart and the screener chart builder.
 *
 * Colors chosen for distinguishability under simulated deuteranopia.
 */
export const CHART_COLORS = [
  '#2563EB', // 0 — reserved for anchor (blue)
  '#5F790B', // 1 — olive (brand primary)
  '#D83B3B', // 2 — red
  '#B56A00', // 3 — amber
  '#7C3AED', // 4 — violet
  '#0891B2', // 5 — cyan
  '#059669', // 6 — emerald
  '#DB2777', // 7 — pink
  '#EA580C', // 8 — orange
  '#64748B', // 9 — slate
  '#9333EA', // 10 — purple
  '#0F766E', // 11 — teal
] as const

export type ChartColor = (typeof CHART_COLORS)[number]

/** Get the color for a company at a given slot index. */
export function chartColor(index: number): string {
  return CHART_COLORS[index % CHART_COLORS.length]
}

/**
 * Build a stable ticker→color map from an ordered array of tickers.
 * Slot 0 is always the anchor (first entry); peers fill subsequent slots.
 * Removing a company does NOT shift remaining companies' colors.
 */
export function buildColorMap(tickers: string[]): Map<string, string> {
  const map = new Map<string, string>()
  tickers.forEach((t, i) => map.set(t, chartColor(i)))
  return map
}

/**
 * Sector color mapping for the screener chart builder.
 * Uses distinct colors from the CHART_COLORS palette where possible.
 */
export const SECTOR_CHART_COLORS: Record<string, string> = {
  'Technology':               '#2563EB',
  'Healthcare':               '#059669',
  'Financial Services':       '#5F790B',
  'Consumer Cyclical':        '#EA580C',
  'Consumer Defensive':       '#0891B2',
  'Communication Services':   '#7C3AED',
  'Industrials':              '#64748B',
  'Energy':                   '#B56A00',
  'Basic Materials':          '#0F766E',
  'Real Estate':              '#DB2777',
  'Utilities':                '#9333EA',
  'Other':                    '#94A3B8',
}

export function sectorColor(sector: string | null): string {
  return (sector && SECTOR_CHART_COLORS[sector]) ?? SECTOR_CHART_COLORS['Other']
}
