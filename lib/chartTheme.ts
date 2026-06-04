/**
 * insic shared Recharts chart theme.
 * Import from any Recharts-based component to ensure visual consistency.
 *
 * Usage:
 *   import { CHART_THEME, chartTooltipStyle } from '@/lib/chartTheme'
 *
 *   <XAxis tick={{ fill: CHART_THEME.axisText, fontSize: 12 }} />
 *   <Tooltip contentStyle={chartTooltipStyle} />
 */

// ── Color palette ─────────────────────────────────────────────────────────────

export const CHART_COLORS = {
  // Primary data series
  marketPrice:    '#0A1424',   // ink-900 — market price line
  fairValue:      '#5F790B',   // olive-700 — intrinsic / fair value
  analystTarget:  '#2563EB',   // blue-600 — analyst price target (dashed)

  // Financial statement series
  revenue:        '#2563EB',   // blue-600
  netIncome:      '#11875D',   // positive green
  fcf:            '#11875D',   // positive green (same as net income)
  costs:          '#D83B3B',   // negative red
  ebitda:         '#6F8F12',   // olive-600

  // Scenario fills
  bull:           '#11875D',
  base:           '#5F790B',
  bear:           '#D83B3B',

  // Neutral / benchmarks
  benchmark:      '#94A3B8',
  peer:           '#CBD1C4',

  // Up / down (price changes)
  up:             '#11875D',
  down:           '#D83B3B',
  warn:           '#B56A00',

  // Chart chrome
  grid:           '#E8ECE3',
  axisText:       '#8A96A8',
  axisTitle:      '#536174',
  tooltipBorder:  '#E3E6E0',
  tooltipBg:      '#FFFFFF',
  crosshair:      '#CBD1C4',
  refLine:        '#B56A00',   // amber — reference lines (e.g. consensus target)
} as const

// ── Recharts XAxis / YAxis shared tick props ──────────────────────────────────

export const CHART_AXIS_TICK = {
  fontSize:   12,
  fill:       CHART_COLORS.axisText,
  fontFamily: 'var(--font-sans, Inter), system-ui, sans-serif',
  fontVariantNumeric: 'tabular-nums',
} as const

// ── Recharts grid props ───────────────────────────────────────────────────────

export const CHART_GRID_PROPS = {
  stroke:          CHART_COLORS.grid,
  strokeWidth:     1,
  strokeDasharray: undefined,
  vertical:        false,
} as const

// ── Recharts tooltip contentStyle ─────────────────────────────────────────────

export const chartTooltipStyle: React.CSSProperties = {
  background:    CHART_COLORS.tooltipBg,
  border:        `1px solid ${CHART_COLORS.tooltipBorder}`,
  borderRadius:  '10px',
  fontSize:      '12px',
  fontFamily:    'var(--font-sans, Inter), system-ui, sans-serif',
  boxShadow:     '0 8px 24px rgba(6, 16, 31, 0.09)',
  padding:       '8px 12px',
  color:         '#0A1424',
}

export const chartTooltipLabelStyle: React.CSSProperties = {
  color:       CHART_COLORS.axisTitle,
  fontSize:    '11px',
  marginBottom: '4px',
  fontWeight:  600,
}

export const chartTooltipItemStyle: React.CSSProperties = {
  color:   '#0A1424',
  padding: '1px 0',
  fontSize: '12px',
}

// ── Recharts cursor / crosshair ───────────────────────────────────────────────

export const chartCursorStyle = {
  stroke:      CHART_COLORS.crosshair,
  strokeWidth: 1,
} as const

// ── Standard line props ───────────────────────────────────────────────────────

export const CHART_LINE_DEFAULTS = {
  strokeWidth:       2,
  dot:               false,
  isAnimationActive: false,
  activeDot:         { r: 4, strokeWidth: 0 },
} as const

// ── Area fill opacity (use at 8–12% max) ─────────────────────────────────────

export const CHART_AREA_FILL_OPACITY = 0.09

// ── Bar radius ────────────────────────────────────────────────────────────────

export const CHART_BAR_RADIUS: [number, number, number, number] = [4, 4, 0, 0]

// ── Diverging heatmap scale (sensitivity matrix) ──────────────────────────────
// Input: relative delta from 0 (centre = fair, negative = below, positive = above)

export function sensitivityCellStyle(upsidePct: number): React.CSSProperties {
  const abs = Math.abs(upsidePct)
  if (upsidePct > 40)  return { background: '#11875D', color: '#FFFFFF' }
  if (upsidePct > 20)  return { background: '#BFD2A1', color: '#0A1424' }
  if (upsidePct > 5)   return { background: '#EEF4DD', color: '#0A1424' }
  if (upsidePct > -5)  return { background: '#F8F7F2', color: '#536174' }   // near fair value
  if (upsidePct > -20) return { background: '#FCEAEA', color: '#0A1424' }
  if (abs > 0)         return { background: '#D83B3B', color: '#FFFFFF' }
  return { background: '#F1F5F9', color: '#536174' }
}

// ── Convenient grouped export ─────────────────────────────────────────────────

export const CHART_THEME = CHART_COLORS
