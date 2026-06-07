/**
 * insic canonical chart theme for Recharts.
 * Apply to all Recharts instances in the application.
 * Only lightweight-charts (price history) is exempt — it has its own theme.
 */

export const chartTheme = {
  grid: {
    stroke: '#E3E1DA',
    strokeDasharray: '2 4',
    opacity: 0.8,
  },
  axis: {
    stroke: '#E3E1DA',
    tick: {
      fill: '#8A95A6',
      fontSize: 11,
      fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
    },
  },
  tooltip: {
    bg: '#FFFFFF',
    border: '#E3E1DA',
    borderRadius: 10,
    shadow: '0 8px 32px rgba(0,0,0,0.10)',
    labelStyle: { color: '#06101F', fontWeight: 600, fontSize: 12 },
    itemStyle: { color: '#566174', fontSize: 12 },
  },
  legend: {
    fontSize: 12,
    color: '#566174',
    fontFamily: 'var(--font-sans, Inter, system-ui, sans-serif)',
  },
  series: {
    marketPrice:   '#0A1424',  // ink-900 — market price line
    fairValue:     '#5F790B',  // olive-600 — model fair value
    analystTarget: '#2563EB',  // info blue — analyst / external data
    revenue:       '#2563EB',  // blue — revenue bars
    income:        '#11875D',  // positive — net income / FCF
    loss:          '#D83B3B',  // negative — losses / costs
    benchmark:     '#8A95A6',  // muted — benchmark / index
    bear:          '#D83B3B',  // bear scenario
    base:          '#5F790B',  // base scenario (olive)
    bull:          '#11875D',  // bull scenario
    neutral1:      '#566174',  // secondary series
    neutral2:      '#8A95A6',  // tertiary series
  },
  estimate: {
    strokeDasharray: '6 3',    // dashed for all estimated / projected values
  },
  strokeWidth: {
    default: 2,
    thin: 1.5,
    thick: 2.5,
  },
} as const

// Recharts-compatible color array for multi-series charts
export const chartSeriesColors = [
  chartTheme.series.marketPrice,
  chartTheme.series.fairValue,
  chartTheme.series.revenue,
  chartTheme.series.income,
  chartTheme.series.analystTarget,
  chartTheme.series.neutral1,
  chartTheme.series.neutral2,
]

// Scenario gradient for range bars (Bear → Base → Bull)
export const scenarioGradient = {
  bear: chartTheme.series.bear,
  base: chartTheme.series.base,
  bull: chartTheme.series.bull,
}
