/**
 * Responsive chart dimension constants.
 * Single source of truth for chart heights and margins across breakpoints.
 */

export const CHART_HEIGHTS = {
  xs:  100,
  sm:  180,
  md:  160,
  lg:  180,
  xl:  220,
  xxl: 260,
} as const

export type ChartHeightKey = keyof typeof CHART_HEIGHTS

export const CHART_MARGINS = {
  compact:   { top: 4,  right: 4,  left: 0,  bottom: 0 },
  default:   { top: 8,  right: 8,  left: 0,  bottom: 4 },
  spacious:  { top: 24, right: 8,  left: 8,  bottom: 8 },
  withYAxis: { top: 16, right: 8,  left: 36, bottom: 4 },
} as const

export type ChartMarginKey = keyof typeof CHART_MARGINS

/** Mobile breakpoint — screens narrower than this use reduced dimensions */
export const CHART_MOBILE_BREAKPOINT = 480

/** Axis label width per breakpoint (for Recharts YAxis width prop) */
export const CHART_AXIS_LABEL_WIDTH = {
  mobile:  32,
  tablet:  40,
  desktop: 44,
} as const
