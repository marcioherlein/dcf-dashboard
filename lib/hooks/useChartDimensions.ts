'use client'

import { useEffect, useState } from 'react'
import {
  CHART_HEIGHTS,
  CHART_MARGINS,
  CHART_AXIS_LABEL_WIDTH,
  CHART_MOBILE_BREAKPOINT,
  type ChartHeightKey,
  type ChartMarginKey,
} from '@/lib/chartDimensions'

interface ChartDimensions {
  height: number
  margin: typeof CHART_MARGINS[ChartMarginKey]
  tickFontSize: number
  axisLabelWidth: number
  isMobile: boolean
}

/**
 * Returns responsive chart dimensions based on viewport width.
 * SSR-safe: returns desktop defaults before hydration.
 *
 * @example
 * const { height, margin, tickFontSize } = useChartDimensions({ size: 'md', marginType: 'default' })
 * <ResponsiveContainer width="100%" height={height}>
 *   <BarChart data={data} margin={margin}>
 *     <XAxis tick={{ fontSize: tickFontSize }} />
 */
export function useChartDimensions({
  size = 'md',
  marginType = 'default',
}: {
  size?: ChartHeightKey
  marginType?: ChartMarginKey
} = {}): ChartDimensions {
  const [isMobile, setIsMobile] = useState(false)

  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < CHART_MOBILE_BREAKPOINT)
    check()
    window.addEventListener('resize', check, { passive: true })
    return () => window.removeEventListener('resize', check)
  }, [])

  const baseHeight = CHART_HEIGHTS[size]
  // Mobile: step down one tier (lg→md, md→sm, etc.)
  const height = isMobile ? Math.max(100, baseHeight - 20) : baseHeight

  return {
    height,
    margin: CHART_MARGINS[marginType],
    tickFontSize: isMobile ? 9 : 10,
    axisLabelWidth: isMobile
      ? CHART_AXIS_LABEL_WIDTH.mobile
      : CHART_AXIS_LABEL_WIDTH.desktop,
    isMobile,
  }
}
