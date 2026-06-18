'use client'

import { useId } from 'react'

interface SparklineProps {
  prices: number[]
  up: boolean
  width?: number
  height?: number
  className?: string
}

export function Sparkline({ prices, up, width = 88, height = 32, className }: SparklineProps) {
  const uid = useId()
  const gradId = `sg${uid.replace(/[^a-zA-Z0-9]/g, '')}`

  if (prices.length < 2) return <div style={className ? undefined : { width, height }} className={className} />

  const min = Math.min(...prices)
  const max = Math.max(...prices)
  const range = max - min || 1
  const step = width / (prices.length - 1)

  const pts = prices
    .map((p, i) => `${(i * step).toFixed(1)},${(height - ((p - min) / range) * (height - 2) - 1).toFixed(1)}`)
    .join(' ')
  const areaPts = `0,${height} ${pts} ${((prices.length - 1) * step).toFixed(1)},${height}`
  const color = up ? '#059669' : '#DC2626'

  const sizeProps = className
    ? { className }
    : { width, height }

  return (
    <svg
      viewBox={`0 0 ${width} ${height}`}
      {...sizeProps}
      preserveAspectRatio="none"
      fill="none"
    >
      <defs>
        <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity={0.25} />
          <stop offset="100%" stopColor={color} stopOpacity={0} />
        </linearGradient>
      </defs>
      <polygon points={areaPts} fill={`url(#${gradId})`} />
      <polyline
        points={pts}
        stroke={color}
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  )
}

export function SparklineSkeleton({ width = 88, height = 32 }: { width?: number; height?: number }) {
  return <div className="animate-pulse rounded bg-[#F0F1F6]" style={{ width, height }} />
}
